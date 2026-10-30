import { RackDevice, type Device, type DeviceParameter } from "@ableton-extensions/sdk";
import type { MaxWindowBridge } from "../../server/max-window";
import type { DialogView } from "../../shared/config";
import { MAX_WINDOW } from "../../shared/max-window";
import type { Live, Version } from "./sdk";

type MissingReason = "missing" | "multiple" | "unresponsive";

export class MaxWindowMissingError extends Error {
  constructor(readonly reason: MissingReason) {
    const message = reason === "multiple"
      ? "Keep one Ode Max device in this Set, then open Ode again."
      : reason === "missing"
        ? "Load Ode.amxd on one track in this Set, then click Open Ode on the device."
        : "Ode's Max device did not respond. Click Open Ode on the device, or remove it and load Ode.amxd again.";
    super(message);
    this.name = "MaxWindowMissingError";
  }
}

interface Target {
  readonly setId: bigint;
  readonly deviceId: bigint;
  readonly parameters: ReadonlyMap<string, DeviceParameter<Version>>;
}

/** Delivers a short-lived connection only through parameters belonging to this Live instance's Set. */
export class MaxWindow {
  private static readonly SCAN_MS = 1_000;
  private static readonly NATIVE_MS = 2_000;
  private target: Target | null = null;
  private reason: MissingReason = "missing";
  private preparedAt = 0;
  private cleared = false;
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scanning: Promise<void> | null = null;
  private generation = 0;

