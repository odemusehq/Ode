import { LiveDialog } from "./dialog";
import { Layout } from "./layout";

const COMMAND = "odeWindowCommand";
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

/** Max owns the floating window. The page owns saving before a requested view change. */
export class MaxWindowClient {
  private opening = false;

  constructor(private readonly layout: Layout, private readonly save: () => Promise<boolean>, private readonly fail: (message: string) => void) {}

  start(): void {
    LiveDialog.max?.bindInlet("ode_open", (view, url, id) => { void this.open(view, url, id); });
  }

  /** Called after React mounts, so Max never acknowledges an unloaded page as an open chat. */
  ready(): void {
    if (!LiveDialog.max) return;
    const url = new URL(window.location.href), id = url.searchParams.get(COMMAND);
    if (!validId(id)) return;
    url.searchParams.delete(COMMAND);
    window.history.replaceState(null, "", url.href);
    LiveDialog.max.outlet("ode_opened", id);
  }

  private async open(view: unknown, address: unknown, id: unknown): Promise<void> {
    if (!validId(id)) return;
    const failed = (message: string) => { this.fail(message); LiveDialog.max?.outlet("ode_open_failed", id, message); };
    if (this.opening) { failed("Ode is already changing views. Try again when it finishes."); return; }
    this.opening = true;
    try {
      if (typeof address !== "string" || !Object.values(Layout).includes(view as Layout)) throw new Error("Unsupported Ode view.");
      const url = new URL(address), current = new URL(window.location.href);
      if (url.origin !== current.origin || url.protocol !== "http:" || url.pathname !== "/" || url.username || url.password || url.searchParams.get("view") !== view) {
        throw new Error("Unsupported Ode view address.");
      }
      if (view === this.layout) { LiveDialog.max?.outlet("ode_opened", id); return; }
      if (!await this.save()) { failed("Your draft could not be saved. Resolve the save notice before changing views."); return; }
      url.searchParams.set(COMMAND, id);
      window.location.assign(url.href);
    } catch {
      failed("Ode could not change views. Your current window stayed open.");
    } finally { this.opening = false; }
  }
}
