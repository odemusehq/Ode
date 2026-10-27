import { LIVE_SOCKET_PATHS, type LiveRequest, type LiveResponse } from "../../shared/live";
import { describeError } from "./errors";
import type { OperationRegistry } from "./ops/registry";
import type { ServerSettings } from "./settings";

enum ConnectionState {
  Starting = "starting",
  Connected = "connected",
  Waiting = "waiting",
}

/**
 * The WebSocket to Ode's server. Ode sends operations as requests; the extension runs each one
 * and answers with its result or its error. When the connection drops, it reconnects, waiting
 * twice as long after each failed try.
 */
export class OdeConnection {
  private static readonly FIRST_RETRY_MS = 1_000;
  private static readonly LONGEST_RETRY_MS = 30_000;

  private socket: WebSocket | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryDelay = OdeConnection.FIRST_RETRY_MS;
  private state = ConnectionState.Starting;

  constructor(
    private readonly settings: ServerSettings,
    private readonly operations: OperationRegistry,
  ) {}

  start(): void {
    void this.connect();
  }

  private async connect(): Promise<void> {
    this.retryTimer = null;
    try {
      const url = (await this.settings.address()).socketUrl(LIVE_SOCKET_PATHS.extension);
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
      socket.addEventListener("open", () => this.onOpen(socket, url));
      socket.addEventListener("message", (event) => this.onMessage(socket, event));
      socket.addEventListener("close", () => this.onClose(socket, url));
      this.socket = socket;
    } catch (error) {
      console.error(`Ode could not open its connection: ${describeError(error)}`);
      this.retryLater();
    }
  }

  private onOpen(socket: WebSocket, url: string): void {
    if (socket !== this.socket) return;
    this.state = ConnectionState.Connected;
    this.retryDelay = OdeConnection.FIRST_RETRY_MS;
    console.log(`Connected to Ode at ${url}`);
  }

  private onMessage(socket: WebSocket, event: MessageEvent): void {
    const request = OdeConnection.parse(event.data);
    if (!request) return;
    void this.operations.respond(request).then((response) => OdeConnection.send(socket, response));
  }

  private onClose(socket: WebSocket, url: string): void {
    if (socket !== this.socket) return;
    this.socket = null;
    if (this.state === ConnectionState.Connected) console.log("Lost the connection to Ode; reconnecting");
    else if (this.state === ConnectionState.Starting) console.log(`Waiting for Ode's server at ${url}`);
    this.state = ConnectionState.Waiting;
    this.retryLater();
  }

  private retryLater(): void {
    if (this.retryTimer) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(delay * 2, OdeConnection.LONGEST_RETRY_MS);
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private static send(socket: WebSocket, response: LiveResponse): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(response));
    } catch (error) {
      console.error(`Ode could not send the result of request ${response.id}: ${describeError(error)}`);
    }
  }

  private static parse(data: unknown): LiveRequest | null {
    const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : null;
    if (text === null) return null;
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      console.error("Ode ignored a message from its server that is not valid JSON");
      return null;
    }
    const { id, op } = (message ?? {}) as Partial<LiveRequest>;
    if (typeof id !== "string" || typeof op !== "string") return null;
    return message as LiveRequest;
  }
}
