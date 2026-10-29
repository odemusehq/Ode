import type { LineCheck } from "../../shared/lyrics";

/** A stretch of a line with one look: part of a syllable (or text between words), with the rhyme inside it. */
export interface MarkRun {
  text: string;
  /** Set for a stretch inside a word whose syllables are known: the bar before it, and its stress. */
  syllable: { barBefore: boolean; stressed: boolean } | null;
  /** The stretch of `text` that carries the rhyme, as start and end offsets. */
  rhyme: [number, number] | null;
}

interface Located {
  start: number;
  end: number;
  /** Where each syllable starts, with its stress; empty when the pieces fail to spell the word as typed. */
  syllables: { start: number; stressed: boolean }[];
}

/**
 * Lays Lyrics support's marks over a line as typed. The model's words are found in order in the line, each word's
 * syllables are placed where their letters sit, and the rhyme covers the letters of the last word that carry it.
 */
export class MarkLayout {
  static runs(line: string, check: LineCheck | null): MarkRun[] {
    if (!check) return [{ text: line, syllable: null, rhyme: null }];
    const words = MarkLayout.locate(line, check);
    const rhyme = MarkLayout.rhyme(line, check, words);
    const cuts = new Set<number>([0, line.length]);
    for (const word of words) {
      cuts.add(word.start);
      cuts.add(word.end);
      for (const syllable of word.syllables) cuts.add(syllable.start);
    }
    const sorted = [...cuts].filter((cut) => cut >= 0 && cut <= line.length).sort((a, b) => a - b);
    const runs: MarkRun[] = [];
    for (let at = 0; at + 1 < sorted.length; at++) {
      const start = sorted[at] ?? 0;
      const end = sorted[at + 1] ?? start;
      if (end <= start) continue;
      runs.push({ text: line.slice(start, end), syllable: MarkLayout.syllableAt(words, start), rhyme: MarkLayout.within(rhyme, start, end) });
    }
    return runs;
  }

  /** The syllable count the model gave the line. */
  static count(check: LineCheck): number {
    return check.words.reduce((sum, word) => sum + word.syllables.length, 0);
  }

  private static locate(line: string, check: LineCheck): Located[] {
    const lower = line.toLowerCase();
    const located: Located[] = [];
    let cursor = 0;
    for (const word of check.words) {
      const text = word.text.toLowerCase();
      if (!text) continue;
      const start = lower.indexOf(text, cursor);
      if (start < 0) continue;
      const end = start + text.length;
      cursor = end;
      const spells = word.syllables.join("").toLowerCase() === text && word.syllables.length > 0;
      let offset = start;
      const syllables = spells
        ? word.syllables.map((piece, index) => {
            const syllable = { start: offset, stressed: word.stress[index] === 1 };
            offset += piece.length;
            return syllable;
          })
        : [];
      located.push({ start, end, syllables });
    }
    return located;
  }

  /** The letters of the last word that carry the rhyme, as offsets in the line. */
  private static rhyme(line: string, check: LineCheck, words: readonly Located[]): [number, number] | null {
    const { letter, part } = check.rhyme;
    const last = words[words.length - 1];
    if (!letter || !part || !last) return null;
    const at = line.slice(last.start, last.end).toLowerCase().lastIndexOf(part.toLowerCase());
    return at < 0 ? null : [last.start + at, last.start + at + part.length];
  }

  private static syllableAt(words: readonly Located[], position: number): MarkRun["syllable"] {
    for (const word of words) {
      if (position < word.start || position >= word.end) continue;
      let index = -1;
      word.syllables.forEach((syllable, at) => {
        if (syllable.start <= position) index = at;
      });
      const syllable = word.syllables[index];
      if (!syllable) return null;
      return { barBefore: index > 0 && syllable.start === position, stressed: syllable.stressed };
    }
    return null;
  }

  private static within(range: [number, number] | null, start: number, end: number): [number, number] | null {
    if (!range) return null;
    const from = Math.max(range[0], start);
    const to = Math.min(range[1], end);
    return from < to ? [from - start, to - start] : null;
  }
}
