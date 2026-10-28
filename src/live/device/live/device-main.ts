import type { DeviceCommand, DeviceEventName, LiveRequest, LiveResponse } from "../../../shared/live";
import { DeviceOperations } from "./device-operations";
import { MasterRecorder, type MeasureRequest } from "./master-recorder";

/** Outlet the device patch connects to the network side (node.script). */
const NETWORK_OUTLET = 0;

/** The Live side of the Ode device: answers requests from the network side and sends events. */
export class OdeDevice {
  private static readonly METER_INTERVAL_MS = 250;
  private static readonly SET_CHECK_EVERY = 20;
  /** In ticks: the selection is checked twice a second. */
  private static readonly SELECTION_CHECK_EVERY = 2;
  /** What the device's Again and Undo controls send. */
  private static readonly COMMANDS: readonly DeviceCommand["name"][] = ["again", "undo"];
  private readonly operations = new DeviceOperations();
  private readonly recorder = new MasterRecorder();
  private ticker: Task | null = null;
  private ticks = 0;
  private lastSetKey = "";
  private lastSelectionKey = "";

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

  /** The Again or Undo control was pressed, with the mouse or a key or MIDI controller mapped to it in Live. */
  command(name: string): void {
    const known = OdeDevice.COMMANDS.find((command) => command === name);
    if (!known) return;
    const command: DeviceCommand = { name: known };
    this.event("command", command);
  }

  /** The network side reconnected: send the Set and the selection again so the server knows what is open. */
  hello(): void {
    this.lastSetKey = "";
    this.lastSelectionKey = "";
    this.sendSetInfo();
  }

  private tick(): void {
    this.ticks += 1;
    if (this.ticks % OdeDevice.SET_CHECK_EVERY === 0) this.sendSetInfo();
    if (this.ticks % OdeDevice.SELECTION_CHECK_EVERY === 0) this.sendSelection();
    if (this.operations.isPlaying()) this.event("meters", this.operations.meters());
  }

  private sendSetInfo(): void {
    const info = this.operations.setInfo();
    const key = JSON.stringify(info);
    if (key === this.lastSetKey) return;
    this.lastSetKey = key;
    this.event("set", info);
  }

  /** Sent when the selected track, clip or scene changes; the playhead moving on its own is not a change. */
  private sendSelection(): void {
    const selection = this.operations.selection();
    const key = JSON.stringify([selection.track, selection.clip, selection.scene]);
    if (key === this.lastSelectionKey) return;
    this.lastSelectionKey = key;
    this.event("selection", selection);
  }

  private reply(response: LiveResponse): void {
    outlet(NETWORK_OUTLET, "response", JSON.stringify(response));
  }

  private event(name: DeviceEventName, data: unknown): void {
    outlet(NETWORK_OUTLET, "event", JSON.stringify({ type: "event", name, data }));
  }
}

export const device = new OdeDevice();
