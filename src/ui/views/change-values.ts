import type { Note } from "../../shared/live";
import type { SetChange } from "../../shared/versions";
import { LineDiff } from "../app/line-diff";
import type { LineHunk } from "../app/line-diff";

/** Between the part a change is in and what changed: "Bass · notes in bars 9–16". */
const LABEL_SEPARATOR = " · ";

/** A clip's notes before and after; one side is missing for a clip that was added or removed. */
export interface NotesChange {
  before?: Note[];
  after?: Note[];
}

/** The notes before and after, for a change to a MIDI clip's notes or a MIDI clip added or removed; otherwise null. */
export function notesChange(change: SetChange): NotesChange | null {
  const { target, before, after } = change;
  if (target.scope !== "clip" || (target.field !== "notes" && target.field !== "present")) return null;
  const notesBefore = notesOf(before, target.field);
  const notesAfter = notesOf(after, target.field);
  return notesBefore || notesAfter ? { before: notesBefore, after: notesAfter } : null;
}

export function isLyricsChange(change: SetChange): boolean {
  return change.target.scope === "sheet" && change.target.field === "lyrics";
}

/** The lines of the lyrics that changed, each place with its old lines and the new ones; blank lines left out. */
export function lyricsHunks(change: SetChange): LineHunk[] {
  const diff = new LineDiff(LineDiff.lines(textOf(change.before)), LineDiff.lines(textOf(change.after)));
  return diff
    .hunks()
    .map((hunk) => ({ removed: hunk.removed.filter(isWritten), added: hunk.added.filter(isWritten) }))
    .filter((hunk) => hunk.removed.length > 0 || hunk.added.length > 0);
}

/** The last beat any of the notes sounds, from the clip start. */
export function notesEnd(notes: readonly Note[]): number {
  return notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
}

/** A label without the name of the part it is shown under: "Bass · notes in bars 9–16" under Bass. */
export function labelUnder(label: string, heading: string): string {
  const prefix = `${heading}${LABEL_SEPARATOR}`;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

/** A line with words on it, sung or a label such as "[Chorus]"; blank lines between stanzas are left out. */
function isWritten(line: string): boolean {
  return line.trim() !== "";
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A clip's notes when its notes changed, or the notes of a whole MIDI clip that was added or removed. */
function notesOf(value: unknown, field: "notes" | "present"): Note[] | undefined {
  if (field === "notes") return isNoteList(value) ? value : undefined;
  if (isRecord(value) && isNoteList(value.notes)) return value.notes;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoteList(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every(isNote);
}

function isNote(value: unknown): value is Note {
  return isRecord(value) && typeof value.pitch === "number" && typeof value.start === "number" && typeof value.duration === "number";
}
