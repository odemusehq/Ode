import { API } from "../../shared/api";
import type { LivePointer, LiveRequest, LiveResponse } from "../../shared/live";
import type { ServerSettings } from "./settings";

/** Ode's server did not answer. */
export class ServerUnavailableError extends Error {}

/** The musician cancelled while the extension was waiting for Ode's server. */
export class CancelledError extends Error {}

enum HttpMethod {
  Get = "GET",
  Post = "POST",
}

/** Ode's local server, reached over HTTP from right-click actions. */
export class OdeServer {
  private static readonly TIMEOUT_MS = 10_000;

  constructor(private readonly settings: ServerSettings) {}

  async sendPointer(pointer: LivePointer): Promise<void> {
    const response = await this.request(HttpMethod.Post, API.livePointer, pointer);
    await response.body?.cancel();
  }

  /** Takes the changes Ode queued while the connection was closed; Ode forgets them once sent. */
  async takePendingChanges(signal: AbortSignal): Promise<LiveRequest[]> {
    const response = await this.request(HttpMethod.Get, API.livePending, undefined, signal);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error("Ode sent the waiting changes in a form this extension doesn't understand");
    return body as LiveRequest[];
  }

  async sendResults(responses: readonly LiveResponse[]): Promise<void> {
    const response = await this.request(HttpMethod.Post, API.liveResults, responses);
    await response.body?.cancel();
  }

  private async request(method: HttpMethod, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    const url = (await this.settings.address()).httpUrl(path);
    const timeout = AbortSignal.timeout(OdeServer.TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw new CancelledError("cancelled");
      throw new ServerUnavailableError(`Ode's server didn't answer at ${url}`, { cause: error });
    }
    if (!response.ok) throw new Error(`Ode's server answered ${response.status} to ${method} ${path}`);
    return response;
  }
}
