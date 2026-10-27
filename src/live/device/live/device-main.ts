import type { LiveRequest, LiveResponse } from "../../../shared/live";
import { DeviceOperations } from "./device-operations";
import { MasterRecorder, type MeasureRequest } from "./master-recorder";

/** Outlet the device patch connects to the network side (node.script). */
const NETWORK_OUTLET = 0;

/** The Live side of the Ode device: answers requests from the network side and sends events. */
export class OdeDevice {
  private static readonly METER_INTERVAL_MS = 250;
  private static readonly SET_CHECK_EVERY = 20;
  private readonly operations = new DeviceOperations();
  private readonly recorder = new MasterRecorder();
  private ticker: Task | null = null;
  private ticks = 0;
  private lastSetKey = "";

  /** Called when live.thisdevice reports the device is ready to use the Live API. */
  start(): void {
    this.sendSetInfo();
    this.ticker = new Task(() => this.tick(), this);
    this.ticker.interval = OdeDevice.METER_INTERVAL_MS;
    this.ticker.repeat();
  }

  request(json: string): void {
    const request = JSON.parse(json) as LiveRequest;
    try {
      if (request.op === "master_measure") {
        this.recorder.measure(request.args as MeasureRequest, (result) => this.reply({ id: request.id, ok: true, result }));
        return;
      }
      this.reply({ id: request.id, ok: true, result: this.operations.run(request.op, request.args) });
    } catch (error) {
      this.reply({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** The network side reconnected: send the Set again so the server knows which song is open. */
  hello(): void {
    this.lastSetKey = "";
    this.sendSetInfo();
  }

  private tick(): void {
    this.ticks += 1;
    if (this.ticks % OdeDevice.SET_CHECK_EVERY === 0) this.sendSetInfo();
    if (this.operations.isPlaying()) this.event("meters", this.operations.meters());
  }

  private sendSetInfo(): void {
    const info = this.operations.setInfo();
    const key = JSON.stringify(info);
    if (key === this.lastSetKey) return;
    this.lastSetKey = key;
    this.event("set", info);
  }

  private reply(response: LiveResponse): void {
    outlet(NETWORK_OUTLET, "response", JSON.stringify(response));
  }

  private event(name: "set" | "meters", data: unknown): void {
    outlet(NETWORK_OUTLET, "event", JSON.stringify({ type: "event", name, data }));
  }
}

export const device = new OdeDevice();