  constructor(private readonly live: Live, private readonly bridge: MaxWindowBridge, private readonly port: number) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError("Ode's local window port is unavailable.");
  }

  start(): void {
    this.stopped = false;
    if (this.timer) return;
    void this.scan();
    this.timer = setInterval(() => void this.scan(), MaxWindow.SCAN_MS);
    this.timer.unref?.();
  }

  /** Serialises discovery and bootstrap writes, including scans requested while the timer is running. */
  scan(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (!this.scanning) {
      const work = this.scanNow();
      this.scanning = work;
      const finished = () => { if (this.scanning === work) this.scanning = null; };
      void work.then(finished, finished);
    }
    return this.scanning;
  }

  async open(view: DialogView): Promise<void> {
    await this.scan();
    if (!this.target) throw new MaxWindowMissingError(this.reason);
    const deadline = Date.now() + MAX_WINDOW.leaseMs;
    while (!this.bridge.connected && Date.now() < deadline) {
      if (!this.target || !this.isCurrent(this.target)) {
        await this.scan();
        throw new MaxWindowMissingError(this.target ? "unresponsive" : this.reason);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    if (!this.bridge.connected) throw new MaxWindowMissingError("unresponsive");
    try { await this.bridge.open(view); }
    catch { throw new MaxWindowMissingError("unresponsive"); }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const old = this.target;
    this.target = null;
    this.generation++;
    this.bridge.invalidate();
    if (this.scanning) await this.scanning;
    if (old) await this.clear(old);
  }

  private async scanNow(): Promise<void> {
    let found: Target[];
    try { found = this.targets(); }
    catch { await this.unpair("unresponsive"); return; }
    if (found.length !== 1) { await this.unpair(found.length ? "multiple" : "missing"); return; }
    const next = found[0]!;
    if (!this.same(next, this.target)) {
      await this.unpair("unresponsive");
      if (this.stopped || !this.isCurrent(next)) return;
      this.target = next;
    }
    try {
      const version = await MaxWindow.bounded(next.parameters.get(MAX_WINDOW.parameterNames.signature)!.getValue());
      if (version !== MAX_WINDOW.version) { await this.unpair("missing"); return; }
      if (this.stopped || !this.isCurrent(next)) { await this.unpair("unresponsive"); return; }
      this.reason = "unresponsive";
      if (this.bridge.connected) {
        if (!this.cleared) this.cleared = await this.clear(next);
        return;
      }
      if (this.preparedAt && !this.cleared && Date.now() - this.preparedAt < MAX_WINDOW.bootstrapMs) return;
      const generation = ++this.generation;
      const bootstrap = this.bridge.prepare({ setId: next.setId.toString(), deviceId: next.deviceId.toString() }, () => this.isCurrent(next));
      this.preparedAt = Date.now();
      this.cleared = false;
      const names = MAX_WINDOW.parameterNames;
      const writes: [string, number][] = [
        [names.latch, 0], ...names.words.map((name, index): [string, number] => [name, bootstrap.words[index]!]),
        [names.port, this.port], [names.latch, bootstrap.latch],
      ];
      const deadline = Date.now() + MaxWindow.NATIVE_MS;
      for (const [name, value] of writes) {
        if (this.stopped || generation !== this.generation || !this.isCurrent(next)) throw new Error("The Ode device changed.");
        await MaxWindow.bounded(next.parameters.get(name)!.setValue(value), deadline - Date.now());
      }
    } catch { await this.unpair("unresponsive"); }
  }

  /** Every bridge request repeats this synchronous identity check before accepting credentials. */
  private isCurrent(target: Target): boolean {
    if (this.stopped) return false;
    try {
      const found = this.targets();
      return found.length === 1 && this.same(found[0]!, target);
    } catch { return false; }
  }

  private same(a: Target, b: Target | null): boolean {
    return b !== null && a.setId === b.setId && a.deviceId === b.deviceId;
  }

  /** Names and ranges identify Ode even when the musician renames it or puts it inside a rack. */
  private targets(): Target[] {
    const song = this.live.application.song;
    const setId = song.handle.id;
    const tracks = [...song.tracks, ...song.returnTracks, song.mainTrack];
    const queue = tracks.flatMap((track) => track.devices);
    const visited = new Set<bigint>();
    const found: Target[] = [];
    for (let index = 0; index < queue.length; index++) {
      const device = queue[index]!;
      if (visited.has(device.handle.id)) continue;
      visited.add(device.handle.id);
      const parameters = this.controls(device);
      if (parameters) found.push({ setId, deviceId: device.handle.id, parameters });
      if (device instanceof RackDevice) for (const chain of device.chains) queue.push(...chain.devices);
    }
    return found;
  }

  private controls(device: Device<Version>): ReadonlyMap<string, DeviceParameter<Version>> | null {
    const names = MAX_WINDOW.parameterNames;
    const expected = [names.signature, names.port, ...names.words, names.latch];
    const parameters = new Map<string, DeviceParameter<Version>>();
    for (const parameter of device.parameters) {
      if (!expected.includes(parameter.name)) continue;
      if (parameters.has(parameter.name) || parameter.isQuantized || parameter.min !== 0 || parameter.max !== (parameter.name === names.signature ? 1 : 65535)) return null;
      parameters.set(parameter.name, parameter);
    }
    return parameters.size === expected.length ? parameters : null;
  }

  private async unpair(reason: MissingReason): Promise<void> {
    const old = this.target;
    this.target = null;
    this.reason = reason;
    this.preparedAt = 0;
    this.cleared = false;
    this.generation++;
    this.bridge.invalidate();
    if (old) await this.clear(old);
  }

  private async clear(target: Target): Promise<boolean> {
    const names = MAX_WINDOW.parameterNames;
    try {
      // A positive latch commits a complete bootstrap. Lower it before changing any part of that bootstrap.
      await MaxWindow.bounded(Promise.resolve().then(() => target.parameters.get(names.latch)!.setValue(0)));
      const controls = [names.port, ...names.words];
      const cleared = await MaxWindow.bounded(Promise.allSettled(controls.map((name) => Promise.resolve().then(() => target.parameters.get(name)!.setValue(0)))));
      return cleared.every((result) => result.status === "fulfilled");
    } catch { return false; }
  }

  private static bounded<T>(work: Promise<T>, timeout = MaxWindow.NATIVE_MS): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Live did not answer the window connection request.")), Math.max(1, timeout));
      work.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
    });
  }
}
