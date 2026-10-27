import type { LineAnalysis, LyricsAnalysis, LyricsNote } from "../../shared/lyrics";
import type { Accent } from "../../shared/personalisation";
import { OriginalityChecker } from "../originality/originality-checker";
import { isOverusedPair } from "../originality/overused-rhymes";
import { LineAnalyzer } from "../phonetics/line-analyzer";
import { describeKind, RhymeKind } from "../rhyme/rhyme-kind";
import { RhymeSchemeBuilder, type RhymePair } from "../rhyme/rhyme-scheme";

/** Rhyming lines whose syllable counts differ by at least this much get a note. */
const COUNT_GAP_FOR_NOTE = 3;
const LOOSE_KINDS: ReadonlySet<RhymeKind> = new Set([RhymeKind.Near, RhymeKind.Assonance]);

function countRange(line: LineAnalysis): [number, number] {
  return [line.counts[0] ?? 0, line.counts.at(-1) ?? 0];
}

function describeCounts(line: LineAnalysis): string {
  const [low, high] = countRange(line);
  return low === high ? `${low}` : `${low}–${high}`;
}

/**
 * Analyses a lyric: each line's words, syllables and stress, the rhyme scheme, and notes on
 * uncertain pronunciations, clichés, loose or over-used rhymes and uneven line lengths.
 */
export class LyricsAnalyzer {
  private readonly schemeBuilder = new RhymeSchemeBuilder();
  private readonly originality = new OriginalityChecker();

  constructor(private readonly accent: Accent) {}

  analyze(lines: string[]): LyricsAnalysis {
    const analyzer = LineAnalyzer.for(this.accent);
    const analyses = lines.map((line) => analyzer.analyze(line));
    const { scheme, pairs } = this.schemeBuilder.build(analyses);
    const notes = [
      ...this.uncertainNotes(analyses),
      ...this.clicheNotes(lines),
      ...this.rhymeNotes(pairs),
      ...this.lengthNotes(analyses, pairs),
    ].sort((a, b) => a.line - b.line);
    return { lines: analyses, scheme, notes };
  }

  private uncertainNotes(lines: LineAnalysis[]): LyricsNote[] {
    return lines.flatMap((line, index) => {
      const words = new Set(line.words.filter((word) => !word.certain).map((word) => word.text));
      return [...words].map((word) => ({
        line: index,
        kind: "uncertain" as const,
        message: `The pronunciation of "${word}" is not certain in this accent (no dictionary entry settles it), so its syllables, stress and rhymes are a best guess.`,
      }));
    });
  }

  private clicheNotes(lines: string[]): LyricsNote[] {
    return lines.flatMap((line, index) =>
      this.originality.findCliches([line]).map((phrase) => ({
        line: index,
        kind: "cliche" as const,
        message: `"${phrase}" is a cliché; a fresher, more specific image will stand out more.`,
      })),
    );
  }

  private rhymeNotes(pairs: RhymePair[]): LyricsNote[] {
    const notes: LyricsNote[] = [];
    for (const pair of pairs) {
      const [first, second] = pair.lines;
      const [wordA, wordB] = pair.words;
      const where = `Lines ${first + 1} and ${second + 1}`;
      if (LOOSE_KINDS.has(pair.kind)) {
        notes.push({ line: second, kind: "rhyme", message: `${where} rhyme only loosely (${describeKind(pair.kind)}: "${wordA}" / "${wordB}").` });
      } else if (pair.kind === RhymeKind.Identical) {
        notes.push({
          line: second,
          kind: "rhyme",
          message: `${where} end on the same sound ("${wordA}" / "${wordB}"), an identical rhyme, which can feel flat unless the repeat is deliberate.`,
        });
      }
      if (isOverusedPair(wordA, wordB)) {
        notes.push({
          line: second,
          kind: "rhyme",
          message: `"${wordA}" / "${wordB}" is a very common rhyme pair; listeners may hear it coming.`,
        });
      }
    }
    return notes;
  }

  private lengthNotes(lines: LineAnalysis[], pairs: RhymePair[]): LyricsNote[] {
    const notes: LyricsNote[] = [];
    for (const pair of pairs) {
      const [first, second] = pair.lines;
      const a = lines[first];
      const b = lines[second];
      if (!a || !b) continue;
      const [lowA, highA] = countRange(a);
      const [lowB, highB] = countRange(b);
      const gap = Math.max(0, lowA - highB, lowB - highA);
      if (gap < COUNT_GAP_FOR_NOTE) continue;
      notes.push({
        line: second,
        kind: "prosody",
        message: `Lines ${first + 1} and ${second + 1} rhyme but have ${describeCounts(a)} and ${describeCounts(b)} syllables; sung to the same melody, one of them will feel crowded or stretched.`,
      });
    }
    return notes;
  }
}

/** Analyses lyric lines: per-line analysis, rhyme-scheme letters and notes in plain words. */
export function analyzeLyrics(lines: string[], accent: Accent): LyricsAnalysis {
  return new LyricsAnalyzer(accent).analyze(lines);
}
