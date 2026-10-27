import type { Note } from "../../shared/live";

/** Notes starting closer than this (in beats) are treated as starting together. */
const SAME_START = 1e-3;

/** The sung line of a clip: unmuted notes sorted by start, keeping the highest where notes start together. */
export function melodyLine(notes: Note[]): Note[] {
  const sorted = notes
    .filter((note) => !note.muted && note.duration > 0)
    .sort((a, b) => a.start - b.start || b.pitch - a.pitch);
  const line: Note[] = [];
  for (const note of sorted) {
    const last = line.at(-1);
    if (last && Math.abs(last.start - note.start) < SAME_START) continue;
    line.push({ ...note });
  }
  return line;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
