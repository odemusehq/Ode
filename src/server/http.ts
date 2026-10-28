import { copyFile, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { WSContext } from "hono/ws";
import { z } from "zod";
import {
  API,
  COVER_CHOICE,
  COVER_FILE,
  UI_READ_OPS,
  type ApprovalRequest,
  type LiveReadRequest,
  type LyricsAnalyzeRequest,
  type MemoryAdd,
  type PreferencesUpdate,
  type StatusResponse,
} from "../shared/api";
import { DEVICE_OPS, LIVE_SOCKET_PATHS, type LivePointer, type LiveResponse } from "../shared/live";
import { LeadSheetSchema } from "../shared/song";
import type { UiEvent } from "../shared/events";
import type { OdeConfig } from "../shared/config";
import type { LyricsAnalysis } from "../shared/lyrics";
import { Mode, type Accent } from "../shared/personalisation";
import type { RestoreResult } from "../shared/versions";
import type { Mneme } from "../mneme/artist";
import { VersionNotFoundError } from "../mneme/version-history";
import { tempFile } from "../mneme/paths";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongStore } from "../mneme/song-store";
import type { Services } from "../services/types";
import { Decision, type Approvals } from "../harness/approvals";
import { SessionBusyError } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import type { EventBus } from "./event-bus";
import { MelodyError, type MelodySettings } from "./melody-settings";
import type { LiveHub, SocketLink } from "./live-hub";
import type { PointerState } from "./pointer";
import type { Questions } from "./questions";
import type { SelectionState } from "./selection";
import { SetReadError } from "./snapshot-reader";
import { RefusedError, type VersionActions } from "./version-actions";

export interface ServerDeps {
  config: OdeConfig;
  bus: EventBus;
  live: LiveHub;
  song: SongStore;
  mneme: Mneme;
  prefs: PreferencesStore;
  services: Services;
  approvals: Approvals;
  questions: Questions;
  sessions: SessionManager;
  versions: VersionActions;
  selection: SelectionState;
  melody: MelodySettings;
  pointer: PointerState;
  analyzeLyrics: (lines: string[], accent: Accent) => LyricsAnalysis;
}

const TextSchema = z.object({ text: z.string().trim().min(1) });
const ChoiceSchema = z.object({ choice: z.string() });
const NameSchema = z.object({ name: z.string() });
const ModeSchema = z.object({ mode: z.enum(Mode) });
const RestoreRequestSchema = z.object({ confirmed: z.literal(true) });
const MelodyRequestSchema = z.object({ section: z.string().min(1) });
const CoverChoiceSchema = z.object({ file: z.string().min(1) });

/** The local HTTP server: the UI's API and event stream, the Live parts' sockets, and the built UI. */
export class OdeServer {
  private static readonly KEEPALIVE_MS = 15_000;
  private readonly app = new Hono();
  private readonly sockets = createNodeWebSocket({ app: this.app });

  constructor(private readonly deps: ServerDeps) {}

  start(): ServerType {
    this.routeLiveSockets();
    this.routeApi();
    this.routeVersions();
    this.routeUi();
    const server = serve({ fetch: this.app.fetch, hostname: this.deps.config.host, port: this.deps.config.port });
    this.sockets.injectWebSocket(server);
    return server;
  }

  private routeLiveSockets(): void {
    const { live } = this.deps;
    this.app.get(LIVE_SOCKET_PATHS.extension, this.socketHandler(live.extension));
    this.app.get(LIVE_SOCKET_PATHS.device, this.socketHandler(live.device));
  }

  private socketHandler(link: SocketLink) {
    const { live } = this.deps;
    return this.sockets.upgradeWebSocket(() => {
      let connection: WSContext | null = null;
      return {
        onOpen: (_event, socket) => {
          connection = socket;
          link.attach(socket);
          live.publishStatus();
        },
        onMessage: (event) => link.receive(String(event.data)),
        onClose: () => {
          if (connection) link.detach(connection);
          live.publishStatus();
        },
      };
    });
  }

