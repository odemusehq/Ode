/** Timings and limits of the UI. */
export const UI_CONFIG = {
  /** Wait after the last edit of the lyrics before saving them. */
  lyricsSaveDelayMs: 800,
  /** First wait before reconnecting to the event stream; doubles up to the maximum. */
  reconnectInitialMs: 1_000,
  reconnectMaxMs: 15_000,
  /** Wait after the window gets the focus before asking the server to save the musician's hand edits as a version. */
  versionsCheckDelayMs: 1_000,
  /** Bars Hum records over the song. */
  humBars: 4,
  /** Largest line-by-line comparison (lines before times lines after) worked out in full; past it only the shared start and end match. */
  lineDiffMaxCells: 1_000_000,
} as const;
