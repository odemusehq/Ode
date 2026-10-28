import { randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import type { WSContext } from "hono/ws";
import type { DeviceCommand, DeviceEventName, LiveConnections, LiveLink, LiveRequest, LiveResponse, LiveStatus } from "../shared/live";
import type { SelectionInfo, SetInfo } from "../shared/live-ops";
import type { LiveTimeouts } from "../shared/config";

export class NotConnectedError extends Error {}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/** Requests waiting for an answer, matched by id. */
class PendingCalls {
  private readonly calls = new Map<string, PendingCall>();

  add(id: string, op: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.calls.delete(id);
        reject(new Error(`Live did not answer "${op}" within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      this.calls.set(id, { resolve, reject, timer });
    });
  }

  settle(response: LiveResponse): void {
    const call = this.calls.get(response.id);
    if (!call) return;
    this.calls.delete(response.id);
    clearTimeout(call.timer);
    if (response.ok) call.resolve(response.result);
    else call.reject(new Error(response.error ?? "Live reported an error"));
  }

  rejectAll(error: Error): void {
    for (const [id, call] of this.calls) {
      clearTimeout(call.timer);
      call.reject(error);
      this.calls.delete(id);
    }
  }
}

/** Operations that need a long timeout: rendering audio, measuring the Master, big groups and reading the whole Set. */
const LONG_OPS: ReadonlySet<string> = new Set(["render_track_audio", "master_measure", "apply_as_one_undo_step", "set_snapshot"]);

interface DeviceEvent {
  type: "event";
  name: DeviceEventName;
  data: unknown;
}

/** A Live part connected to the server over a WebSocket (the extension or the Ode device). */
export class SocketLink implements LiveLink {
  protected socket: WSContext | null = null;
  protected readonly pending = new PendingCalls();

  constructor(
    /** The part's name, e.g. "Ode extension". */
    readonly label: string,
    /** What the musician does to connect it, in plain words. */
    readonly fix: string,
    protected readonly timeouts: LiveTimeouts,
    private readonly onEvent: (event: DeviceEvent) => void = () => undefined,
  ) {}

  attach(socket: WSContext): void {
    this.socket = socket;
  }

  detach(socket: WSContext): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.pending.rejectAll(this.notConnected());
  }

  connected(): boolean {
    return this.socket !== null;
  }

  receive(raw: string): void {
    const message = JSON.parse(raw) as LiveResponse | DeviceEvent;
    if ("type" in message && message.type === "event") this.onEvent(message);
    else this.pending.settle(message as LiveResponse);
  }

  async call<R = unknown>(op: string, args: unknown, timeoutMs?: number): Promise<R> {
    if (!this.socket) throw this.notConnected();
    const request: LiveRequest = { id: randomUUID(), op, args: args ?? {} };
    this.socket.send(JSON.stringify(request));
    return (await this.pending.add(request.id, op, timeoutMs ?? this.timeoutFor(op))) as R;
  }

  protected timeoutFor(op: string): number {
    return LONG_OPS.has(op) ? this.timeouts.long : this.timeouts.normal;
  }

  protected notConnected(): NotConnectedError {
    return new NotConnectedError(`not connected: ${this.label}. ${this.fix}`);
  }
}

export interface QueuedChange {
  queued: true;
  message: string;
}

/**
 * The extension. When its connection is closed, changes are queued until the musician
 * right-clicks "Ode: Apply changes" in Live; reads still need a live connection.
 */
export class ExtensionLink extends SocketLink {
  private readonly queue: LiveRequest[] = [];
  private readonly results: LiveResponse[] = [];

  override async call<R = unknown>(op: string, args: unknown, timeoutMs?: number): Promise<R> {
    if (this.connected() || ExtensionLink.isRead(op)) return super.call<R>(op, args, timeoutMs);
    this.queue.push({ id: randomUUID(), op, args: args ?? {} });
    const queued: QueuedChange = {
      queued: true,
      message: 'Queued: in Live, right-click a track and choose "Ode: Apply changes" to apply it.',
    };
    return queued as R;
  }

  takeQueue(): LiveRequest[] {
    return this.queue.splice(0, this.queue.length);
  }

  storeResults(responses: LiveResponse[]): void {
    this.results.push(...responses);
  }

  private static isRead(op: string): boolean {
    return (
      op.endsWith("_get") ||
      op === "midi_clip_get_notes" ||
      op === "render_track_audio" ||
      op === "import_into_project" ||
      op === "set_snapshot"
    );
  }
}

/** The Python bridge inside Live: JSON lines over TCP. */
export class BridgeLink implements LiveLink {
  readonly fix = "In Live's settings (Link, Tempo & MIDI), choose Ode as a Control Surface.";
  private socket: Socket | null = null;
  private buffer = "";
  private readonly pending = new PendingCalls();

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeouts: LiveTimeouts,
  ) {}

  connected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  async probe(): Promise<void> {
    await this.ensure().catch(() => undefined);
  }

  async call<R = unknown>(op: string, args: unknown, timeoutMs?: number): Promise<R> {
    const socket = await this.ensure().catch(() => {
      throw new NotConnectedError(`not connected: Ode bridge. ${this.fix}`);
    });
    const request: LiveRequest = { id: randomUUID(), op, args: args ?? {} };
    socket.write(`${JSON.stringify(request)}\n`);
    return (await this.pending.add(request.id, op, timeoutMs ?? this.timeouts.normal)) as R;
  }

  private ensure(): Promise<Socket> {
    if (this.connected()) return Promise.resolve(this.socket!);
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      socket.setEncoding("utf8");
      socket.once("connect", () => {
        this.socket = socket;
        resolve(socket);
      });
      socket.once("error", (error) => {
        if (this.socket !== socket) reject(error);
      });
      socket.on("data", (chunk: string) => this.read(chunk));
      socket.on("close", () => {
        if (this.socket === socket) this.socket = null;
        this.pending.rejectAll(new NotConnectedError("not connected: Ode bridge closed the connection."));
      });
    });
  }

  private read(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) this.pending.settle(JSON.parse(line) as LiveResponse);
      newline = this.buffer.indexOf("\n");
    }
  }
}

export interface LiveHubEvents {
  onSetInfo: (info: SetInfo) => void;
  onStatus: (status: LiveStatus) => void;
  /** The musician selected another track, clip or scene in Live. */
  onSelection?: (selection: SelectionInfo) => void;
  /** The device's Again or Undo control was pressed (or the key or pad mapped to it). */
  onCommand?: (command: DeviceCommand) => void;
}

/** The server's connections to Live: extension, Ode device and Python bridge. */
export class LiveHub implements LiveConnections {
  private static readonly BRIDGE_PROBE_MS = 5000;

  readonly extension: ExtensionLink;
  readonly device: SocketLink;
  readonly bridge: BridgeLink;
  private setFilePath: string | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  private lastStatus = "";

  constructor(host: string, bridgePort: number, timeouts: LiveTimeouts, private readonly events: LiveHubEvents) {
    this.extension = new ExtensionLink("Ode extension", "Open the Live beta with Developer Mode on and start the Ode extension.", timeouts);
    this.device = new SocketLink("Ode device", "Put the Ode device on the Master track.", timeouts, (event) => this.onDeviceEvent(event));
    this.bridge = new BridgeLink(host, bridgePort, timeouts);
  }

  start(): void {
    this.probeTimer = setInterval(() => {
      void this.bridge.probe().then(() => this.publishStatus());
    }, LiveHub.BRIDGE_PROBE_MS);
  }

  stop(): void {
    if (this.probeTimer) clearInterval(this.probeTimer);
  }

  status(): LiveStatus {
    return {
      extension: this.extension.connected(),
      device: this.device.connected(),
      bridge: this.bridge.connected(),
      setFilePath: this.setFilePath,
    };
  }

  /** Call after a connection opens or closes. */
  publishStatus(): void {
    const status = this.status();
    const key = JSON.stringify(status);
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.events.onStatus(status);
  }

  private onDeviceEvent(event: DeviceEvent): void {
    if (event.name === "set") {
      const info = event.data as SetInfo;
      this.setFilePath = info.filePath;
      this.events.onSetInfo(info);
      this.publishStatus();
    } else if (event.name === "selection") {
      this.events.onSelection?.(event.data as SelectionInfo);
    } else if (event.name === "command") {
      this.events.onCommand?.(event.data as DeviceCommand);
    }
  }
}
