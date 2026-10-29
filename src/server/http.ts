import { randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { API, type SongsResponse, type StatusResponse } from "../shared/api";
import type { LiveConnections } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { DialogView, OdeConfig } from "../shared/config";
import { Mode } from "../shared/personalisation";
import { VersionAuthor, type RestoreResult } from "../shared/versions";
import type { LyricsStore } from "../mneme/lyrics-store";
import { VersionNotFoundError } from "../mneme/version-history";
import type { TempFolder } from "../mneme/paths";
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
import type { Questions } from "./questions";
import type { SelectionState } from "./selection";
import { SetReadError } from "./snapshot-reader";
import type { SongSwitcher } from "./song-switcher";
import { SongTitle } from "./song-title";
import { RefusedError, type VersionActions } from "./version-actions";

/** The built UI's files by path ("index.html", "assets/index-….js"), each base64-encoded. */
export type UiFiles = Readonly<Record<string, string>>;

export interface ServerDeps {
  config: OdeConfig;
  bus: EventBus;
  live: LiveConnections;
  song: SongStore;
  songs: SongSwitcher;
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
  temp: TempFolder;
  ui: UiFiles;
}

const TextSchema = z.object({ text: z.string().trim().min(1) });
const DecisionSchema = z.object({ decision: z.enum(["allow", "deny"]) });
const ChoiceSchema = z.object({ choice: z.string() });
const NameSchema = z.object({ name: z.string() });
const ModeSchema = z.object({ mode: z.enum(Mode) });
const LyricsWriteSchema = z.object({ text: z.string(), baseRevision: z.number().int().min(0) });
const VersionRequestSchema = z.object({ versionId: z.string().min(1) });
const SongOpenSchema = z.object({ id: z.string().min(1) });
const SongCreateSchema = z.object({ title: z.string() });
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

/** Content types of the built UI's files. */
const UI_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".json", "application/json"],
]);
/** The page every view of the UI starts from. */
const UI_INDEX = "index.html";
/** The cookie that carries the session's token once a dialog's first request has shown it. */
const TOKEN_COOKIE = "ode";

/**
 * The local server inside the extension: the UI that Ode's dialogs load, its API and its event stream. It listens on
 * 127.0.0.1 alone, on a port the system picks, and answers only requests that carry this session's token.
 */
export class OdeServer {
  private static readonly KEEPALIVE_MS = 15_000;
  /** Only this machine reaches the server. */
  private static readonly HOST = "127.0.0.1";
  private static readonly TOKEN_BYTES = 24;
  private readonly app = new Hono();
  private readonly token = randomBytes(OdeServer.TOKEN_BYTES).toString("hex");
  private port = 0;

  constructor(private readonly deps: ServerDeps) {}

  /** Starts listening; resolves once the port is known. */
  start(): Promise<void> {
    this.app.onError((error, c) => c.json({ error: OdeServer.messageOf(error) }, 500));
    this.app.use("*", (c, next) => this.authorize(c, next));
    this.routeApi();
    this.routeSongs();
    this.routeVersions();
    this.routeSettings();
    this.routeUi();
    return new Promise((resolve) => {
      serve({ fetch: this.app.fetch, hostname: OdeServer.HOST, port: 0 }, (info) => {
        this.port = info.port;
        resolve();
      });
    });
  }

  /** A dialog's address: the view on this server, with the token that lets it in. Live's dialogs load http://localhost. */
  url(view: DialogView): string {
    return `http://localhost:${this.port}/?view=${view}&token=${this.token}`;
  }

  /** Lets in requests that carry the token, in the address (a dialog's first request) or in the cookie it then gets. */
  private async authorize(c: Context, next: () => Promise<void>) {
    if (c.req.query("token") === this.token) {
      setCookie(c, TOKEN_COOKIE, this.token, { httpOnly: true, sameSite: "Strict", path: "/" });
      return next();
    }
    if (getCookie(c, TOKEN_COOKIE) === this.token) return next();
    return c.text("Open Ode from Live's right-click menu.", 403);
  }

  /** The songs the musician works on with Ode, and moving between them. */
  private routeSongs(): void {
    const { app } = this;
    const { songs } = this.deps;

    app.get(API.songs, async (c) => {
      const response: SongsResponse = await songs.list();
      return c.json(response);
    });

    app.post(API.songsOpen, async (c) => {
      const parsed = SongOpenSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { id } with the song to open." }, 400);
      return this.answer(c, () => songs.open(parsed.data.id));
    });

    app.post(API.songs, async (c) => {
      const parsed = SongCreateSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { title } with the new song's title." }, 400);
      return this.answer(c, () => songs.create(parsed.data.title));
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
        title: SongTitle.of((await song.read()).title),
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
      const path = await this.deps.temp.file("wav");
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
  }

  /** History, Undo, Again and Why?. */
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

  /** The built UI, bundled into the extension: a file by its path, and every view from index.html. */
  private routeUi(): void {
    const { ui } = this.deps;
    this.app.get("*", (c) => {
      const asked = decodeURIComponent(c.req.path).replace(/^\/+/, "");
      const path = asked in ui ? asked : UI_INDEX;
      const file = ui[path];
      if (file === undefined) return c.text("Ode's pages are missing from this build.", 404);
      return c.body(Buffer.from(file, "base64"), 200, { "Content-Type": UI_CONTENT_TYPES.get(extname(path).toLowerCase()) ?? OTHER_CONTENT_TYPE });
    });
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
