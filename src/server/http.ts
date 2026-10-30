import { RequestIdentityError } from "../mneme/conversations";
import { ResultKind } from "../shared/events";
import { bodyLimit } from "hono/body-limit";
import { LocalAudioFiles, MAX_AUDIO_UPLOAD_BYTES } from "../live/local-audio-files";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { MAX_WINDOW } from "../shared/max-window";
import { MaxWindowError, type MaxWindowBridge } from "./max-window";
import { API, type SongsResponse, type StatusResponse } from "../shared/api";
import type { UiEvent } from "../shared/events";
import type { DialogView, OdeConfig } from "../shared/config";
import type { LyricsCheckResponse } from "../shared/lyrics";
import { Mode } from "../shared/personalisation";
import { VersionAuthor, type RestoreResult } from "../shared/versions";
import { LyricsForAnotherSongError, type LyricsStore } from "../mneme/lyrics-store";
import { VersionNotFoundError } from "../mneme/version-history";
import type { PreferencesStore } from "../mneme/preferences";
import type { SettingsStore } from "../mneme/settings-store";
import { SongNotFoundError, type SongStore } from "../mneme/song-store";
import type { LyricsChecker } from "../services/lyrics-checker";
import type { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { ModelListRequestSchema, SettingsUpdateSchema, type SettingsResponse } from "../shared/settings";
import { Decision, type Approvals } from "../harness/approvals";
import { SessionBusyError } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import type { EventBus } from "./event-bus";
import type { Questions } from "./questions";
import { SetReadError } from "./snapshot-reader";
import type { SongSwitcher } from "./song-switcher";
import { SongTitle } from "./song-title";
import { RefusedError, type VersionActions } from "./version-actions";
import type { Services } from "../services/types";
import { RoleCheck } from "../services/roles";
import { Dictation, DictationError, MAX_DICTATION_BYTES } from "./dictation";
import { ComposerCancelSchema, ComposerDraftSchema, ComposerPrepareSchema, ComposerResolveSchema, ComposerWriteSchema } from "../shared/composer";
import { ComposerError, type ComposerStore } from "../mneme/composer-store";
import { AudioDeliveryError, type AudioDeliveries } from "../mneme/audio-deliveries";

/** The built UI's files by path ("index.html", "assets/index-….js"), each base64-encoded. */
export type UiFiles = Readonly<Record<string, string>>;

export interface ServerDeps {
  config: OdeConfig;
  bus: EventBus;
  song: SongStore;
  songs: SongSwitcher;
  lyrics: LyricsStore;
  lyricsChecker: LyricsChecker;
  prefs: PreferencesStore;
  settings: SettingsStore;
  models: ModelRoles;
  services: Pick<Services, "transcribe">;
  composer: ComposerStore;
  deliveries: AudioDeliveries;
  approvals: Approvals;
  questions: Questions;
  sessions: SessionManager;
  versions: VersionActions;
  ui: UiFiles;
  maxWindow?: MaxWindowBridge;
}

const TextSchema = z.object({ text: z.string().trim().min(1), requestId: z.uuid().optional(), songId: z.string().min(1).optional() });
const DecisionSchema = z.object({ decision: z.enum(["allow", "deny"]) });
const ChoiceSchema = z.object({ choice: z.string() });
const NameSchema = z.object({ name: z.string() });
const ModeSchema = z.object({ mode: z.enum(Mode) });
const LyricsWriteSchema = z.object({ songId: z.string().min(1).optional(), text: z.string(), baseRevision: z.number().int().min(0) });
const LyricsCheckSchema = z.object({ lines: z.array(z.string()) });
const StrictRhymesSchema = z.object({ name: z.string().trim().min(1), strict: z.boolean() });
const VersionRequestSchema = z.object({ versionId: z.string().min(1) });
const SongOpenSchema = z.object({ id: z.string().min(1) });
const SongCreateSchema = z.object({ title: z.string() });
const RestoreRequestSchema = z.object({ confirmed: z.literal(true) });
const MaxConnectSchema = z.object({ capability: z.string().regex(/^[a-f0-9]{32}$/) }).strict();
const MaxPollSchema = z.object({ session: z.string().regex(/^[a-f0-9]{48}$/) }).strict();
const MaxAckSchema = z.object({ session: z.string().regex(/^[a-f0-9]{48}$/), id: z.uuid(), status: z.enum(["ready", "error"]), error: z.string().max(MAX_WINDOW.errorMaxChars).optional() }).strict();
const MAX_WINDOW_PATHS: ReadonlySet<string> = new Set(Object.values(MAX_WINDOW.api));

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
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".json", "application/json"],
]);
/** The page every view of the UI starts from. */
const UI_INDEX = "index.html";
/** The cookie that carries the session's token once a dialog's first request has shown it. */
const TOKEN_COOKIE = "ode";
/** The body type of every request that changes something. */
const JSON_TYPE = "application/json";
/** Methods that only read. */
const READS: ReadonlySet<string> = new Set(["GET", "HEAD"]);
const COMPOSER_WRITES: ReadonlySet<string> = new Set([API.composer, API.composerSend, API.composerResolve, API.composerCancel]);
/** Kept on every answer: Ode's pages open as Live's dialogs alone, unframed, and keep their address to themselves. */
const SAFETY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
const OPEN_FROM_LIVE = "Open Ode from Live's right-click menu.";

