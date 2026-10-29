import type { NoteDescription } from "@ableton-extensions/sdk";
import type { Note } from "../../shared/live";
import { MIDI_MAX } from "../../shared/notes";

/** Checks Ode's notes and converts them for Live. Times are in beats from the clip start. */
export function toLiveNotes(notes: readonly Note[]): NoteDescription[] {
  if (!Array.isArray(notes)) throw new TypeError("notes must be a list of notes");
  return notes.map((note, position) => toLiveNote(note, position));
}

/** Live's notes as Ode's, in time order. */
export function fromLiveNotes(notes: readonly NoteDescription[]): Note[] {
  return notes
    .map(({ pitch, startTime, duration, velocity, muted, probability, velocityDeviation, releaseVelocity }) => ({
      pitch,
      start: startTime,
      duration,
      velocity,
      muted,
      probability,
      velocityDeviation,
      releaseVelocity,
    }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

function toLiveNote(note: Note, position: number): NoteDescription {
  const label = `note ${position + 1}`;
  if (![note.pitch, note.start, note.duration].every(Number.isFinite)) {
    throw new TypeError(`${label} needs a pitch, a start and a duration`);
  }
  if (note.pitch < 0 || note.pitch > MIDI_MAX) throw new RangeError(`${label}: pitch must be from 0 to ${MIDI_MAX}`);
  if (note.start < 0) throw new RangeError(`${label} starts before the clip; start must be 0 or later`);
  if (note.duration <= 0) throw new RangeError(`${label} needs a duration of more than 0 beats`);
  const live: NoteDescription = { pitch: Math.round(note.pitch), startTime: note.start, duration: note.duration };
  if (note.velocity !== undefined) live.velocity = clamp(note.velocity, 1, MIDI_MAX);
  if (note.muted !== undefined) live.muted = note.muted;
  if (note.probability !== undefined) live.probability = clamp(note.probability, 0, 1);
  if (note.velocityDeviation !== undefined) live.velocityDeviation = clamp(note.velocityDeviation, -MIDI_MAX, MIDI_MAX);
  if (note.releaseVelocity !== undefined) live.releaseVelocity = clamp(note.releaseVelocity, 0, MIDI_MAX);
  return live;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
