import type { UiEvent } from "../../shared/events";
import { UI_CONFIG } from "./config";
import { StreamState } from "./model";

export interface EventStreamListener {
  onEvent(event: UiEvent): void;
  onState(state: StreamState): void;
  /** Called each time the stream opens, so missed state can be fetched again. */
  onOpen(): void;
}

/** The server's event stream, reconnecting with growing waits when it closes. */
export class EventStream {
  private readonly url: string;
  private readonly listener: EventStreamListener;
  private source: EventSource | null = null;
  private retryTimer: number | undefined;
  private retryDelayMs: number = UI_CONFIG.reconnectInitialMs;
  private running = false;
  private retrying = false;

  constructor(url: string, listener: EventStreamListener) {
    this.url = url;
    this.listener = listener;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.retryTimer);
    this.source?.close();
    this.source = null;
    this.listener.onState(StreamState.Closed);
  }

  private connect(): void {
    this.listener.onState(this.retrying ? StreamState.Reconnecting : StreamState.Connecting);
    const source = new EventSource(this.url);
    source.onopen = () => this.handleOpen();
    source.onmessage = (message: MessageEvent<string>) => this.handleMessage(message.data);
    source.onerror = () => this.handleError(source);
    this.source = source;
  }

  private handleOpen(): void {
    this.retrying = false;
    this.retryDelayMs = UI_CONFIG.reconnectInitialMs;
    this.listener.onState(StreamState.Open);
    this.listener.onOpen();
  }

  private handleMessage(data: string): void {
    const event = parseEvent(data);
    if (event) this.listener.onEvent(event);
  }

  private handleError(source: EventSource): void {
    this.retrying = true;
    if (source.readyState !== EventSource.CLOSED) {
      this.listener.onState(StreamState.Reconnecting);
      return;
    }
    source.close();
    this.source = null;
    this.listener.onState(StreamState.Closed);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(delay * 2, UI_CONFIG.reconnectMaxMs);
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }
}

function parseEvent(data: string): UiEvent | null {
  if (!data) return null;
  try {
    const value: unknown = JSON.parse(data);
    return isUiEvent(value) ? value : null;
  } catch {
    return null;
  }
}

function isUiEvent(value: unknown): value is UiEvent {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}
