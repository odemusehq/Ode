/** What a dialog page sends Live when it closes. */
export enum DialogResult {
  Done = "done",
  Cancelled = "cancelled",
}

interface HostMessage {
  method: "close_and_send";
  params: [string];
}

interface WebKitHost {
  webkit?: { messageHandlers?: { live?: { postMessage(message: HostMessage): void } } };
  chrome?: { webview?: { postMessage(message: HostMessage): void } };
  max?: MaxHost;
}

export interface MaxHost {
  bindInlet(name: string, callback: (...args: unknown[]) => void): void;
  outlet(...args: (string | number)[]): void;
}

/** The Live dialog a page runs in: WebKit's message handler on macOS, WebView2's on Windows. */
export class LiveDialog {
  /** True when the page runs inside a Live dialog, false in a plain browser. */
  static get hosted(): boolean {
    return LiveDialog.modal || LiveDialog.max !== null;
  }

  /** SDK dialogs block Live; the Max window can close while the agent continues. */
  static get modal(): boolean {
    const host = window as unknown as WebKitHost;
    return Boolean(host.webkit?.messageHandlers?.live ?? host.chrome?.webview);
  }

  static get max(): MaxHost | null {
    const host = (window as unknown as WebKitHost).max;
    return typeof host?.bindInlet === "function" && typeof host.outlet === "function" ? host : null;
  }

  /** Closes the dialog and hands Live the result. */
  static close(result: DialogResult): void {
    if (LiveDialog.max) { LiveDialog.max.outlet("ode_close"); return; }
    const host = window as unknown as WebKitHost;
    const message: HostMessage = { method: "close_and_send", params: [result] };
    const webkit = host.webkit?.messageHandlers?.live;
    if (webkit) webkit.postMessage(message);
    else host.chrome?.webview?.postMessage(message);
  }
}
