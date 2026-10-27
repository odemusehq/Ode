import { STREAMING_TARGET, TYPICAL_VOCAL_RANGE } from "../../shared/personalisation";
import type { LoudnessTarget, VocalRange } from "../../shared/personalisation";

/** Timings and limits of the UI. */
export const UI_CONFIG = {
  /** Wait after the last lyric edit before checking the lyrics. */
  lyricsAnalyzeDelayMs: 300,
  /** Wait after the last lyric edit before saving the lead sheet. */
  lyricsSaveDelayMs: 800,
  /** First wait before reconnecting to the event stream; doubles up to the maximum. */
  reconnectInitialMs: 1_000,
  reconnectMaxMs: 15_000,
  /** Chat entries kept in memory. */
  chatEntryLimit: 500,
  /** Distance from the bottom within which the chat keeps scrolling with new text. */
  chatFollowThresholdPx: 48,
  /** History entries shown on the Changes page. */
  historyLimit: 50,
  /** Length of a section added from the lyric editor. */
  newSectionBars: 8,
} as const;

export const GENRES: readonly string[] = [
  "Pop",
  "Rock",
  "Indie",
  "Hip-hop",
  "R&B",
  "Soul",
  "Funk",
  "Electronic",
  "House",
  "Techno",
  "Drum and bass",
  "Ambient",
  "Folk",
  "Singer-songwriter",
  "Country",
  "Jazz",
  "Blues",
  "Reggae",
  "Latin",
  "Afrobeats",
  "Metal",
  "Punk",
  "Classical",
  "Film score",
];

/** Topics offered when the musician adds something to Ode's memory. */
export const MEMORY_TOPICS: readonly string[] = [
  "vocal range",
  "favourite keys",
  "favourite tempos",
  "chord vocabulary",
  "melodic habits",
  "lyric voice",
  "rhyme taste",
  "sounds and plugins",
  "mix preferences",
  "mastering preferences",
  "dislikes",
];

export interface LoudnessPreset extends LoudnessTarget {
  id: string;
  label: string;
}

export const LOUDNESS_PRESETS: readonly LoudnessPreset[] = [
  { id: "streaming", label: "Streaming", ...STREAMING_TARGET },
  { id: "apple-music", label: "Apple Music", lufs: -16, truePeak: -1 },
  { id: "broadcast", label: "Broadcast (EBU R128)", lufs: -23, truePeak: -1 },
];

/** MIDI notes offered for the vocal range. */
export const VOCAL_RANGE_LIMITS: VocalRange = { low: 28, high: 96 };

/** Starting point when the musician switches the vocal range from Detect to their own. */
export const DEFAULT_CUSTOM_VOCAL_RANGE: VocalRange = TYPICAL_VOCAL_RANGE;

/** Starting point when the musician switches the loudness target from Detect to their own. */
export const DEFAULT_CUSTOM_LOUDNESS: LoudnessTarget = STREAMING_TARGET;