/** Keep the supplied Unicode filename while providing a safe fallback for older download clients. */
function attachmentFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const utf8 = encodeURIComponent(name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * The local server inside the extension: the UI that Ode's dialogs load, its API and its event stream. It listens on
 * 127.0.0.1 alone, on a port the system picks, and answers only requests that carry this session's token.
 */
export class OdeServer {
  /** Only this machine reaches the server. */
  private static readonly HOST = "127.0.0.1";
  private static readonly TOKEN_BYTES = 24;
  private readonly app = new Hono();
  private readonly token = randomBytes(OdeServer.TOKEN_BYTES).toString("hex");
  private port = 0;
  private modifyingRequests = 0;
  private switchingRequest = false;

  constructor(private readonly deps: ServerDeps) {}

  /** Starts listening; resolves once the port is known. */
  start(): Promise<void> {
    this.app.onError((error, c) => c.json({ error: OdeServer.messageOf(error) }, 500));
    this.app.use("*", (c, next) => this.guard(c, next));
    this.app.use("*", (c, next) => this.authorize(c, next));
    this.routeMaxWindow();
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

  get listeningPort(): number {
    return this.port;
  }

  /**
   * Keeps the server to Ode's own pages. The Host names this server, which turns away a page whose own name points at
   * 127.0.0.1. A request that changes something comes from Ode's origin with a JSON body: a page on another port
   * shares the cookie, and it can send JSON only after a preflight this server leaves unanswered.
   */
  private async guard(c: Context, next: () => Promise<void>) {
    const hosts = [`localhost:${this.port}`, `${OdeServer.HOST}:${this.port}`];
    if (!hosts.includes(c.req.header("host") ?? "")) return c.text(OPEN_FROM_LIVE, 403);
    if (!READS.has(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin !== undefined && !hosts.some((host) => origin === `http://${host}`)) return c.text(OPEN_FROM_LIVE, 403);
      const upload = c.req.path === API.audioImport || c.req.path === API.dictation;
      const contentType = c.req.header("content-type") ?? "";
      if (upload && origin === undefined) return c.text(OPEN_FROM_LIVE, 403);
      if (!(upload ? contentType.startsWith("multipart/form-data;") : contentType.startsWith(JSON_TYPE))) {
        return c.json({ error: upload ? "Choose an audio file to attach." : "Send the request as JSON." }, 415);
      }
    }
    // Dictation has no song writes. Its captured song id and final check permit switching while ASR runs.
    const composerWrite = COMPOSER_WRITES.has(c.req.path);
    if (!READS.has(c.req.method) && c.req.path !== API.stop && c.req.path !== API.dictation && c.req.path !== API.audioImport && !composerWrite && !MAX_WINDOW_PATHS.has(c.req.path)) {
      const switchesSong = c.req.method === "POST" && (c.req.path === API.songs || c.req.path === API.songsOpen);
      if (this.switchingRequest || this.deps.songs.isSwitching || (switchesSong && this.modifyingRequests > 0)) {
        return c.json({ error: "Ode is switching songs, or a request is still arriving. Wait for it to finish, then try again." }, 409);
      }
      // Hold admission through body parsing, so an earlier request cannot land in the next song.
      this.modifyingRequests += 1;
      if (switchesSong) this.switchingRequest = true;
      try {
        await next();
      } finally {
        this.modifyingRequests -= 1;
        if (switchesSong) this.switchingRequest = false;
      }
    } else await next();
    for (const [name, value] of Object.entries(SAFETY_HEADERS)) c.res.headers.set(name, value);
  }

  /** Lets in requests that carry the token, in the address (a dialog's first request) or in the cookie it then gets. */
  private async authorize(c: Context, next: () => Promise<void>) {
    // These exact transport routes check their own one-time bootstrap or private Max session below.
    if (MAX_WINDOW_PATHS.has(c.req.path)) {
      if (c.req.method !== "POST") return c.json({ error: "Use POST for Ode's Max window connection." }, 405);
      return next();
    }
    if (this.carriesToken(c.req.query("token"))) {
      setCookie(c, TOKEN_COOKIE, this.token, { httpOnly: true, sameSite: "Strict", path: "/" });
      return next();
    }
    if (this.carriesToken(getCookie(c, TOKEN_COOKIE))) return next();
    return c.text(OPEN_FROM_LIVE, 403);
  }

  /** Compares in constant time, so the token's characters stay hidden from timing. */
  private carriesToken(value: string | undefined): boolean {
    if (value === undefined || value.length !== this.token.length) return false;
    return timingSafeEqual(Buffer.from(value), Buffer.from(this.token));
  }

  /** Max transports window commands; its credential never authorizes the musical API or the UI itself. */
  private routeMaxWindow(): void {
    const limit = bodyLimit({ maxSize: 2_048 });
    const respond = (c: Context, work: (bridge: MaxWindowBridge) => object) => {
      c.header("Cache-Control", "no-store");
      if (!this.deps.maxWindow) return c.json({ error: "Ode's Max window connection is unavailable." }, 503);
      try { return c.json(work(this.deps.maxWindow)); }
      catch (error) {
        if (error instanceof MaxWindowError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    };
    this.app.post(MAX_WINDOW.api.connect, limit, async (c) => {
      const parsed = MaxConnectSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send the Max device's connection capability." }, 403);
      return respond(c, (bridge) => bridge.connect(parsed.data.capability));
    });
    this.app.post(MAX_WINDOW.api.poll, limit, async (c) => {
      const parsed = MaxPollSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send the Max device's private session." }, 403);
      return respond(c, (bridge) => bridge.poll(parsed.data.session));
    });
    this.app.post(MAX_WINDOW.api.ack, limit, async (c) => {
      const parsed = MaxAckSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send the Max window's command acknowledgement." }, 400);
      return respond(c, (bridge) => { bridge.acknowledge(parsed.data); return { ok: true }; });
    });
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
    const { bus, song, lyrics, prefs, approvals, questions, sessions, config } = this.deps;

    app.post(API.chat, async (c) => {
      const parsed = TextSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { text } with what to ask Ode." }, 400);
      if (parsed.data.songId && parsed.data.songId !== song.songId) return c.json({ error: "The open song changed. Your message stayed in the composer; send it again in the intended song." }, 409);
      const songId = song.songId;
      try {
        if (parsed.data.requestId) await this.deps.composer.assertRequest(songId, parsed.data.requestId, parsed.data.text);
        await sessions.current.accept(parsed.data);
        return c.json({ ok: true, ...(parsed.data.requestId ? { composer: await this.deps.composer.accepted(songId, parsed.data.requestId) } : {}) });
      } catch (error) {
        if (error instanceof RequestIdentityError) return c.json({ error: error.message }, 409);
        if (error instanceof ComposerError) return c.json({ error: error.message, ...(error.composer ? { composer: error.composer } : {}) }, error.status);
        throw error;
      }
    });

    app.get(API.conversation, async (c) => {
      const session = sessions.current;
      return c.json({ songId: session.songId, exchanges: await session.transcript() });
    });

    const draftLimit = bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "The draft is too large to save in one message." }, 413) });
    app.get(API.composer, async (c) => {
      const songId = z.uuid().safeParse(c.req.query("songId"));
      if (!songId.success) return c.json({ error: "Name the song whose draft to read." }, 400);
      try { return c.json(await this.deps.composer.read(songId.data)); }
      catch (error) { if (error instanceof SongNotFoundError) return c.json({ error: error.message }, 404); if (error instanceof ComposerError) return c.json({ error: error.message, composer: error.composer }, error.status); throw error; }
    });
    const draftAction = <T>(schema: z.ZodType<T>, work: (input: T) => Promise<unknown>) => async (c: Context) => {
      const parsed = schema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "The draft request is incomplete or too large. Your words stayed in the composer." }, 400);
      try { return c.json(await work(parsed.data)); }
      catch (error) {
        if (error instanceof ComposerError) return c.json({ error: error.message, ...(error.composer ? { composer: error.composer } : {}) }, error.status);
        if (error instanceof SongNotFoundError) return c.json({ error: error.message }, 404);
        throw error;
      }
    };
    app.put(API.composer, draftLimit, draftAction(ComposerWriteSchema, (input) => this.deps.composer.save(input)));
    app.post(API.composerSend, draftLimit, draftAction(ComposerPrepareSchema, (input) => this.deps.composer.prepare(input)));
    app.post(API.composerResolve, draftLimit, draftAction(ComposerResolveSchema, (input) => this.deps.composer.resolve(input)));
    app.post(API.composerCancel, draftLimit, draftAction(ComposerCancelSchema, (input) => this.deps.composer.cancel(input)));

    app.post(API.audioImport, bodyLimit({ maxSize: MAX_AUDIO_UPLOAD_BYTES + 1024 * 1024,
      onError: (c) => c.json({ error: "The audio file is too large. Attach a shorter range (up to 128 MiB)." }, 413),
    }), async (c) => {
      const form = await c.req.formData();
      const file = form.get("file");
      const scope = form.get("scope") ?? "reference";
      if (!(file instanceof File) || !["sample", "reference", "processed-bounce"].includes(String(scope))) {
        return c.json({ error: "Choose an audio file and its intended use." }, 400);
      }
      if (file.size > MAX_AUDIO_UPLOAD_BYTES) return c.json({ error: "The audio file exceeds 128 MiB." }, 413);
      const start = form.get("start"), end = form.get("end");
      const library = new LocalAudioFiles(config.userDir, config.tempDir);
      try {
        const draftIds = [form.get("songId"), form.get("writerId"), form.get("entryId")];
        const linking = draftIds.some((id) => id !== null);
        if (linking && draftIds.some((id) => !z.uuid().safeParse(id).success)) return c.json({ error: "Name the song, writer and attachment entry for this draft upload." }, 400);
        let draftLink: { baseRevision: number; snapshot: z.infer<typeof ComposerDraftSchema> } | undefined;
        if (linking) {
          let snapshot: unknown;
          try { snapshot = JSON.parse(String(form.get("snapshot"))); } catch { return c.json({ error: "Include the saved draft snapshot with its upload." }, 400); }
          const linked = z.object({ baseRevision: z.coerce.number().int().min(0), snapshot: ComposerDraftSchema }).safeParse({ baseRevision: form.get("baseRevision"), snapshot });
          if (!linked.success) return c.json({ error: "Include the saved draft revision and snapshot with its upload." }, 400);
          draftLink = linked.data;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const audio = { name: file.name, bytes,
          purpose: scope === "sample" ? "library" as const : scope as "reference" | "processed-bounce", source: String(form.get("sourceDescription") ?? ""),
          ...(start !== null && end !== null ? { range: { start: Number(start), end: Number(end) } } : {}) };
        if (linking) return c.json(await this.deps.composer.attach({ songId: String(draftIds[0]), writerId: String(draftIds[1]), entryId: String(draftIds[2]), ...draftLink!, scope: String(scope) as "sample" | "reference" | "processed-bounce", audio }));
        const record = await library.add(audio);
        return c.json({ ...await library.open(record.id), scope });
      } catch (error) {
        if (error instanceof ComposerError) return c.json({ error: error.message, composer: error.composer }, error.status);
        if (error instanceof SongNotFoundError) return c.json({ error: error.message }, 404);
        return c.json({ error: OdeServer.messageOf(error) }, 400);
      }
    });

    app.post(API.dictation, bodyLimit({ maxSize: MAX_DICTATION_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: "Dictation is limited to 16 MiB and one minute." }, 413),
    }), async (c) => {
      const songId = song.songId;
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || typeof form.get("songId") !== "string") return c.json({ error: "Send a WAV recording and its songId." }, 400);
      if (form.get("songId") !== songId || song.songId !== songId) return c.json({ error: "The open song changed. Dictate again in the intended song." }, 409);
      if (file.size > MAX_DICTATION_BYTES) return c.json({ error: "Dictation is limited to 16 MiB and one minute." }, 413);
      const role = (await this.deps.models.roles()).transcription;
      if (song.songId !== songId) return c.json({ error: "The open song changed. Dictate again in the intended song." }, 409);
      if (!RoleCheck.isConfigured(role)) return c.json({ error: "Add a Meta key in Ode: Settings to use dictation." }, 503);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (song.songId !== songId) return c.json({ error: "The open song changed. Dictate again in the intended song." }, 409);
        const text = await new Dictation(this.deps.services, config.tempDir).transcribe(bytes, c.req.raw.signal, () => song.songId === songId);
        if (song.songId !== songId) return c.json({ error: "The open song changed. The dictation was not submitted." }, 409);
        return c.json({ songId, text });
      } catch (error) {
        if (error instanceof DictationError) return c.json({ error: error.message }, error.status);
        if (c.req.raw.signal.aborted) return c.json({ error: "Dictation cancelled." }, 408);
        return c.json({ error: "Dictation could not finish. Try again." }, 502);
      }
    });

    app.post(API.stop, async (c) => {
      const parsed = z.object({ requestIds: z.array(z.uuid()).max(256).optional() }).safeParse(await OdeServer.body(c) ?? {});
      if (!parsed.success) return c.json({ error: "Send requestIds as an optional list of request ids." }, 400);
      sessions.current.stop(parsed.data.requestIds);
      if (parsed.data.requestIds?.length) await this.deps.composer.cancelMany(song.songId, parsed.data.requestIds);
      return c.json({ ok: true });
    });

    app.get(API.events, (c) => this.eventStream(c));

    app.get(API.status, async (c) => {
      const status: StatusResponse = {
        busy: sessions.current.isBusy,
        stoppable: sessions.current.isStoppable,
        mode: await prefs.mode(),
        title: SongTitle.of((await song.read()).title),
        versionGroupMinutes: config.versions.groupMinutes,
        credit: (await this.deps.settings.view()).credit,
        dictationReady: RoleCheck.isConfigured((await this.deps.models.roles()).transcription),
      };
      return c.json(status);
    });

    app.post("/api/approvals/:id", async (c) => {
      const parsed = DecisionSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: 'Send { decision: "allow" } or { decision: "deny" }.' }, 400);
      const known = approvals.decide(c.req.param("id"), parsed.data.decision === "allow" ? Decision.Allow : Decision.Deny);
      return known ? c.json({ ok: true }) : c.json({ error: "Unknown approval" }, 404);
    });

    app.post("/api/questions/:id", async (c) => {
      const parsed = ChoiceSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { choice } with one of the question's answers." }, 400);
      const answered = questions.answer(c.req.param("id"), parsed.data.choice);
      return answered ? c.json({ ok: true }) : c.json({ error: "That question is answered already, or the choice is outside its answers." }, 404);
    });

    app.get(API.lyrics, async (c) => c.json(await lyrics.read()));
    app.put(API.lyrics, async (c) => {
      const parsed = LyricsWriteSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { text, baseRevision } with the whole lyrics and the revision they were edited from." }, 400);
      try {
        return c.json(await lyrics.write(parsed.data.text, parsed.data.baseRevision, VersionAuthor.Musician, parsed.data.songId));
      } catch (error) {
        if (error instanceof LyricsForAnotherSongError) return c.json({ error: error.message }, 409);
        throw error;
      }
    });

    // Lyrics support marks one section: the accent is the song's pronunciation setting.
    app.post(API.lyricsCheck, async (c) => {
      const parsed = LyricsCheckSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { lines } with the section's sung lines." }, 400);
      const accent = (await prefs.effective(await song.read())).pronunciation;
      const answer: LyricsCheckResponse = await this.deps.lyricsChecker.check(parsed.data.lines, accent);
      return c.json(answer);
    });

    app.post(API.lyricsStrict, async (c) => {
      const parsed = StrictRhymesSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: "Send { name, strict } with the section's name." }, 400);
      return c.json(await lyrics.setStrictRhymes(parsed.data.name, parsed.data.strict));
    });

    app.get("/api/release/file/:name", async (c) => {
      const name = basename(c.req.param("name"));
      const data = await readFile(join(song.releaseDir, name)).catch(() => null);
      if (!data) return c.json({ error: "That file is missing from the release folder." }, 404);
      return c.body(data, 200, { "Content-Type": RELEASE_CONTENT_TYPES.get(extname(name).toLowerCase()) ?? OTHER_CONTENT_TYPE });
    });

    app.get("/api/audio-deliveries/:songId/:id", async (c) => {
      try {
        const { ref, bytes, contentType } = await this.deps.deliveries.download(c.req.param("songId"), c.req.param("id"));
        return c.body(Buffer.from(bytes), 200, {
          "Content-Type": contentType,
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": attachmentFilename(ref.name),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
      } catch (error) {
        if (error instanceof AudioDeliveryError) return c.json({ error: error.message }, error.status);
        if (error instanceof z.ZodError) return c.json({ error: "Name a valid song and audio delivery." }, 400);
        if (error instanceof SongNotFoundError) return c.json({ error: error.message }, 404);
        throw error;
      }
    });


    app.put(API.mode, async (c) => {
      const parsed = ModeSchema.safeParse(await OdeServer.body(c));
      if (!parsed.success) return c.json({ error: `mode must be one of: ${Object.values(Mode).join(", ")}` }, 400);
      const mode = await prefs.setMode(parsed.data.mode);
      bus.emit({ type: "mode", mode });
      return c.json({ mode });
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


    // A refused Undo skips the result line: it answers 409 with the reason, also as a RestoreResult.
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
        lyricsProviders: ProviderCatalog.bundled.lyricsOptions(),
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
      const path = Object.hasOwn(ui, asked) ? asked : UI_INDEX;
      const file = ui[path];
      if (file === undefined) return c.text("Ode's pages are missing from this build.", 404);
      return c.body(Buffer.from(file, "base64"), 200, { "Content-Type": UI_CONTENT_TYPES.get(extname(path).toLowerCase()) ?? OTHER_CONTENT_TYPE });
    });
  }

  /** Runs an action and answers with its result, or with the reason it stayed undone (404 unknown version or song, 409 for later). */
  private async answer<T extends object>(c: Context, work: () => Promise<T>) {
    try {
      return c.json(await work());
    } catch (error) {
      if (error instanceof VersionNotFoundError || error instanceof SongNotFoundError) return c.json({ error: error.message }, 404);
      if (OdeServer.isRefusal(error)) return c.json({ error: OdeServer.messageOf(error) }, 409);
      throw error;
    }
  }

  /** Sends what is going on now to a window that just connected (questions and approvals still waiting included), then every event. */
  private eventStream(c: Context) {
    const { bus, sessions, approvals, questions, prefs } = this.deps;
    return streamSSE(c, async (stream) => {
      const mode = await prefs.mode();
      // A window closed while the mode was read is done; from here on, state and events go out back to back, so each event reaches the window once.
      if (stream.aborted) return;
      const send = (event: UiEvent) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      };
      const pending: UiEvent[] = [];
      let replaying = true;
      const unsubscribe = bus.subscribe((event) => { if (replaying) pending.push(event); else send(event); });
      stream.onAbort(unsubscribe);
      const session = sessions.current;
      const exchanges = await session.transcript();
      if (session === sessions.current) send({ type: "conversation", songId: session.songId, exchanges });
      send({ type: "busy", busy: sessions.current.isBusy, stoppable: sessions.current.isStoppable });
      send({ type: "mode", mode });
      for (const approval of approvals.pending()) send({ type: "approval", ...approval });
      for (const question of questions.pending()) send({ type: "question", ...question });
      const last = [...exchanges].reverse().find((exchange) => exchange.status !== "running");
      if (session === sessions.current && last?.reply) send({ type: "result", text: last.reply,
        versionId: last.versionId ?? null,
        kind: last.versionId ? last.status === "stopped" ? ResultKind.Stopped : ResultKind.Change : ResultKind.Reply,
      });
      replaying = false;
      for (const event of pending) send(event);
      while (!stream.aborted) {
        await stream.sleep(this.deps.config.server.keepaliveMs);
        await stream.writeSSE({ event: "keepalive", data: "" });
      }
    });
  }

  /** The request's JSON body, or null when the body is missing or invalid JSON. */
  private static body(c: Context): Promise<unknown> {
    return c.req.json().catch(() => null);
  }

  /** Refusals for this moment, with a message saying why: Ode is working, Live is unreadable, or the history refuses the action. */
  private static isRefusal(error: unknown): error is Error {
    return error instanceof RefusedError || error instanceof SessionBusyError || error instanceof SetReadError;
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
