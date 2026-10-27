import { API } from "../../shared/api";
import type {
  ApprovalRequest,
  ArtistFact,
  ChatRequest,
  HistoryEntry,
  LeadSheet,
  LiveReadRequest,
  LyricsAnalysis,
  LyricsAnalyzeRequest,
  MemoryAdd,
  PreferencesResponse,
  PreferencesUpdate,
  ReleaseResponse,
  StatusResponse,
} from "../../shared/api";
import type { DeviceOpArgs, DeviceOpResults, ExtensionOpArgs, ExtensionOpResults } from "../../shared/live-ops";

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

export interface OkResponse {
  ok: boolean;
}

/** Read-only Live operations the UI may call. */
export type UiReadOp = LiveReadRequest["op"];
export type UiReadArgs = { [Op in UiReadOp]: (ExtensionOpArgs & DeviceOpArgs)[Op] };
export type UiReadResults = { [Op in UiReadOp]: (ExtensionOpResults & DeviceOpResults)[Op] };

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Plain-language message for anything thrown by a request. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Typed access to every route of the local server. */
export class OdeApi {
  chat(request: ChatRequest): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.chat, request);
  }

  stop(): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.stop);
  }

  decide(id: string, request: ApprovalRequest): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.approval(id), request);
  }

  getSong(): Promise<LeadSheet> {
    return this.request(HttpMethod.Get, API.song);
  }

  saveSong(leadSheet: LeadSheet): Promise<LeadSheet> {
    return this.request(HttpMethod.Put, API.song, leadSheet);
  }

  getHistory(): Promise<HistoryEntry[]> {
    return this.request(HttpMethod.Get, API.history);
  }

  getPreferences(): Promise<PreferencesResponse> {
    return this.request(HttpMethod.Get, API.preferences);
  }

  savePreferences(update: PreferencesUpdate): Promise<PreferencesResponse> {
    return this.request(HttpMethod.Put, API.preferences, update);
  }

  getMemory(): Promise<ArtistFact[]> {
    return this.request(HttpMethod.Get, API.memory);
  }

  addMemory(item: MemoryAdd): Promise<ArtistFact> {
    return this.request(HttpMethod.Post, API.memory, item);
  }

  deleteMemory(id: string): Promise<OkResponse> {
    return this.request(HttpMethod.Delete, API.memoryItem(id));
  }

  analyzeLyrics(request: LyricsAnalyzeRequest): Promise<LyricsAnalysis> {
    return this.request(HttpMethod.Post, API.lyricsAnalyze, request);
  }

  getStatus(): Promise<StatusResponse> {
    return this.request(HttpMethod.Get, API.status);
  }

  getRelease(): Promise<ReleaseResponse> {
    return this.request(HttpMethod.Get, API.release);
  }

  releaseFileUrl(name: string): string {
    return API.releaseFile(name);
  }

  async getReleaseText(name: string): Promise<string> {
    const response = await fetch(API.releaseFile(name));
    if (!response.ok) throw new ApiError(response.status, await readError(response));
    return response.text();
  }

  liveRead<Op extends UiReadOp>(op: Op, args: UiReadArgs[Op]): Promise<UiReadResults[Op]> {
    const request: LiveReadRequest = { op, args };
    return this.request(HttpMethod.Post, API.liveRead, request);
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new ApiError(response.status, await readError(response));
    return (await response.json()) as T;
  }
}

async function readError(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      if ("error" in parsed && typeof parsed.error === "string") return parsed.error;
      if ("message" in parsed && typeof parsed.message === "string") return parsed.message;
    }
  } catch {
    return text;
  }
  return fallback;
}
