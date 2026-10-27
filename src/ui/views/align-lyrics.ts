import type { Note } from "../../shared/live";
import type { LyricsAnalysis, SyllableInfo } from "../../shared/lyrics";
import type { LyricMark } from "../../ui-kit";

const SAME_ONSET = 1e-6;

/**
 * Puts the syllables of the lines under the notes in time order, one syllable per onset
 * (the highest note of a chord gets it). Muted notes get none.
 */
export function alignSyllables(notes: readonly Note[], analysis: LyricsAnalysis): (LyricMark | null)[] {
  const syllables = analysis.lines.flatMap((line) => line.words.flatMap((word) => firstReading(word.options)));
  const order = notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => !note.muted)
    .sort((a, b) => a.note.start - b.note.start || b.note.pitch - a.note.pitch);
  const marks: (LyricMark | null)[] = notes.map(() => null);
  let next = 0;
  let lastOnset = Number.NEGATIVE_INFINITY;
  for (const { note, index } of order) {
    if (Math.abs(note.start - lastOnset) < SAME_ONSET) continue;
    lastOnset = note.start;
    const syllable = syllables[next];
    if (!syllable) break;
    marks[index] = { text: syllable.text, stress: syllable.stress };
    next += 1;
  }
  return marks;
}

function firstReading(options: readonly { syllables: SyllableInfo[] }[]): SyllableInfo[] {
  return options[0]?.syllables ?? [];
}
