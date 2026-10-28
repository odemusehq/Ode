import type { Note } from "../../shared/live";
import type { ChordEvent, LyricLine, Section } from "../../shared/song";
import { ChangeKind } from "../../shared/versions";
import type { SetChange } from "../../shared/versions";
import { pitchClassName } from "../../ui-kit";

export enum ChangeViewKind {
  /** The change's label says it all. */
  None = "none",
  /** A value before and after, in words. */
  Text = "text",
  /** Notes before and after; one side is missing for a clip that was added or removed. */
  Notes = "notes",
}

export type ChangeView =
  | { kind: ChangeViewKind.None }
  | { kind: ChangeViewKind.Text; before: string; after: string }
  | { kind: ChangeViewKind.Notes; before?: Note[]; after?: Note[] };

type BooleanWords = readonly [off: string, on: string];

/** A lyric line that changed: the old words above the new; one side is missing for a line added or removed. */
export interface LineDifference {
  /** Where the line is now, from 1; where it was, for a removed line. */
  number: number;
  before?: string;
  after?: string;
}

/** What changed inside a lead-sheet section: its lines, and its chords bar by bar when they differ. */
export interface SectionDifference {
  lines: LineDifference[];
  chords?: { before: string; after: string };
}

const ARROW = "→";
const NO_VIEW: ChangeView = { kind: ChangeViewKind.None };
const BOOLEAN_WORDS: Readonly<Record<string, BooleanWords>> = {
  mute: ["Not muted", "Muted"],
  muted: ["Not muted", "Muted"],
  solo: ["Not soloed", "Soloed"],
  arm: ["Not armed", "Armed"],
};
const ON_OFF: BooleanWords = ["Off", "On"];
/** Raw values that mean nothing to read, such as a colour's number; the label says what changed. */
const UNREADABLE_FIELDS: ReadonlySet<string> = new Set(["color"]);
/** Chord-chart marks: no chord in the bar, the chord carrying on through it, the line between bars. */
const NO_CHORD = "N.C.";
const REPEAT_BAR = "%";
const BAR_LINE = " | ";
const NO_CHORDS = "no chords";

/** How a version's change is shown beside its label: notes on piano rolls, a value before and after, or nothing more. */
export function changeView(change: SetChange): ChangeView {
  const { target, kind, before, after, label } = change;
  if (target.scope === "sheet") return NO_VIEW;
  const field: string = target.field;
  if (target.scope === "clip" && (field === "notes" || field === "present")) {
    const notesBefore = notesOf(before, field);
    const notesAfter = notesOf(after, field);
    if (notesBefore || notesAfter) return { kind: ChangeViewKind.Notes, before: notesBefore, after: notesAfter };
  }
  if (kind !== ChangeKind.Changed || UNREADABLE_FIELDS.has(field) || label.includes(ARROW)) return NO_VIEW;
  const words = BOOLEAN_WORDS[field] ?? ON_OFF;
  const beforeText = valueText(before, words);
  const afterText = valueText(after, words);
  if (beforeText === null || afterText === null || beforeText === afterText) return NO_VIEW;
  return { kind: ChangeViewKind.Text, before: beforeText, after: afterText };
}

/**
 * What changed in a lead-sheet section that is still there: each line that differs, and the chords when they differ.
 * Null for an added or removed section, the rest of the lead sheet, or anything else (their label says it).
 */
export function sectionDifference(change: SetChange, beatsPerBar: number): SectionDifference | null {
  const { target, kind, before, after } = change;
  if (target.scope !== "sheet" || target.field !== "section" || kind !== ChangeKind.Changed) return null;
  if (!isSection(before) || !isSection(after)) return null;
  const chordsBefore = chordBars(before, beatsPerBar);
  const chordsAfter = chordBars(after, beatsPerBar);
  return {
    lines: lineDifferences(before, after),
    chords: chordsBefore === chordsAfter ? undefined : { before: chordsBefore, after: chordsAfter },
  };
}

