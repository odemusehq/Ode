import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DialogView } from "../shared/config";
import { MAX_WINDOW, type MaxWindowAcknowledgement, type MaxWindowBinding, type MaxWindowBootstrap, type MaxWindowCommand, type MaxWindowConnection, type MaxWindowPoll } from "../shared/max-window";

const DISCONNECTED = "Ode's Max device is not connected. Load Ode.amxd on one track in this Set, then open Ode again.";

export class MaxWindowError extends Error {
  constructor(message: string, readonly status: 403 | 409 = 409) {
    super(message);
    this.name = "MaxWindowError";
  }
}

interface PendingOpen {
  readonly command: MaxWindowCommand;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface DeviceConnection {
  readonly binding: MaxWindowBinding;
  readonly isCurrent: () => boolean;
  bootstrap: { capability: string; expires: number } | null;
  session: { credential: string; lastPoll: number } | null;
}

/** One current-Set device, a consumed bootstrap, and bounded opens acknowledged by its actual web page. */
export class MaxWindowBridge {
  private device: DeviceConnection | null = null;
  private readonly pending = new Map<string, PendingOpen>();
  private latch = 0;

  constructor(private readonly urlForView: (view: DialogView) => string) {}

  /** Native SDK discovery supplies these controls only to the device in its current Set. */
  prepare(binding: MaxWindowBinding, isCurrent: () => boolean = () => true): MaxWindowBootstrap {
    this.invalidate();
    const capability = randomBytes(16).toString("hex");
    this.device = { binding: { ...binding }, isCurrent, bootstrap: { capability, expires: Date.now() + MAX_WINDOW.bootstrapMs }, session: null };
    this.latch = (this.latch % 65_535) + 1;
    return { capability, words: Array.from({ length: 8 }, (_, index) => parseInt(capability.slice(index * 4, index * 4 + 4), 16)), latch: this.latch };
  }

  /** A bootstrap is usable once; later polling uses a separate credential held only in Max's memory. */
  connect(capability: string): MaxWindowConnection {
    const device = this.current();
    const bootstrap = device?.bootstrap;
    if (!device || !bootstrap || Date.now() >= bootstrap.expires || !MaxWindowBridge.equal(capability, bootstrap.capability)) {
      throw new MaxWindowError(DISCONNECTED, 403);
    }
    const url = this.localUrl(DialogView.Ask);
    device.bootstrap = null;
    const session = randomBytes(24).toString("hex");
    device.session = { credential: session, lastPoll: Date.now() };
    return { session, url };
  }

  /** Consuming the bootstrap pairs the device; a stale poll lease must reconnect through native discovery. */
  get connected(): boolean {
    const device = this.current();
    if (!device?.session) return false;
    if (Date.now() - device.session.lastPoll >= MAX_WINDOW.leaseMs) {
      this.invalidate();
      return false;
    }
    return true;
  }

  poll(session: string): MaxWindowPoll {
    const device = this.authorized(session);
    device.session!.lastPoll = Date.now();
    return { command: this.pending.values().next().value?.command ?? null };
  }

  /** A native Open succeeds only after jweb reports that its page handled this exact command. */
  acknowledge(acknowledgement: MaxWindowAcknowledgement): void {
    this.authorized(acknowledgement.session);
    const pending = this.pending.get(acknowledgement.id);
    if (!pending) throw new MaxWindowError("That Ode window command is no longer waiting.");
    this.pending.delete(acknowledgement.id);
    clearTimeout(pending.timer);
    if (acknowledgement.status === "ready") pending.resolve();
    else pending.reject(new MaxWindowError("Ode's window could not open. Click Open Ode on the Max device to try again."));
  }

  open(view: DialogView): Promise<void> {
    if (!this.connected) return Promise.reject(new MaxWindowError(DISCONNECTED));
    if (this.pending.size >= MAX_WINDOW.maxPending) return Promise.reject(new MaxWindowError("Ode is already waiting for its window to open. Wait a moment, then try again."));
    const command = { id: randomUUID(), view, url: this.localUrl(view) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        reject(new MaxWindowError("Ode's Max window did not respond. Click Open Ode on the device, then try again."));
      }, MAX_WINDOW.openTimeoutMs);
      timer.unref?.();
      this.pending.set(command.id, { command, resolve, reject, timer });
    });
  }

  /** Native Set/device replacement, removal, duplicate devices and expired leases revoke every credential. */
  invalidate(): void {
    this.device = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new MaxWindowError(DISCONNECTED));
    }
    this.pending.clear();
  }

  private current(): DeviceConnection | null {
    if (!this.device) return null;
    try {
      if (this.device.isCurrent()) return this.device;
    } catch { /* Unreadable native handles revoke the connection too. */ }
    this.invalidate();
    return null;
  }

  private authorized(session: string): DeviceConnection {
    if (!this.connected || !this.device?.session || !MaxWindowBridge.equal(session, this.device.session.credential)) {
      throw new MaxWindowError(DISCONNECTED, 403);
    }
    return this.device;
  }

  private localUrl(view: DialogView): string {
    const url = this.urlForView(view);
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.port || parsed.username || parsed.password) {
      throw new MaxWindowError("Ode's local window address is unavailable.");
    }
    return url;
  }

  private static equal(value: string, expected: string): boolean {
    const given = Buffer.from(value);
    const known = Buffer.from(expected);
    return given.length === known.length && timingSafeEqual(given, known);
  }
}
