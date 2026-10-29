import { execFile } from "node:child_process";
import { platform } from "node:os";

interface BrowserCommand { file: string; args: string[] }

/** The SDK has modal webviews only. Ode's existing local page can stay open in an ordinary browser. */
export class BrowserWindow {
  static command(url: string, system: string = platform()): BrowserCommand | null {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.port || parsed.username || parsed.password) {
      throw new Error("Ode opens only its local browser page.");
    }
    if (system === "darwin") return { file: "/usr/bin/open", args: [url] };
    if (system === "win32") return { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] };
    return null;
  }

  /** A failed or unavailable OS opener leaves a copyable URL instead of running chat in a modal webview. */
  static async open(url: string): Promise<boolean> {
    const command = BrowserWindow.command(url);
    if (!command) return false;
    return new Promise((resolve) => {
      execFile(command.file, command.args, { timeout: 5000, windowsHide: true }, (error) => resolve(error === null));
    });
  }
}
