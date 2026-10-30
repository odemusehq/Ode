import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import { setLyricsToMelody, type LyricSetting } from "./lyric-setter";
import { melodyLine } from "./melody-line";

export interface EditableLyricSetting extends LyricSetting {
  /** Complete replacement material, including every preserved source note. */
  notes: Note[];
  /** Zero-based indices into the complete returned notes, never the vocal subset. */
  alignment: LyricSetting["alignment"];
  /** Selected vocal material only; its alignment indexes this subset's notes. */
  melody: Pick<LyricSetting, "notes" | "alignment">;
  /** Zero-based positions in the original input, not the returned complete notes. */
  selectedSourceIndices: number[];
  preservedSourceIndices: number[];
}

/** Editable setting: the analysis core stays vocal-only, while every other source note survives. */
export function setEditableLyricsToMelody(
  line: LineAnalysis,
  notes: Note[],
  beatsPerBar: number,
  beatUnit: number,
  sourceIndices?: readonly number[],
): EditableLyricSetting {
  const selectedSourceIndices = sourceIndices === undefined
    ? notes.flatMap((note, index) => note.muted ? [] : [index])
    : [...sourceIndices];
  if (selectedSourceIndices.length === 0) throw new Error("Select at least one unmuted source note for the vocal line.");
  if (selectedSourceIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= notes.length)) throw new Error("sourceIndices must be integer indices within the original input notes.");
  const selected = new Set(selectedSourceIndices);
  if (selected.size !== selectedSourceIndices.length) throw new Error("Each source note index must be selected once; duplicate indices are ambiguous.");
  if (selectedSourceIndices.some((index) => notes[index]!.muted)) throw new Error("A selected source note is muted. Choose the intended unmuted line; muted notes are preserved unchanged.");
  const selectedNotes = selectedSourceIndices.map((index) => notes[index]!);
  if (selectedNotes.some((note) => !Number.isFinite(note.start) || !Number.isFinite(note.duration) || note.duration <= 0)) throw new Error("Selected melody notes need finite starts and positive finite durations.");
  if (melodyLine(selectedNotes).length !== selectedNotes.length) throw new Error("The selected melody has simultaneous or near-simultaneous attacks. Choose one intended line with sourceIndices; no highest voice is inferred.");

  const setting = setLyricsToMelody(line, selectedNotes, beatsPerBar, beatUnit);
  const preservedSourceIndices = notes.flatMap((_note, index) => selected.has(index) ? [] : [index]);
  const entries = [
    ...preservedSourceIndices.map((index) => ({ note: { ...notes[index]! }, melodyIndex: null })),
    ...setting.notes.map((note, melodyIndex) => ({ note: { ...note }, melodyIndex })),
  ].sort((a, b) => a.note.start - b.note.start || a.note.pitch - b.note.pitch);
  const completeIndices: number[] = [];
  entries.forEach((entry, index) => { if (entry.melodyIndex !== null) completeIndices[entry.melodyIndex] = index; });
  return {
    ...setting,
    notes: entries.map((entry) => entry.note),
    alignment: setting.alignment.map((pair) => ({ ...pair, note: completeIndices[pair.note]! })),
    melody: { notes: setting.notes, alignment: setting.alignment },
    selectedSourceIndices,
    preservedSourceIndices,
  };
}
