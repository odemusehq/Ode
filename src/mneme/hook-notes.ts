import { createHash } from "node:crypto";
import type { Note } from "../shared/live";

/** Content identity for the exact notes retained in memory, independent of object key order. */
export function melodyNoteHash(notes: readonly Note[]): string {
  const canonical = notes.map(({ pitch, start, duration, velocity, muted, probability, velocityDeviation, releaseVelocity }) =>
    ({ pitch, start, duration, velocity, muted, probability, velocityDeviation, releaseVelocity }))
    .map((note) => JSON.stringify(note)).sort();
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Copy an explicitly selected span without interpreting, generating or changing its performance. */
export function hookNotesInRange(notes: readonly Note[], startBeat: number, lengthBeats: number): Note[] {
  if (!Number.isFinite(startBeat) || startBeat < 0 || !Number.isFinite(lengthBeats) || lengthBeats <= 0) throw new Error("A hook source needs a nonnegative start and a finite positive length.");
  const end = startBeat + lengthBeats;
  const overlapping = notes.filter((note) => note.start < end && note.start + note.duration > startBeat);
  if (overlapping.some((note) => note.start < startBeat - 1e-6 || note.start + note.duration > end + 1e-6)) {
    throw new Error("The retained hook boundary crosses a held note. Choose a complete phrase or revise its notes explicitly.");
  }
  return overlapping.map((note) => ({ ...note, start: Math.max(0, note.start - startBeat) }));
}
