import { readdir, readFile, stat } from "node:fs/promises";
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
  UI_READ_OPS,
  type ApprovalRequest,
  type ChatRequest,
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
import type { Accent } from "../shared/personalisation";
import type { Mneme } from "../mneme/artist";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongStore } from "../mneme/song-store";
import type { Services } from "../services/types";
import { Decision, type Approvals } from "../harness/approvals";
import type { SessionManager } from "../harness/session-manager";
import type { EventBus } from "./event-bus";
import type { LiveHub, SocketLink } from "./live-hub";
import type { PointerState } from "./pointer";

export interface ServerDeps {
  config: OdeConfig;
  bus: EventBus;
  live: LiveHub;
  song: SongStore;
  mneme: Mneme;
  prefs: PreferencesStore;
  services: Services;
  approvals: Approvals;
  sessions: SessionManager;
  pointer: PointerState;
  analyzeLyrics: (lines: string[], accent: Accent) => LyricsAnalysis;
}

/** The local HTTP server: the UI's API and event stream, the Live parts' sockets, and the built UI. */
export class OdeServer {
  private static readonly KEEPALIVE_MS = 15_000;
  private static readonly HISTORY_LIMIT = 200;
  private readonly app = new Hono();
  private readonly sockets = createNodeWebSocket({ app: this.app });

  constructor(private readonly deps: ServerDeps) {}

  start(): ServerType {
    this.routeLiveSockets();
    this.routeApi();
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
    const { bus, live, song, mneme, prefs, approvals, sessions, pointer, services, analyzeLyrics } = this.deps;

    app.post(API.chat, async (c) => {
      const { text } = await c.req.json<ChatRequest>();
      void sessions.current.send(text);
      return c.json({ ok: true });
    });

    app.post(API.stop, (c) => {
      sessions.current.stop();
      return c.json({ ok: true });
    });

    app.get(API.events, (c) => this.eventStream(c));

    app.post("/api/approvals/:id", async (c) => {
      const { decision, always } = await c.req.json<ApprovalRequest>();
      const known = await approvals.decide(c.req.param("id"), decision === "allow" ? Decision.Allow : Decision.Deny, always);
      return known ? c.json({ ok: true }) : c.json({ error: "No such approval" }, 404);
    });

    app.get(API.song, async (c) => c.json(await song.read()));
    app.put(API.song, async (c) => c.json(await song.replace(LeadSheetSchema.parse(await c.req.json()))));
    app.get(API.history, async (c) => c.json(await song.readHistory(OdeServer.HISTORY_LIMIT)));

    app.get(API.preferences, async (c) => c.json(await this.preferences()));
    app.put(API.preferences, async (c) => {
      await prefs.update(await c.req.json<PreferencesUpdate>());
      return c.json(await this.preferences());
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

    app.get(API.status, (c) => {
      const status: StatusResponse = {
        live: live.status(),
        roles: services.available(),
        projectDir: song.projectDir,
        busy: sessions.current.isBusy,
      };
      return c.json(status);
    });

    app.get(API.release, async (c) => c.json({ files: await this.releaseFiles() }));
    app.get("/api/release/file/:name", async (c) => {
      const name = basename(c.req.param("name"));
      const data = await readFile(join(song.releaseDir, name)).catch(() => null);
      return data ? c.body(data) : c.json({ error: "Not found" }, 404);
    });

    app.post(API.livePointer, async (c) => {
      const received = await c.req.json<LivePointer>();
      pointer.set(received);
      bus.emit({ type: "pointer", pointer: received });
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
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 503);
      }
    });

    app.get(API.livePending, (c) => c.json(live.extension.takeQueue()));
    app.post(API.liveResults, async (c) => {
      live.extension.storeResults(await c.req.json<LiveResponse[]>());
      return c.json({ ok: true });
    });
  }

  private routeUi(): void {
    const root = relative(process.cwd(), join(this.deps.config.repoDir, "dist", "ui"));
    this.app.use("/*", serveStatic({ root }));
    this.app.get("*", serveStatic({ path: join(root, "index.html") }));
  }

  private eventStream(c: Context) {
    const { bus, live, sessions } = this.deps;
    return streamSSE(c, async (stream) => {
      const send = (event: UiEvent) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      };
      send({ type: "live-status", status: live.status() });
      send({ type: "busy", busy: sessions.current.isBusy });
      for (const approval of this.deps.approvals.pending()) send({ type: "approval", ...approval });
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
}
