import { z } from "zod";
import type { Note } from "../../shared/live";
import { NoteSchema } from "../../tools/live/schemas";

const MAX_OPERATIONS = 512;
const OptionalField = z.enum(["velocity", "muted", "probability", "velocityDeviation", "releaseVelocity"]);

export const NoteUpdateSchema = z.object({
  index: z.number().int().nonnegative(),
  set: NoteSchema.strict().partial().optional(),
  clear: z.array(OptionalField).max(5).optional(),
}).strict().refine((update) => Object.values(update.set ?? {}).some((value) => value !== undefined) || Boolean(update.clear?.length), {
  message: "Each note update needs a defined field to set or an optional field to clear.",
});

export const NoteEditsSchema = z.object({
  updates: z.array(NoteUpdateSchema).max(MAX_OPERATIONS).optional(),
  remove: z.array(z.number().int().nonnegative()).max(MAX_OPERATIONS).optional(),
  add: z.array(NoteSchema.strict()).max(MAX_OPERATIONS).optional(),
}).strict().refine((edit) => Boolean(edit.updates?.length || edit.remove?.length || edit.add?.length), {
  message: "Give at least one note update, removal or addition.",
});

export type NoteEdits = z.input<typeof NoteEditsSchema>;

export interface NotesEditResult {
  notes: Note[];
  /** Original input positions map to new output positions; removed notes map to null. */
  sourceToOutput: (number | null)[];
  updatedSourceIndices: number[];
  removedSourceIndices: number[];
  addedOutputIndices: number[];
}

/** Make explicit, simultaneous edits to one complete note list, preserving every other supported field. */
export function editNotes(notes: readonly Note[], edit: NoteEdits): NotesEditResult {
  const source = NoteSchema.strict().array().parse(notes);
  const parsed = NoteEditsSchema.parse(edit);
  const updates = new Map<number, z.infer<typeof NoteUpdateSchema>>();
  const removed = new Set<number>();
  const requireIndex = (index: number) => {
    if (index >= source.length) throw new RangeError(`Note index ${index} is outside the original input (${source.length} notes).`);
  };
  for (const index of parsed.remove ?? []) {
    requireIndex(index);
    if (removed.has(index)) throw new Error(`Original note index ${index} is removed more than once.`);
    removed.add(index);
  }
  for (const update of parsed.updates ?? []) {
    requireIndex(update.index);
    if (updates.has(update.index)) throw new Error(`Original note index ${update.index} is updated more than once.`);
    if (removed.has(update.index)) throw new Error(`Original note index ${update.index} cannot be updated and removed together.`);
    const clear = update.clear ?? [];
    if (new Set(clear).size !== clear.length) throw new Error(`Original note index ${update.index} clears a field more than once.`);
    for (const field of clear) if (Object.hasOwn(update.set ?? {}, field)) {
      throw new Error(`Original note index ${update.index} cannot set and clear ${field} together.`);
    }
    updates.set(update.index, update);
  }

  const result: NotesEditResult = { notes: [], sourceToOutput: [], updatedSourceIndices: [],
    removedSourceIndices: [...removed].sort((a, b) => a - b), addedOutputIndices: [] };
  source.forEach((before, index) => {
    if (removed.has(index)) { result.sourceToOutput.push(null); return; }
    const note: Note = { ...before };
    const update = updates.get(index);
    if (update) {
      for (const [field, value] of Object.entries(update.set ?? {})) {
        // Direct JavaScript callers can supply undefined; it never means clearing a performance field.
        if (value !== undefined) Object.assign(note, { [field]: value });
      }
      for (const field of update.clear ?? []) delete note[field];
      // Canonical supported wire fields omit undefined and represent -0 as 0, just like MIDI material hashes.
      if (JSON.stringify(before) !== JSON.stringify(NoteSchema.strict().parse(note))) {
        result.updatedSourceIndices.push(index);
      }
    }
    result.sourceToOutput.push(result.notes.length);
    result.notes.push(note);
  });
  for (const note of parsed.add ?? []) {
    result.addedOutputIndices.push(result.notes.length);
    result.notes.push({ ...note });
  }
  if (!result.updatedSourceIndices.length && !result.removedSourceIndices.length && !result.addedOutputIndices.length) {
    throw new Error("These operations do not change any supplied note.");
  }
  return result;
}
