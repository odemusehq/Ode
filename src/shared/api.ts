// HTTP API between the UI and the local server. All paths are relative to the server origin.
import type { Role } from "./config";
import type { HistoryEntry, LeadSheet } from "./song";
import type { LiveStatus } from "./live";
import type { ArtistFact } from "./memory";
import type { LyricsAnalysis } from "./lyrics";
import type { Personalisation, PreferencesFile, ResolvedPersonalisation } from "./personalisation";

export const API = {
  chat: "/api/chat", // POST ChatRequest → { ok: true }
  stop: "/api/stop", // POST → { ok: true }
  events: "/api/events", // GET server-sent events of UiEvent
  approval: (id: string) => `/api/approvals/${encodeURIComponent(id)}`, // POST ApprovalRequest → { ok: true }
  song: "/api/song", // GET → LeadSheet; PUT LeadSheet → LeadSheet
  history: "/api/history", // GET → HistoryEntry[]
  preferences: "/api/preferences", // GET → PreferencesResponse; PUT PreferencesUpdate → PreferencesResponse
  memory: "/api/memory", // GET → ArtistFact[]; POST MemoryAdd → ArtistFact
  memoryItem: (id: string) => `/api/memory/${encodeURIComponent(id)}`, // DELETE → { ok: true }
  lyricsAnalyze: "/api/lyrics/analyze", // POST LyricsAnalyzeRequest → LyricsAnalysis
  status: "/api/status", // GET → StatusResponse
  release: "/api/release", // GET → ReleaseResponse
  releaseFile: (name: string) => `/api/release/file/${encodeURIComponent(name)}`, // GET file
  livePointer: "/api/live/pointer", // POST LivePointer (from the extension)
  liveRead: "/api/live/read", // POST LiveReadRequest → result of a read-only Live operation (UI)
  livePending: "/api/live/pending", // GET → LiveRequest[] (extension fallback when its connection was closed)
  liveResults: "/api/live/results", // POST LiveResponse[] (extension fallback)
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
  /** Allow this kind of change from now on without asking. */
  always?: boolean;
}

export interface PreferencesResponse extends PreferencesFile {
  resolved: ResolvedPersonalisation;
}

export interface PreferencesUpdate {
  personalisation?: Partial<Personalisation>;
  allowedChanges?: string[];
}

export interface MemoryAdd {
  topic: string;
  value: string;
}

export interface LyricsAnalyzeRequest {
  lines: string[];
}

export interface StatusResponse {
  live: LiveStatus;
  roles: Record<Role, boolean>;
  projectDir: string | null;
  busy: boolean;
}

export interface ReleaseResponse {
  files: { name: string; size: number }[];
}

export type { HistoryEntry, LeadSheet, ArtistFact, LyricsAnalysis };
