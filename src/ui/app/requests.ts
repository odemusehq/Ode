import { UI_CONFIG } from "./config";

/** What the window's buttons ask Ode, in the musician's words. */
export const REQUESTS = {
  why: "Why?",
  hum: `Hum: record what I sing over the next ${UI_CONFIG.humBars} bars and turn it into MIDI on the selected track`,
  checkMix: "Check the mix",
  masterForStreaming: "Master for streaming",
  prepareRelease: "Prepare the release files: cover art, lyric sheet and credits.",
} as const;

/** Tapping a red syllable count: Ode rewrites that line in place so it fits. */
export function fitLineRequest(section: string, line: number, counts: readonly number[]): string {
  return `Rewrite ${section} line ${line} to ${countsInWords(counts)} syllables with the stress on the beat`;
}

/** The line set to the melody doesn't fit its phrase: rewrite the words to its notes. */
export function fitNotesRequest(section: string, line: number, noteCount: number): string {
  return `Rewrite ${section} line ${line} to fit its ${noteCount} notes with the stresses on the strong beats.`;
}

/** More syllables than notes: split a note of the melody. */
export function splitNoteRequest(section: string, line: number): string {
  return `In ${section} line ${line}, split a note of the melody so the words fit, in place.`;
}

/** More syllables than notes: merge two syllables in the words. */
export function mergeSyllablesRequest(section: string, line: number, noteCount: number): string {
  return `In ${section} line ${line}, merge two syllables with a contraction or a shorter word so the line fits its ${noteCount} notes.`;
}

/** Fewer syllables than notes: merge two notes of the melody. */
export function mergeNotesRequest(section: string, line: number): string {
  return `In ${section} line ${line}, merge two notes of the melody so the words fit, in place.`;
}

/** "8", "10 or 11", "7 to 9", or "7, 9 or 11". */
function countsInWords(counts: readonly number[]): string {
  const sorted = [...new Set(counts)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return "";
  if (sorted.length === 1) return String(first);
  if (sorted.length > 2 && last - first === sorted.length - 1) return `${first} to ${last}`;
  return `${sorted.slice(0, -1).join(", ")} or ${last}`;
}
