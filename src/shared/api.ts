// HTTP API between the UI and the local server. All paths are relative to the server origin.
import type { LiveStatus } from "./live";
import type { LyricsSaved, LyricsState, LyricsWrite } from "./lyrics";
import type { Mode } from "./personalisation";
import type { Suggestion } from "./events";
import type { RestoreResult, VersionDetail, VersionListItem } from "./versions";

export const API = {
  chat: "/api/chat", // POST ChatRequest → { ok: true } (a typed line, spoken words or a tapped suggestion)
  stop: "/api/stop", // POST → { ok: true }
  events: "/api/events", // GET server-sent events of UiEvent
  status: "/api/status", // GET → StatusResponse
  approval: (id: string) => `/api/approvals/${encodeURIComponent(id)}`, // POST ApprovalRequest → { ok: true }
  question: (id: string) => `/api/questions/${encodeURIComponent(id)}`, // POST QuestionAnswer → { ok: true }
  lyrics: "/api/lyrics", // GET → LyricsState; PUT LyricsWrite → LyricsSaved (merged when Ode saved in between)
  releaseFile: (name: string) => `/api/release/file/${encodeURIComponent(name)}`, // GET a release file (cover art shown in a question)
  versions: "/api/versions", // GET → VersionListItem[] (newest first)
  versionsCheck: "/api/versions/check", // POST → VersionListItem | null (saves the musician's hand edits now, when Ode is idle)
  version: (id: string) => `/api/versions/${encodeURIComponent(id)}`, // GET → VersionDetail
  versionRestore: (id: string) => `/api/versions/${encodeURIComponent(id)}/restore`, // POST RestoreRequest → RestoreResult
  versionName: (id: string) => `/api/versions/${encodeURIComponent(id)}/name`, // POST VersionNameRequest → VersionListItem
  versionCopy: (id: string) => `/api/versions/${encodeURIComponent(id)}/copy`, // POST → CopyResult (a copy of the project at that version)
  copyNow: "/api/copy", // POST → CopyResult (saves the hand edits, then copies the project as it is now)
  undo: "/api/undo", // POST VersionRequest → RestoreResult (back to the version before that change by Ode)
  again: "/api/again", // POST VersionRequest → { ok: true } (another take of that change by Ode, in place)
  why: "/api/why", // POST VersionRequest → { ok: true } (the answer arrives as an "answer" event)
  mode: "/api/mode", // PUT ModeRequest → { mode: Mode }
  speech: "/api/speech", // POST a mono WAV of the musician speaking → { text } (also sent to Ode as a request)
  livePointer: "/api/live/pointer", // POST LivePointer (from the extension)
  livePending: "/api/live/pending", // GET → LiveRequest[] (extension fallback when its connection was closed)
  liveResults: "/api/live/results", // POST LiveResponse[] (extension fallback)
} as const;

/** The cover art the release uses, in the release folder. */
export const COVER_FILE = "cover.png";
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
  live: LiveStatus;
  busy: boolean;
  /** False while Ode does work Stop can't interrupt (Undo, a restore). */
  stoppable: boolean;
  mode: Mode;
  /** The song's title, or the Set's file name when it has none. */
  title: string;
  /** History groups consecutive versions by the same author within this many minutes. */
  versionGroupMinutes: number;
}

/** Undo, Again and Why? name the change by Ode they are about; a change that is no longer the newest is refused. */
export interface VersionRequest {
  versionId: string;
}

/** Restoring deletes the later versions, so the musician must have confirmed it. */
export interface RestoreRequest {
  confirmed: true;
}

export interface VersionNameRequest {
  name: string;
}

export interface CopyResult {
  /** Folder of the copied project. */
  path: string;
}

export interface ModeRequest {
  mode: Mode;
}

export type { LyricsSaved, LyricsState, LyricsWrite, Suggestion, RestoreResult, VersionDetail, VersionListItem };
