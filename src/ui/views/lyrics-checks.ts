import type { LineAnalysis, LyricsNote, LyricsState } from "../../shared/lyrics";
import { formatSyllableCounts } from "../../ui-kit";
import { LineDiff } from "../app/line-diff";

/** What the gutter and the caret line show for one line of the editor. */
export interface CheckedLine {
  /** Syllable count, e.g. "8" or "7–8"; empty for a blank or label line, or one not checked yet. */
  count: string;
  /** Rhyme-scheme letter; empty when the line rhymes with none. */
  rhyme: string;
  notes: readonly LyricsNote[];
  /** Words, syllables and stress; null when there is nothing to show. */
  analysis: LineAnalysis | null;
}

const NOT_CHECKED: CheckedLine = { count: "", rhyme: "", notes: [], analysis: null };
const NO_RHYME = "-";
/** A line in square brackets, such as "[Chorus]", is a label and isn't sung. */
const LABEL_LINE = /^\[[^\]]*\]$/;

/** A line that is sung: not blank and not a label. */
export function isSungLine(line: string): boolean {
  const text = line.trim();
  return text !== "" && !LABEL_LINE.test(text);
}

/**
 * The stored analysis laid over the lines in the editor, matched line by line, so the checks stay on their lines
 * while the musician types; a line edited since the last save shows nothing until the save comes back checked.
 */
export function checkedLines(lines: readonly string[], stored: LyricsState): CheckedLine[] {
  const { afterToBefore } = new LineDiff(LineDiff.lines(stored.text), lines).alignment();
  const notes = notesByLine(stored.analysis.notes);
  return lines.map((line, index) => {
    const source = afterToBefore[index] ?? -1;
    const analysis = source >= 0 && isSungLine(line) ? stored.analysis.lines[source] : undefined;
    if (!analysis || analysis.words.length === 0) return NOT_CHECKED;
    const rhyme = stored.analysis.scheme[source] ?? NO_RHYME;
    return {
      count: formatSyllableCounts(analysis.counts),
      rhyme: rhyme === NO_RHYME ? "" : rhyme,
      notes: notes.get(source) ?? [],
      analysis,
    };
  });
}

function notesByLine(notes: readonly LyricsNote[]): Map<number, LyricsNote[]> {
  const byLine = new Map<number, LyricsNote[]>();
  for (const note of notes) byLine.set(note.line, [...(byLine.get(note.line) ?? []), note]);
  return byLine;
}
