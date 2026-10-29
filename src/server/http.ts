import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { WSContext } from "hono/ws";
import { z } from "zod";
import { API, type StatusResponse } from "../shared/api";
import { LIVE_SOCKET_PATHS, type LivePointer, type LiveResponse } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { OdeConfig } from "../shared/config";
import { Mode } from "../shared/personalisation";
import { VersionAuthor, type RestoreResult } from "../shared/versions";
import type { LyricsStore } from "../mneme/lyrics-store";
import { VersionNotFoundError } from "../mneme/version-history";
import { tempFile } from "../mneme/paths";
import type { PreferencesStore } from "../mneme/preferences";
import type { SettingsStore } from "../mneme/settings-store";
import type { SongStore } from "../mneme/song-store";
import type { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { ModelListRequestSchema, SettingsUpdateSchema, type SettingsResponse } from "../shared/settings";
import type { Services } from "../services/types";
import { Decision, type Approvals } from "../harness/approvals";
import { SessionBusyError } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import type { EventBus } from "./event-bus";
import type { LiveHub, SocketLink } from "./live-hub";
import type { Questions } from "./questions";
import type { SelectionState } from "./selection";
import { SetReadError } from "./snapshot-reader";
import { SongTitle } from "./song-title";
import { RefusedError, type VersionActions } from "./version-actions";

export interface ServerDeps {
  config: OdeConfig;
  bus: EventBus;
  live: LiveHub;
  song: SongStore;
  lyrics: LyricsStore;
  prefs: PreferencesStore;
  services: Services;
  settings: SettingsStore;
  models: ModelRoles;
  approvals: Approvals;
  questions: Questions;
  sessions: SessionManager;
  versions: VersionActions;
  selection: SelectionState;
}

const TextSchema = z.object({ text: z.string().trim().min(1) });
const DecisionSchema = z.object({ decision: z.enum(["allow", "deny"]) });
const ChoiceSchema = z.object({ choice: z.string() });
const NameSchema = z.object({ name: z.string() });
const ModeSchema = z.object({ mode: z.enum(Mode) });
const LyricsWriteSchema = z.object({ text: z.string(), baseRevision: z.number().int().min(0) });
const VersionRequestSchema = z.object({ versionId: z.string().min(1) });
const RestoreRequestSchema = z.object({ confirmed: z.literal(true) });

const SEND_VERSION_ID = "Send { versionId } with the id of the change by Ode.";

/** Content types of the files Ode writes into the release folder. */
const RELEASE_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".pdf", "application/pdf"],
]);
const OTHER_CONTENT_TYPE = "application/octet-stream";

/** The local HTTP server: the UI's API and event stream, the Live parts' sockets, and the built UI. */
export class OdeServer {
  private static readonly KEEPALIVE_MS = 15_000;
  private readonly app = new Hono();
  private readonly sockets = createNodeWebSocket({ app: this.app });

  constructor(private readonly deps: ServerDeps) {}

