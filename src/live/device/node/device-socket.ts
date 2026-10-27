import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import maxApi from "max-api";
import type { LiveRequest } from "../../../shared/live";

/** The network side of the Ode device: a WebSocket to Ode's server, relaying to the device's Live side. */
export class DeviceSocket {
  private static readonly MIN_RETRY_MS = 1000;
  private static readonly MAX_RETRY_MS = 30_000;
  private socket: WebSocket | null = null;
  private retryMs = DeviceSocket.MIN_RETRY_MS;
  private readonly measureDir = join(tmpdir(), "ode");

  constructor(private readonly url: string) {}

  start(): void {
    mkdirSync(this.measureDir, { recursive: true });
    maxApi.addHandler("response", (json) => this.send(String(json)));
    maxApi.addHandler("event", (json) => this.send(String(json)));
    this.connect();
  }

  private connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.retryMs = DeviceSocket.MIN_RETRY_MS;
      void maxApi.outlet("hello");
    });
    socket.addEventListener("message", (event) => this.relay(String(event.data)));
    socket.addEventListener("close", () => this.reconnectLater());
    socket.addEventListener("error", () => socket.close());
  }

  private relay(json: string): void {
    const request = JSON.parse(json) as LiveRequest;
    if (request.op === "master_measure") {
      request.args = { ...(request.args as object), path: join(this.measureDir, `master-${request.id}.wav`) };
    }
    void maxApi.outlet("request", JSON.stringify(request));
  }

  private send(json: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(json);
  }

  private reconnectLater(): void {
    this.socket = null;
    setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(DeviceSocket.MAX_RETRY_MS, this.retryMs * 2);
  }
}

new DeviceSocket(process.env.ODE_DEVICE_SOCKET_URL ?? "").start();
