// HTTP API between the UI and the local server. All paths are relative to the server origin.
import type { Role } from "./config";
import type { LeadSheet } from "./song";
import type { LiveStatus } from "./live";
import type { ArtistFact } from "./memory";
import type { LyricsAnalysis, MelodySetting } from "./lyrics";
import type { Mode, Personalisation, PreferencesFile, ResolvedPersonalisation } from "./personalisation";
import type { Suggestion } from "./events";
import type { RestoreResult, VersionDetail, VersionListItem } from "./versions";

export const API = {
  chat: "/api/chat", // POST ChatRequest → { ok: true } (a typed line or a tapped suggestion)
  stop: "/api/stop", // POST → { ok: true }
  events: "/api/events", // GET server-sent events of UiEvent
  approval: (id: string) => `/api/approvals/${encodeURIComponent(id)}`, // POST ApprovalRequest → { ok: true }
  song: "/api/song", // GET → LeadSheet; PUT LeadSheet → LeadSheet
  preferences: "/api/preferences", // GET → PreferencesResponse; PUT PreferencesUpdate → PreferencesResponse
  memory: "/api/memory", // GET → ArtistFact[]; POST MemoryAdd → ArtistFact
  memoryItem: (id: string) => `/api/memory/${encodeURIComponent(id)}`, // DELETE → { ok: true }
  lyricsAnalyze: "/api/lyrics/analyze", // POST LyricsAnalyzeRequest → LyricsAnalysis
  lyricsMelody: "/api/lyrics/melody", // POST MelodyRequest → MelodySetting (the section's lines under the selected clip's notes)
  status: "/api/status", // GET → StatusResponse
  release: "/api/release", // GET → ReleaseResponse
  releaseFile: (name: string) => `/api/release/file/${encodeURIComponent(name)}`, // GET file
  releaseCover: "/api/release/cover", // POST CoverChoice → ReleaseResponse (the picked image becomes cover.png)
  livePointer: "/api/live/pointer", // POST LivePointer (from the extension)
  liveRead: "/api/live/read", // POST LiveReadRequest → result of a read-only Live operation (UI)
  livePending: "/api/live/pending", // GET → LiveRequest[] (extension fallback when its connection was closed)
  liveResults: "/api/live/results", // POST LiveResponse[] (extension fallback)
  versions: "/api/versions", // GET → VersionListItem[] (newest first)
  version: (id: string) => `/api/versions/${encodeURIComponent(id)}`, // GET → VersionDetail
  versionRestore: (id: string) => `/api/versions/${encodeURIComponent(id)}/restore`, // POST RestoreRequest → RestoreResult
  versionName: (id: string) => `/api/versions/${encodeURIComponent(id)}/name`, // POST VersionNameRequest → VersionListItem
  versionCopy: (id: string) => `/api/versions/${encodeURIComponent(id)}/copy`, // POST → CopyResult
  undo: "/api/undo", // POST → RestoreResult (back to the version before Ode's last change, no confirmation)
  again: "/api/again", // POST → { ok: true } (another take of Ode's last change, in place)
  question: (id: string) => `/api/questions/${encodeURIComponent(id)}`, // POST QuestionAnswer → { ok: true }
  suggestions: "/api/suggestions", // GET → Suggestion[] for the current selection
  mode: "/api/mode", // PUT ModeRequest → { mode: Mode }
  speech: "/api/speech", // POST a mono WAV of the musician speaking → { text } (also sent to Ode as a request)
} as const;

/** Read-only Live operations the UI may call directly. */
export const UI_READ_OPS = [
  "song_get",
  "track_get",
  "take_lane_get",
  "clip_slot_get",
  "clip_get",
  "midi_clip_get_notes",
  "audio_clip_get",
  "device_get",
  "parameter_get",
  "mixer_get",
  "rack_get_chains",
  "simpler_get_sample",
  "scene_get",
  "selection_get",
  "track_meters_get",
] as const;

export interface LiveReadRequest {
  op: (typeof UI_READ_OPS)[number];
  args: unknown;
}

export interface ChatRequest {
  text: string;
}

export interface ApprovalRequest {
  decision: "allow" | "deny";
}

export interface PreferencesResponse extends PreferencesFile {
  resolved: ResolvedPersonalisation;
}

export interface PreferencesUpdate {
  personalisation?: Partial<Personalisation>;
  mode?: Mode;
}

export interface MemoryAdd {
  topic: string;
  value: string;
}

export interface LyricsAnalyzeRequest {
  lines: string[];
}

export interface MelodyRequest {
  /** The section's id in the lead sheet. */
  section: string;
}

export interface StatusResponse {
  live: LiveStatus;
  roles: Record<Role, boolean>;
  projectDir: string | null;
  busy: boolean;
  mode: Mode;
  /** History groups consecutive versions by the same author within this many minutes. */
  versionGroupMinutes: number;
}

export interface ReleaseResponse {
  files: { name: string; size: number }[];
}

/** The cover art the release uses, in the release folder. */
export const COVER_FILE = "cover.png";
/** The cover art choices Ode makes: cover-1.png, cover-2.png… */
export const COVER_CHOICE = /^cover-(\d+)\.png$/;

/** One of the cover art images Ode made (cover-1.png, cover-2.png…). */
export interface CoverChoice {
  file: string;
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

export interface QuestionAnswer {
  choice: string;
}

export interface ModeRequest {
  mode: Mode;
}

export type { LeadSheet, ArtistFact, LyricsAnalysis, MelodySetting, Suggestion, RestoreResult, VersionDetail, VersionListItem };
