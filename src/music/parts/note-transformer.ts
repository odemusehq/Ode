import { z } from "zod";
import type { Note } from "../../shared/live";
import { NoteSchema } from "../../tools/live/schemas";

export const NoteTransformSchema = z.object({
  transposeSemitones: z.number().int().default(0),
  timeScale: z.number().positive().default(1),
  timeOffsetBeats: z.number().default(0),
}).strict();

export type NoteTransform = z.input<typeof NoteTransformSchema>;
export interface NoteTransformResult {
  notes: Note[];
  transformation: { transposeSemitones: number; timeScale: number; timeOffsetBeats: number; anchorBeat: 0 };
  noteEndBeats: number;
}

/** Uniformly change a complete part about clip-local beat zero without changing its other performance fields. */
export function transformNotes(notes: readonly Note[], transform: NoteTransform = {}): NoteTransformResult {
  const complete = NoteSchema.strict().array().min(1);
  const source = complete.parse(notes);
  if (source.some((note) => !Number.isFinite(note.start + note.duration))) throw new RangeError("Source note ends must be finite.");
  const { transposeSemitones, timeScale, timeOffsetBeats } = NoteTransformSchema.parse(transform);
  // Validate the complete proposal before returning any part; unsupported pitches/times refuse, never clamp.
  const result = complete.parse(source.map((note) => ({ ...note,
    pitch: note.pitch + transposeSemitones,
    start: note.start * timeScale + timeOffsetBeats,
    duration: note.duration * timeScale,
  })));
  if (result.some((note) => !Number.isFinite(note.start + note.duration))) throw new RangeError("This transform would produce a nonfinite note end.");
  if (JSON.stringify(result) === JSON.stringify(source)) throw new Error("This transform does not change any supplied note.");
  return { notes: result, transformation: { transposeSemitones, timeScale, timeOffsetBeats, anchorBeat: 0 },
    noteEndBeats: result.reduce((end, note) => Math.max(end, note.start + note.duration), 0) };
}
