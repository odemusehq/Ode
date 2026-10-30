import { t } from "../../shared/i18n";
import { LiveDialog } from "./dialog";
import { Layout } from "./layout";

const COMMAND = "odeWindowCommand";
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

/** Max owns the floating window. The page owns saving before a requested view change. */
export class MaxWindowClient {
  private opening = false;
  private pending: string | null = null;

  constructor(private readonly save: () => Promise<boolean>, private readonly fail: (message: string) => void,
    private readonly showWorkspace: (view: Layout) => void) {}

  start(): void {
    LiveDialog.max?.bindInlet("ode_open", (view, url, id) => { void this.open(view, url, id); });
  }

  /** Called after React mounts, so Max never acknowledges an unloaded page as an open chat. */
  ready(): void {
    if (!LiveDialog.max) return;
    const url = new URL(window.location.href), id = this.pending ?? url.searchParams.get(COMMAND);
    if (!validId(id)) return;
    this.pending = null;
    this.opening = false;
    url.searchParams.delete(COMMAND);
    window.history.replaceState(null, "", url.href);
    LiveDialog.max.outlet("ode_opened", id);
  }

  private async open(view: unknown, address: unknown, id: unknown): Promise<void> {
    if (!validId(id)) return;
    const failed = (message: string) => { this.fail(message); LiveDialog.max?.outlet("ode_open_failed", id, message); };
    if (this.opening) { failed(t("app.window.alreadyChanging")); return; }
    this.opening = true;
    try {
      if (typeof address !== "string" || !Object.values(Layout).includes(view as Layout)) throw new Error("Unsupported Ode view.");
      const url = new URL(address), current = new URL(window.location.href);
      if (url.origin !== current.origin || url.protocol !== "http:" || url.pathname !== "/" || url.username || url.password || url.searchParams.get("view") !== view) {
        throw new Error("Unsupported Ode view address.");
      }
      if (!await this.save()) { failed(t("app.window.saveBeforeChanging")); return; }
      this.pending = id;
      this.showWorkspace(view as Layout);
    } catch {
      this.pending = null;
      failed(t("app.window.changeFailed"));
    } finally { if (!this.pending) this.opening = false; }
  }
}
