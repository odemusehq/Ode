import type { Ui } from "@ableton-extensions/sdk";
import { OdeConfig } from "../../shared/config";
import { describeError } from "./errors";
import type { Version } from "./sdk";

/** A small dialog that tells the musician something, with a Close button. */
export class Notice {
  constructor(private readonly ui: Ui<Version>) {}

  async show(title: string, message: string): Promise<void> {
    try {
      const page = `data:text/html,${encodeURIComponent(Notice.page(title, message))}`;
      await this.ui.showModalDialog(page, OdeConfig.notice.width, OdeConfig.notice.height);
    } catch (error) {
      console.error(`Ode could not show "${title}": ${describeError(error)}`);
    }
  }

  private static page(title: string, message: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${Notice.escape(title)}</title>
<style>
  body { margin: 0; height: 100vh; box-sizing: border-box; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px;
         background: #2f2f2f; color: #e6e6e6; font: 13px/1.45 -apple-system, "Segoe UI", sans-serif; }
  h1 { margin: 0; font-size: 14px; font-weight: 600; }
  p { margin: 0; flex: 1; color: #cfcfcf; }
  button { align-self: flex-end; min-width: 80px; padding: 5px 14px; border: 0; border-radius: 3px;
           background: #f2b233; color: #1c1c1c; font: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid #8fc8ff; outline-offset: 2px; }
</style>
</head>
<body>
<h1>${Notice.escape(title)}</h1>
<p>${Notice.escape(message)}</p>
<button id="close" autofocus>Close</button>
<script>
  function closeDialog() {
    const message = { method: "close_and_send", params: [""] };
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.live) {
      window.webkit.messageHandlers.live.postMessage(message);
    } else if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(message);
    }
  }
  document.getElementById("close").addEventListener("click", closeDialog);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); });
</script>
</body>
</html>`;
  }

  private static escape(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
