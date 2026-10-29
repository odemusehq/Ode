// HTTP API between the UI and the local server. All paths are relative to the server origin.
import type { LyricsSaved, LyricsState, LyricsWrite } from "./lyrics";
import type { Mode } from "./personalisation";
import type { Suggestion } from "./events";
import type { RestoreResult, VersionDetail, VersionListItem } from "./versions";

export const API = {
  chat: "/api/chat", // POST ChatRequest → { ok: true } (a typed line, spoken words or a tapped suggestion)
  conversation: "/api/conversation", // GET complete saved transcript
  audioImport: "/api/audio/import", // POST explicit multipart audio upload
  stop: "/api/stop", // POST → { ok: true }
  events: "/api/events", // GET server-sent events of UiEvent
  status: "/api/status", // GET → StatusResponse
  approval: (id: string) => `/api/approvals/${encodeURIComponent(id)}`, // POST ApprovalRequest → { ok: true }
  question: (id: string) => `/api/questions/${encodeURIComponent(id)}`, // POST QuestionAnswer → { ok: true }
  lyrics: "/api/lyrics", // GET → LyricsState; PUT LyricsWrite → LyricsSaved (merged when Ode saved in between)
  lyricsCheck: "/api/lyrics/check", // POST LyricsCheckRequest → LyricsCheckResponse (Lyrics support's marks for one section)
  lyricsStrict: "/api/lyrics/strict", // POST StrictRhymesRequest → LyricsState (perfect rhymes on or off for a section name)
  releaseFile: (name: string) => `/api/release/file/${encodeURIComponent(name)}`, // GET a release file (cover art shown in a question)
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

/** The cover art the release uses, in the release folder. */
export const COVER_FILE = "cover.png";
/** The lyric sheet and the credits Ode writes into the release folder. */
export const LYRICS_FILE = "lyrics.txt";
export const CREDITS_FILE = "credits.json";
/** The cover art choices Ode makes: cover-1.png, cover-2.png… */
export const COVER_CHOICE = /^cover-(\d+)\.png$/;

export interface ChatRequest {
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
}

/** Undo, Again and Why? name the change by Ode they are about, and they act only on the newest change. */
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

export type { LyricsSaved, LyricsState, LyricsWrite, Suggestion, RestoreResult, VersionDetail, VersionListItem };