  start(): ServerType {
    this.app.onError((error, c) => c.json({ error: OdeServer.messageOf(error) }, 500));
    this.routeLiveSockets();
    this.routeApi();
    this.routeVersions();
    this.routeSettings();
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
    const { bus, live, song, lyrics, prefs, approvals, questions, sessions, selection, services, config } = this.deps;

    app.post(API.chat, async (c) => {
      const parsed = TextSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { text } with what to ask Ode." }, 400);
      void sessions.current.send({ text: parsed.data.text });
      return c.json({ ok: true });
    });

    app.post(API.stop, (c) => {
      sessions.current.stop();
      return c.json({ ok: true });
    });

    app.get(API.events, (c) => this.eventStream(c));

    app.get(API.status, async (c) => {
      const status: StatusResponse = {
        live: live.status(),
        busy: sessions.current.isBusy,
        stoppable: sessions.current.isStoppable,
        mode: await prefs.mode(),
        title: SongTitle.of((await song.read()).title, song.setFilePath),
        versionGroupMinutes: config.versions.groupMinutes,
      };
      return c.json(status);
    });

    app.post("/api/approvals/:id", async (c) => {
      const parsed = DecisionSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: 'Send { decision: "allow" } or { decision: "deny" }.' }, 400);
      const known = approvals.decide(c.req.param("id"), parsed.data.decision === "allow" ? Decision.Allow : Decision.Deny);
      return known ? c.json({ ok: true }) : c.json({ error: "No such approval" }, 404);
    });

    app.post("/api/questions/:id", async (c) => {
      const parsed = ChoiceSchema.safeParse(await OdeServer.body(c));
      const answered = parsed.success && questions.answer(c.req.param("id"), parsed.data.choice);
      return answered ? c.json({ ok: true }) : c.json({ error: "No such question, or that isn't one of its answers" }, 404);
    });

    app.get(API.lyrics, async (c) => c.json(await lyrics.read()));
    app.put(API.lyrics, async (c) => {
      const parsed = LyricsWriteSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { text, baseRevision } with the whole lyrics and the revision they were edited from." }, 400);
      return c.json(await lyrics.write(parsed.data.text, parsed.data.baseRevision, VersionAuthor.Musician));
    });

    app.get("/api/release/file/:name", async (c) => {
      const name = basename(c.req.param("name"));
      const data = await readFile(join(song.releaseDir, name)).catch(() => null);
      if (!data) return c.json({ error: "That file isn't in the release folder." }, 404);
      return c.body(data, 200, { "Content-Type": RELEASE_CONTENT_TYPES.get(extname(name).toLowerCase()) ?? OTHER_CONTENT_TYPE });
    });


    app.put(API.mode, async (c) => {
      const parsed = ModeSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: `mode must be one of: ${Object.values(Mode).join(", ")}` }, 400);
      const mode = await prefs.setMode(parsed.data.mode);
      bus.emit({ type: "mode", mode });
      return c.json({ mode });
    });

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

    app.post(API.livePointer, async (c) => {
      const received = await c.req.json<LivePointer>();
      void selection.point(received).catch(() => undefined);
      return c.json({ ok: true });
    });

    app.get(API.livePending, (c) => c.json(live.extension.takeQueue()));
    app.post(API.liveResults, async (c) => {
      live.extension.storeResults(await c.req.json<LiveResponse[]>());
      return c.json({ ok: true });
    });
  }

  /** History, copies, Undo, Again and Why?. */
  private routeVersions(): void {
    const { app } = this;
    const { versions } = this.deps;

    app.get(API.versions, async (c) => c.json(await versions.items()));
    app.post(API.versionsCheck, async (c) => c.json(await versions.check()));
    app.get("/api/versions/:id", (c) => this.answer(c, () => versions.detail(c.req.param("id"))));

    app.post("/api/versions/:id/restore", async (c) => {
      if (!RestoreRequestSchema.safeParse(await OdeServer.body(c)).success) {
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
      const parsed = NameSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { name }." }, 400);
      return this.answer(c, () => versions.name(c.req.param("id"), parsed.data.name));
    });

    app.post("/api/versions/:id/copy", (c) => this.answer(c, () => versions.copy(c.req.param("id"))));
    app.post(API.copyNow, (c) => this.answer(c, () => versions.copyNow()));

    // A refused Undo shows no result line: it answers 409 with the reason, also as a RestoreResult.
    app.post(API.undo, async (c) => {
      const parsed = VersionRequestSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: SEND_VERSION_ID }, 400);
      try {
        return c.json(await versions.undo(parsed.data.versionId));
      } catch (error) {
        if (!OdeServer.isRefusal(error)) throw error;
        const message = OdeServer.messageOf(error);
        const refused: RestoreResult & { error: string } = { restored: false, skipped: [message], error: message };
        return c.json(refused, 409);
      }
    });

    app.post(API.again, async (c) => {
      const parsed = VersionRequestSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: SEND_VERSION_ID }, 400);
      return this.answer(c, async () => {
        await versions.again(parsed.data.versionId);
        return { ok: true };
      });
    });

    app.post(API.why, async (c) => {
      const parsed = VersionRequestSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: SEND_VERSION_ID }, 400);
      return this.answer(c, async () => {
        await versions.why(parsed.data.versionId);
        return { ok: true };
      });
    });
  }

  /** The musician's provider, model and keys. Keys go in, and come back only as set or empty. */
  private routeSettings(): void {
    const { app } = this;
    const { settings, models } = this.deps;

    app.get(API.settings, async (c) => {
      const response: SettingsResponse = {
        settings: await settings.view(),
        providers: ProviderCatalog.bundled.chatOptions(),
        services: ProviderCatalog.bundled.serviceOptions(),
      };
      return c.json(response);
    });

    app.put(API.settings, async (c) => {
      const parsed = SettingsUpdateSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { provider, model, services } with any keys to change." }, 400);
      return c.json(await settings.update(parsed.data));
    });

    app.post(API.settingsModels, async (c) => {
      const parsed = ModelListRequestSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { provider } and the key to list models with." }, 400);
      try {
        return c.json(await models.models(parsed.data));
      } catch (error) {
        return c.json({ error: OdeServer.messageOf(error) }, 502);
      }
    });
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
      if (OdeServer.isRefusal(error)) return c.json({ error: OdeServer.messageOf(error) }, 409);
      throw error;
    }
  }

  /** Sends what is going on now to a window that just connected (questions and approvals still waiting included), then every event. */
  private eventStream(c: Context) {
    const { bus, live, sessions, approvals, questions, selection, prefs } = this.deps;
    return streamSSE(c, async (stream) => {
      const send = (event: UiEvent) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      };
      send({ type: "live-status", status: live.status() });
      send({ type: "busy", busy: sessions.current.isBusy, stoppable: sessions.current.isStoppable });
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

  /** The request's JSON body, or null when it has none or it isn't JSON. */
  private static body(c: Context): Promise<unknown> {
    return c.req.json().catch(() => null);
  }

  /** Errors that mean "not now", with a message saying why: Ode is working, Live can't be read, or the history says no. */
  private static isRefusal(error: unknown): error is Error {
    return error instanceof RefusedError || error instanceof SessionBusyError || error instanceof SetReadError;
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
