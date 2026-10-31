// HTTP API between the UI and the local server. All paths are relative to the server origin.
import type { LyricsSaved, LyricsState, LyricsWrite } from "./lyrics";
import type { Mode } from "./personalisation";
import type { RestoreResult, VersionDetail, VersionListItem } from "./versions";

export const API = {
  chat: "/api/chat", // POST ChatRequest → { ok: true } (a submitted conversation request)
  conversation: "/api/conversation", // GET complete saved transcript
  composer: "/api/composer", // GET ?songId&writerId; PUT ComposerWrite → ComposerState
  composerSend: "/api/composer/send", // POST ComposerPrepare freezes identity; never dispatches
  composerResolve: "/api/composer/resolve", // POST ComposerResolve → ComposerState
  composerCancel: "/api/composer/cancel", // POST ComposerCancel → ComposerState
  audioImport: "/api/audio/import", // POST explicit multipart audio upload
  dictation: "/api/dictation", // POST multipart { songId, file: PCM WAV } → DictationResponse; never submits chat
  stop: "/api/stop", // POST → { ok: true }
  events: "/api/events", // GET server-sent events of UiEvent
  status: "/api/status", // GET → StatusResponse
  approval: (id: string) => `/api/approvals/${encodeURIComponent(id)}`, // POST ApprovalRequest → { ok: true }
  question: (id: string) => `/api/questions/${encodeURIComponent(id)}`, // POST QuestionAnswer → { ok: true }
  lyrics: "/api/lyrics", // GET → LyricsState; PUT LyricsWrite → LyricsSaved (merged when Ode saved in between)
  lyricsCheck: "/api/lyrics/check", // POST LyricsCheckRequest → LyricsCheckResponse (Lyrics support's marks for one section)
  lyricsStrict: "/api/lyrics/strict", // POST StrictRhymesRequest → LyricsState (perfect rhymes on or off for a section name)
  versions: "/api/versions", // GET → VersionListItem[] (newest first)
  versionsCheck: "/api/versions/check", // POST → VersionListItem | null (saves the musician's hand edits now, when Ode is idle)
  version: (id: string) => `/api/versions/${encodeURIComponent(id)}`, // GET → VersionDetail
  versionRestore: (id: string) => `/api/versions/${encodeURIComponent(id)}/restore`, // POST RestoreRequest → RestoreResult
  versionName: (id: string) => `/api/versions/${encodeURIComponent(id)}/name`, // POST VersionNameRequest → VersionListItem
  undo: "/api/undo", // POST VersionRequest → RestoreResult (back to the version before that change by Ode)
  again: "/api/again", // POST VersionRequest → { ok: true } (another take of that change by Ode, in place)
  why: "/api/why", // POST VersionRequest → { ok: true } (the answer arrives as an "answer" event)
  mode: "/api/mode", // PUT ModeRequest → { mode: Mode }
  songs: "/api/songs", // GET → SongsResponse; POST { title } → SongEntry (a new song, now in use)
  songsOpen: "/api/songs/open", // POST { id } → SongEntry (that song, now in use)
  settings: "/api/settings", // GET → SettingsResponse; PUT SettingsUpdate → SettingsView
  settingsModels: "/api/settings/models", // POST ModelListRequest → ChatModelOption[] (the models a key reaches)
} as const;

export interface ChatRequest {
  songId?: string;
  requestId?: string;
  text: string;
}

export interface DictationResponse {
  songId: string;
  text: string;
}

export interface ApprovalRequest {
  decision: "allow" | "deny";
}

export interface QuestionAnswer {
  choice: string;
}

export interface StatusResponse {
  busy: boolean;
  /** False while Ode does work that runs to the end once started (Undo, a restore). */
  stoppable: boolean;
  mode: Mode;
  /** The song's title as the dialogs show it ("Untitled song" until it has one). */
  title: string;
  /** History groups consecutive versions by the same author within this many minutes. */
  versionGroupMinutes: number;
  /** The line the chosen model's licence asks Ode to show. */
  credit: string | null;
  /** Local configuration only; no provider request or microphone permission check is made. */
  dictationReady?: boolean;
}

/** Undo/Again name a scoped, guarded change; Why? names the result to explain. */
export interface VersionRequest {
  versionId: string;
}

/** Restoring changes the Set; later recovery versions remain available. */
export interface RestoreRequest {
  confirmed: true;
}

export interface VersionNameRequest {
  name: string;
}

/** Every song the musician works on with Ode, and the one in use now. */
export interface SongsResponse {
  current: string;
  songs: { id: string; title: string; updatedAt: string }[];
}

export interface ModeRequest {
  mode: Mode;
}

export type { LyricsSaved, LyricsState, LyricsWrite, RestoreResult, VersionDetail, VersionListItem };
