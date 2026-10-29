import { API } from "../../shared/api";
import type {
  ApprovalRequest,
  ChatRequest,
  LyricsSaved,
  LyricsState,
  LyricsWrite,
  ModeRequest,
  QuestionAnswer,
  RestoreRequest,
  RestoreResult,
  SongsResponse,
  StatusResponse,
  VersionDetail,
  VersionListItem,
  VersionNameRequest,
  VersionRequest,
} from "../../shared/api";
import type { Mode } from "../../shared/personalisation";
import type { ChatModelOption, ModelListRequest, SettingsResponse, SettingsUpdate, SettingsView } from "../../shared/settings";

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
}

const JSON_TYPE = "application/json";

export interface OkResponse {
  ok: boolean;
}

export interface ModeResponse {
  mode: Mode;
}

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

/** Typed access to every route of the local server the window uses. */
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

  undo(request: VersionRequest): Promise<RestoreResult> {
    return this.request(HttpMethod.Post, API.undo, request);
  }

  again(request: VersionRequest): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.again, request);
  }

  /** Asks why Ode made that change; the answer arrives as an "answer" event. */
  why(request: VersionRequest): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.why, request);
  }

  setMode(request: ModeRequest): Promise<ModeResponse> {
    return this.request(HttpMethod.Put, API.mode, request);
  }

  getLyrics(): Promise<LyricsState> {
    return this.request(HttpMethod.Get, API.lyrics);
  }

  /** Saves the whole text with the revision it was edited from; the server merges it with what Ode saved since. */
  saveLyrics(write: LyricsWrite): Promise<LyricsSaved> {
    return this.request(HttpMethod.Put, API.lyrics, write);
  }

  getVersions(): Promise<VersionListItem[]> {
    return this.request(HttpMethod.Get, API.versions);
  }

  /** Saves the musician's hand edits as a version now, when Ode is idle; null when there were none. */
  checkVersions(): Promise<VersionListItem | null> {
    return this.request(HttpMethod.Post, API.versionsCheck);
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

  getSongs(): Promise<SongsResponse> {
    return this.request(HttpMethod.Get, API.songs);
  }

  /** Switches Ode to another song: its lyrics, history and conversation. */
  openSong(id: string): Promise<SongsResponse["songs"][number]> {
    return this.request(HttpMethod.Post, API.songsOpen, { id });
  }

  /** Starts a new song with this title and switches to it. */
  createSong(title: string): Promise<SongsResponse["songs"][number]> {
    return this.request(HttpMethod.Post, API.songs, { title });
  }

  getSettings(): Promise<SettingsResponse> {
    return this.request(HttpMethod.Get, API.settings);
  }

  saveSettings(update: SettingsUpdate): Promise<SettingsView> {
    return this.request(HttpMethod.Put, API.settings, update);
  }

  /** The models a provider offers, or the ones the key reaches where the provider lists them (Modal's endpoints). */
  listModels(request: ModelListRequest): Promise<ChatModelOption[]> {
    return this.request(HttpMethod.Post, API.settingsModels, request);
  }

  getStatus(): Promise<StatusResponse> {
    return this.request(HttpMethod.Get, API.status);
  }

  releaseFileUrl(name: string): string {
    return API.releaseFile(name);
  }

  /** Sends every change as JSON, the only kind the server accepts for one. */
  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const reads = method === HttpMethod.Get;
    const response = await fetch(path, {
      method,
      headers: reads ? undefined : { "Content-Type": JSON_TYPE },
      body: reads ? undefined : JSON.stringify(body ?? {}),
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
