import { API } from "../../shared/api";
import type {
  ApprovalRequest,
  ChatRequest,
  DictationResponse,
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
import type { LyricsCheckRequest, LyricsCheckResponse, StrictRhymesRequest } from "../../shared/lyrics";
import type { Mode } from "../../shared/personalisation";
import type { ChatModelOption, ModelListRequest, SettingsResponse, SettingsUpdate, SettingsView } from "../../shared/settings";
import type { ConversationExchange } from "../../shared/events";
import type { ComposerCancel, ComposerDraft, ComposerPrepare, ComposerResolve, ComposerState, ComposerWrite } from "../../shared/composer";

export type AudioScope = "sample" | "reference" | "processed-bounce";
export interface AudioAttachment {
  id: string;
  path: string;
  name: string;
  scope: string;
  entryId?: string;
  composer?: ComposerState;
  linked?: boolean;
}

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
}

const JSON_TYPE = "application/json";

export interface OkResponse {
  ok: boolean;
  composer?: ComposerState;
}

export interface ModeResponse {
  mode: Mode;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string, readonly composer?: ComposerState) {
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
  getConversation(): Promise<{ songId: string; exchanges: ConversationExchange[] }> {
    return this.request(HttpMethod.Get, API.conversation);
  }

  async importAudio(file: File, scope: AudioScope, sourceDescription: string, link?: { songId: string; writerId: string; entryId: string; baseRevision: number; snapshot: ComposerDraft }): Promise<AudioAttachment> {
    const body = new FormData();
    body.set("file", file);
    body.set("scope", scope);
    body.set("sourceDescription", sourceDescription);
    if (link) for (const [key, value] of Object.entries(link)) body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    const response = await fetch(API.audioImport, { method: HttpMethod.Post, body });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string; composer?: ComposerState };
      throw new ApiError(response.status, result.error ?? "Attaching audio failed.", result.composer);
    }
    return await response.json() as AudioAttachment;
  }

  getComposer(songId: string, writerId: string): Promise<ComposerState> {
    return this.composerRequest(HttpMethod.Get, `${API.composer}?${new URLSearchParams({ songId, writerId })}`);
  }

  saveComposer(write: ComposerWrite, keepalive = false): Promise<ComposerState> {
    return this.composerRequest(HttpMethod.Put, API.composer, write, keepalive);
  }

  prepareComposerSend(write: ComposerPrepare): Promise<ComposerState> {
    return this.composerRequest(HttpMethod.Post, API.composerSend, write);
  }

  resolveComposer(write: ComposerResolve): Promise<ComposerState> {
    return this.composerRequest(HttpMethod.Post, API.composerResolve, write);
  }

  cancelComposerSend(write: ComposerCancel): Promise<ComposerState> {
    return this.composerRequest(HttpMethod.Post, API.composerCancel, write);
  }

  private async composerRequest(method: HttpMethod, path: string, body?: unknown, keepalive = false): Promise<ComposerState> {
    const response = await fetch(path, { method, keepalive,
      headers: method === HttpMethod.Get ? undefined : { "Content-Type": JSON_TYPE },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json() as ComposerState & { error?: string; composer?: ComposerState };
    if (!response.ok) throw new ApiError(response.status, result.error ?? "Saving the draft failed.", result.composer);
    return result;
  }
  async transcribe(file: File, songId: string, signal?: AbortSignal): Promise<DictationResponse> {
    const body = new FormData();
    body.set("file", file);
    body.set("songId", songId);
    const response = await fetch(API.dictation, { method: HttpMethod.Post, body, signal });
    if (!response.ok) throw new ApiError(response.status, await readError(response));
    return await response.json() as DictationResponse;
  }
  chat(request: ChatRequest, signal?: AbortSignal): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.chat, request, signal);
  }

  stop(requestIds: string[] = []): Promise<OkResponse> {
    return this.request(HttpMethod.Post, API.stop, { requestIds });
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

  /** Lyrics support's syllables, stress and rhymes for one section's sung lines. */
  checkLyrics(request: LyricsCheckRequest): Promise<LyricsCheckResponse> {
    return this.request(HttpMethod.Post, API.lyricsCheck, request);
  }

  setStrictRhymes(request: StrictRhymesRequest): Promise<LyricsState> {
    return this.request(HttpMethod.Post, API.lyricsStrict, request);
  }

  getVersions(): Promise<VersionListItem[]> {
    return this.request(HttpMethod.Get, API.versions);
  }

  /** Saves the musician's hand edits as a version now, when Ode is idle; null when the musician made zero hand edits. */
  checkVersions(): Promise<VersionListItem | null> {
    return this.request(HttpMethod.Post, API.versionsCheck);
  }

  getVersion(id: string): Promise<VersionDetail> {
    return this.request(HttpMethod.Get, API.version(id));
  }

  /** Restores supported state and keeps later versions; call only after confirmation. */
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
  private async request<T>(method: HttpMethod, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const reads = method === HttpMethod.Get;
    const response = await fetch(path, {
      method,
      signal,
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
