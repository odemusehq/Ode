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
}

/** The Live dialog a page runs in: WebKit's message handler on macOS, WebView2's on Windows. */
export class LiveDialog {
  /** True when the page runs inside a Live dialog, false in a plain browser. */
  static get hosted(): boolean {
    const host = window as unknown as WebKitHost;
    return Boolean(host.webkit?.messageHandlers?.live ?? host.chrome?.webview);
  }

  /** Closes the dialog and hands Live the result. */
  static close(result: DialogResult): void {
    const host = window as unknown as WebKitHost;
    const message: HostMessage = { method: "close_and_send", params: [result] };
    const webkit = host.webkit?.messageHandlers?.live;
    if (webkit) webkit.postMessage(message);
    else host.chrome?.webview?.postMessage(message);
  }
}