/** The last beat any of the notes sounds, from the clip start. */
export function notesEnd(notes: readonly Note[]): number {
  return notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
}

/** A clip's notes when its notes changed, or the notes of a whole MIDI clip that was added or removed. */
function notesOf(value: unknown, field: string): Note[] | undefined {
  if (field === "notes") return isNoteList(value) ? value : undefined;
  if (isRecord(value) && isNoteList(value.notes)) return value.notes;
  return undefined;
}

function valueText(value: unknown, words: BooleanWords): string | null {
  if (typeof value === "boolean") return value ? words[1] : words[0];
  if (typeof value === "number") return Number.isFinite(value) ? String(Number(value.toFixed(2))) : null;
  if (typeof value === "string") return `“${value}”`;
  if (!isRecord(value)) return null;
  if (typeof value.numerator === "number" && typeof value.denominator === "number") return `${value.numerator}/${value.denominator}`;
  const root = value.root ?? value.rootNote;
  const scale = value.scale ?? value.scaleName;
  if (typeof root === "number" && typeof scale === "string") return `${pitchClassName(root)} ${scale}`;
  return null;
}

/**
 * Lines are matched by id. A line whose id is new takes the place of the next line that lost its id (a rewrite that
 * replaced the lines), and what is left over was added or removed. Blank lines don't count.
 */
function lineDifferences(before: Section, after: Section): LineDifference[] {
  const kept = new Set(after.lines.map((line) => line.id));
  const unmatched = before.lines.filter((line) => !kept.has(line.id));
  const differences: LineDifference[] = [];
  let spare = 0;
  for (const [index, line] of after.lines.entries()) {
    let old = before.lines.find((candidate) => candidate.id === line.id);
    if (!old) {
      old = unmatched[spare];
      spare += 1;
    }
    const was = wordsOf(old);
    const now = wordsOf(line);
    if (was !== now) differences.push({ number: index + 1, before: was, after: now });
  }
  for (const line of unmatched.slice(spare)) {
    const was = wordsOf(line);
    if (was !== undefined) differences.push({ number: before.lines.indexOf(line) + 1, before: was });
  }
  return differences;
}

/** A line's words, or undefined for a blank or missing line. */
function wordsOf(line: LyricLine | undefined): string | undefined {
  const words = line?.text.trim();
  return words ? words : undefined;
}

/** A section's chords bar by bar, as on a chord chart: "Am | F | C G | %". */
function chordBars(section: Section, beatsPerBar: number): string {
  if (section.chords.length === 0) return NO_CHORDS;
  const chords = [...section.chords].sort((a, b) => a.beat - b.beat);
  const end = chords.reduce((last, chord) => Math.max(last, chord.beat + chord.lengthBeats), section.lengthBeats);
  const bars = Math.max(1, Math.ceil(end / beatsPerBar));
  const cells: string[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * beatsPerBar;
    const starting = chords.filter((chord) => chord.beat >= start && chord.beat < start + beatsPerBar);
    if (starting.length > 0) cells.push(starting.map((chord) => chord.symbol).join(" "));
    else cells.push(chords.some((chord) => chord.beat < start && chord.beat + chord.lengthBeats > start) ? REPEAT_BAR : NO_CHORD);
  }
  return cells.join(BAR_LINE);
}

function isSection(value: unknown): value is Section {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.lengthBeats === "number" &&
    Array.isArray(value.lines) &&
    value.lines.every(isLyricLine) &&
    Array.isArray(value.chords) &&
    value.chords.every(isChordEvent)
  );
}

function isLyricLine(value: unknown): value is LyricLine {
  return isRecord(value) && typeof value.id === "string" && typeof value.text === "string";
}

function isChordEvent(value: unknown): value is ChordEvent {
  return isRecord(value) && typeof value.beat === "number" && typeof value.lengthBeats === "number" && typeof value.symbol === "string";
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
