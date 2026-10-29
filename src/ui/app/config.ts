/** Timings and limits of the UI. */
export const UI_CONFIG = {
  /** Wait after the last edit of the lyrics before saving them. */
  lyricsSaveDelayMs: 800,
  /** First wait before reconnecting to the event stream; doubles up to the maximum. */
  reconnectInitialMs: 1_000,
  reconnectMaxMs: 15_000,
  /** Largest line-by-line comparison (lines before times lines after) worked out in full; past it only the shared start and end match. */
  lineDiffMaxCells: 1_000_000,
  /** Wait after the last keystroke in a key before asking the provider which models it reaches. */
  modelListDelayMs: 600,
  /** Wait after the last edit of a section before Lyrics support marks it again. */
  lyricsCheckDelayMs: 700,
  /** How many checked lines the editor remembers, so a line typed back shows its marks at once. */
  lyricsCheckLinesKept: 2_000,
  /** Where the editor keeps which marks the View menu shows. */
  lyricsViewStorageKey: "ode.lyrics.view",
} as const;