  private routeApi(): void {
    const { app } = this;
    const { bus, live, song, mneme, prefs, approvals, questions, sessions, selection, melody, pointer, services, analyzeLyrics, config } = this.deps;

    app.post(API.chat, async (c) => {
      const parsed = TextSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "Send { text } with what to ask Ode." }, 400);
      void sessions.current.send({ text: parsed.data.text });
      return c.json({ ok: true });
    });

    app.post(API.stop, (c) => {
      sessions.current.stop();
      return c.json({ ok: true });
    });

    app.get(API.events, (c) => this.eventStream(c));

    app.post("/api/approvals/:id", async (c) => {
      const { decision } = await c.req.json<ApprovalRequest>();
      const known = approvals.decide(c.req.param("id"), decision === "allow" ? Decision.Allow : Decision.Deny);
      return known ? c.json({ ok: true }) : c.json({ error: "No such approval" }, 404);
    });

    app.post("/api/questions/:id", async (c) => {
      const parsed = ChoiceSchema.safeParse(await c.req.json().catch(() => null));
      const answered = parsed.success && questions.answer(c.req.param("id"), parsed.data.choice);
      return answered ? c.json({ ok: true }) : c.json({ error: "No such question, or that isn't one of its answers" }, 404);
    });

    app.get(API.song, async (c) => c.json(await song.read()));
    app.put(API.song, async (c) => c.json(await song.replace(LeadSheetSchema.parse(await c.req.json()))));

    app.get(API.preferences, async (c) => c.json(await this.preferences()));
    app.put(API.preferences, async (c) => {
      const update = await c.req.json<PreferencesUpdate>();
      const saved = await prefs.update(update);
      if (update.mode !== undefined) bus.emit({ type: "mode", mode: saved.mode });
      return c.json(await this.preferences());
    });

    app.put(API.mode, async (c) => {
      const parsed = ModeSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: `mode must be one of: ${Object.values(Mode).join(", ")}` }, 400);
      const mode = await prefs.setMode(parsed.data.mode);
      bus.emit({ type: "mode", mode });
      return c.json({ mode });
    });

    app.get(API.memory, async (c) => c.json(await mneme.recall()));
    app.post(API.memory, async (c) => {
      const { topic, value } = await c.req.json<MemoryAdd>();
      return c.json(await mneme.record({ topic, value, source: "said" }));
    });
    app.delete("/api/memory/:id", async (c) => c.json({ ok: await mneme.forget(c.req.param("id")) }));

    app.post(API.lyricsAnalyze, async (c) => {
      const { lines } = await c.req.json<LyricsAnalyzeRequest>();
      const accent = (await prefs.effective(await song.read())).pronunciation;
      return c.json(analyzeLyrics(lines, accent));
    });

    app.post(API.lyricsMelody, async (c) => {
      const parsed = MelodyRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "Send { section } with the section's id." }, 400);
      try {
        return c.json(await melody.forSection(parsed.data.section));
      } catch (error) {
        if (error instanceof MelodyError) return c.json({ error: error.message }, 400);
        if (error instanceof SetReadError) return c.json({ error: error.message }, 409);
        throw error;
      }
    });

    app.get(API.status, async (c) => {
      const status: StatusResponse = {
        live: live.status(),
        roles: services.available(),
        projectDir: song.projectDir,
        busy: sessions.current.isBusy,
        mode: await prefs.mode(),
        versionGroupMinutes: config.versions.groupMinutes,
      };
      return c.json(status);
    });

    app.get(API.suggestions, async (c) => c.json(await selection.suggestions()));

    app.post(API.speech, async (c) => {
      const audio = Buffer.from(await c.req.arrayBuffer());
      if (audio.length === 0) return c.json({ error: "Send the recording as a WAV file." }, 400);
      const path = await tempFile("wav");
      try {
        await writeFile(path, audio);
        const text = (await services.transcribe(path)).text.trim();
        if (text) void sessions.current.send({ text });
        return c.json({ text });
      } catch (error) {
        return c.json({ error: OdeServer.messageOf(error) }, 503);
      } finally {
        await rm(path, { force: true });
      }
    });

    app.get(API.release, async (c) => c.json({ files: await this.releaseFiles() }));
    app.post(API.releaseCover, async (c) => {
      const parsed = CoverChoiceSchema.safeParse(await c.req.json().catch(() => null));
      const file = parsed.success ? basename(parsed.data.file) : "";
      if (!COVER_CHOICE.test(file)) return c.json({ error: "Send { file } with one of the cover art choices, such as cover-2.png." }, 400);
      const copied = await copyFile(join(song.releaseDir, file), join(song.releaseDir, COVER_FILE)).then(
        () => true,
        () => false,
      );
      if (!copied) return c.json({ error: "That cover art choice isn't in the release folder any more." }, 404);
      return c.json({ files: await this.releaseFiles() });
    });
    app.get("/api/release/file/:name", async (c) => {
      const name = basename(c.req.param("name"));
      const data = await readFile(join(song.releaseDir, name)).catch(() => null);
      return data ? c.body(data) : c.json({ error: "Not found" }, 404);
    });

    app.post(API.livePointer, async (c) => {
      const received = await c.req.json<LivePointer>();
      pointer.set(received);
      bus.emit({ type: "pointer", pointer: received });
      void selection.point(received).catch(() => undefined);
      return c.json({ ok: true });
    });

    app.post(API.liveRead, async (c) => {
      const { op, args } = z
        .object({ op: z.enum(UI_READ_OPS), args: z.unknown() })
        .parse(await c.req.json<LiveReadRequest>());
      const link = (DEVICE_OPS as readonly string[]).includes(op) ? live.device : live.extension;
      try {
        return c.json(await link.call(op, args ?? {}));
      } catch (error) {
        return c.json({ error: OdeServer.messageOf(error) }, 503);
      }
    });

    app.get(API.livePending, (c) => c.json(live.extension.takeQueue()));
    app.post(API.liveResults, async (c) => {
      live.extension.storeResults(await c.req.json<LiveResponse[]>());
      return c.json({ ok: true });
    });
  }

  /** History, Undo and Again. */
  private routeVersions(): void {
    const { app } = this;
    const { versions } = this.deps;

    app.get(API.versions, async (c) => c.json(await versions.items()));
    app.get("/api/versions/:id", (c) => this.answer(c, () => versions.detail(c.req.param("id"))));

    app.post("/api/versions/:id/restore", async (c) => {
      if (!RestoreRequestSchema.safeParse(await c.req.json().catch(() => null)).success) {
        return c.json({ error: "Restoring deletes the versions after it, so the musician must confirm it: send { confirmed: true }." }, 400);
      }
      return this.answer(c, async (): Promise<RestoreResult> => {
        try {
          return await versions.restore(c.req.param("id"));
        } catch (error) {
          if (error instanceof SessionBusyError || error instanceof SetReadError) return { restored: false, skipped: [error.message] };
          throw error;
        }
      });
    });

    app.post("/api/versions/:id/name", async (c) => {
      const parsed = NameSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "Send { name }." }, 400);
      return this.answer(c, () => versions.name(c.req.param("id"), parsed.data.name));
    });

    app.post("/api/versions/:id/copy", (c) => this.answer(c, () => versions.copy(c.req.param("id"))));

    app.post(API.undo, async (c) => c.json(await versions.undo()));

    app.post(API.again, (c) =>
      this.answer(c, async () => {
        await versions.again();
        return { ok: true };
      }),
    );
  }

  private routeUi(): void {
    const root = relative(process.cwd(), join(this.deps.config.repoDir, "dist", "ui"));
    this.app.use("/*", serveStatic({ root }));
    this.app.get("*", serveStatic({ path: join(root, "index.html") }));
  }

  /** Runs a version action and answers with its result, or with the reason it couldn't be done (404 unknown version, 409 not now). */
  private async answer<T extends object>(c: Context, work: () => Promise<T>) {
    try {
      return c.json(await work());
    } catch (error) {
      if (error instanceof VersionNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof RefusedError || error instanceof SessionBusyError || error instanceof SetReadError) {
        return c.json({ error: error.message }, 409);
      }
      throw error;
    }
  }

  private eventStream(c: Context) {
    const { bus, live, sessions, approvals, questions, selection, prefs } = this.deps;
    return streamSSE(c, async (stream) => {
      const send = (event: UiEvent) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      };
      send({ type: "live-status", status: live.status() });
      send({ type: "busy", busy: sessions.current.isBusy });
      send({ type: "mode", mode: await prefs.mode() });
      for (const approval of approvals.pending()) send({ type: "approval", ...approval });
      for (const question of questions.pending()) send({ type: "question", ...question });
      selection.replay(send);
      const unsubscribe = bus.subscribe(send);
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await stream.sleep(OdeServer.KEEPALIVE_MS);
        await stream.writeSSE({ event: "keepalive", data: "" });
      }
    });
  }

  private async preferences() {
    const { prefs, song } = this.deps;
    return { ...(await prefs.get()), resolved: await prefs.effective(await song.read()) };
  }

  private async releaseFiles(): Promise<{ name: string; size: number }[]> {
    const dir = this.deps.song.releaseDir;
    const names = await readdir(dir).catch(() => [] as string[]);
    return Promise.all(names.map(async (name) => ({ name, size: (await stat(join(dir, name))).size })));
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
