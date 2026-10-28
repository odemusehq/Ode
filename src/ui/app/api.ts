import { API } from "../../shared/api";
import type {
  ApprovalRequest,
  ArtistFact,
  ChatRequest,
  CopyResult,
  CoverChoice,
  LeadSheet,
  LiveReadRequest,
  LyricsAnalysis,
  LyricsAnalyzeRequest,
  MelodyRequest,
  MelodySetting,
  MemoryAdd,
  ModeRequest,
  PreferencesResponse,
  PreferencesUpdate,
  QuestionAnswer,
  ReleaseResponse,
  RestoreRequest,
  RestoreResult,
  StatusResponse,
  Suggestion,
  VersionDetail,
  VersionListItem,
  VersionNameRequest,
} from "../../shared/api";
import type { DeviceOpArgs, DeviceOpResults, ExtensionOpArgs, ExtensionOpResults } from "../../shared/live-ops";
import type { Mode } from "../../shared/personalisation";

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

const JSON_TYPE = "application/json";
const WAV_TYPE = "audio/wav";

export interface OkResponse {
  ok: boolean;
}

export interface ModeResponse {
  mode: Mode;
}

export interface SpeechResponse {
  /** What the musician said, in words; the server also sends it to Ode as a request. */
  text: string;
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

  answer(id: string, request: QuestionAnswer): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.question(id), request);
  }

  undo(): Promise<RestoreResult> {
    return this.request(HttpMethod.Post, API.undo);
  }

  again(): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.again);
  }

  getSuggestions(): Promise<Suggestion[]> {
    return this.request(HttpMethod.Get, API.suggestions);
  }

  setMode(request: ModeRequest): Promise<ModeResponse> {
    return this.request(HttpMethod.Put, API.mode, request);
  }

  /** Sends a mono WAV of the musician speaking; the server writes it down and sends it to Ode. */
  async speech(wav: Blob): Promise<SpeechResponse> {
    const response = await fetch(API.speech, { method: HttpMethod.Post, headers: { "Content-Type": WAV_TYPE }, body: wav });
    if (!response.ok) throw new ApiError(response.status, await readError(response));
    return (await response.json()) as SpeechResponse;
  }

  getVersions(): Promise<VersionListItem[]> {
    return this.request(HttpMethod.Get, API.versions);
  }

  getVersion(id: string): Promise<VersionDetail> {
    return this.request(HttpMethod.Get, API.version(id));
  }

  /** Restoring deletes the versions after this one; call it only after the musician confirmed. */
  restoreVersion(id: string): Promise<RestoreResult> {
    const request: RestoreRequest = { confirmed: true };
    return this.request(HttpMethod.Post, API.versionRestore(id), request);
  }

  nameVersion(id: string, request: VersionNameRequest): Promise<VersionListItem> {
    return this.request(HttpMethod.Post, API.versionName(id), request);
  }

  copyVersion(id: string): Promise<CopyResult> {
    return this.request(HttpMethod.Post, API.versionCopy(id));
  }

  getSong(): Promise<LeadSheet> {
    return this.request(HttpMethod.Get, API.song);
  }

  saveSong(leadSheet: LeadSheet): Promise<LeadSheet> {
    return this.request(HttpMethod.Put, API.song, leadSheet);
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

  /** A section's lines under the notes of the clip selected in Live. */
  setToMelody(request: MelodyRequest): Promise<MelodySetting> {
    return this.request(HttpMethod.Post, API.lyricsMelody, request);
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

  /** One of Ode's cover art images becomes cover.png. */
  chooseCover(request: CoverChoice): Promise<ReleaseResponse> {
    return this.request(HttpMethod.Post, API.releaseCover, request);
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
      headers: body === undefined ? undefined : { "Content-Type": JSON_TYPE },
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
