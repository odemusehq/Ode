import type { LineAnalysis } from "../../shared/lyrics";
import type { Accent } from "../../shared/personalisation";
import { isFunctionWord } from "../phonetics/function-words";
import { LineAnalyzer } from "../phonetics/line-analyzer";
import { RhymeComparer } from "./rhyme-comparer";
import { RhymeKind, SCHEME_KINDS, STRONG_KINDS, type RhymeResult } from "./rhyme-kind";
import { lineEndUnits, wordUnits } from "./rhyme-unit";

export interface RhymePair {
  /** Line indexes (0-based), earlier line first. */
  lines: [number, number];
  kind: RhymeKind;
  score: number;
  words: [string, string];
}

export interface InternalRhyme {
  line: number;
  words: [string, string];
  kind: RhymeKind;
  score: number;
}

export interface SchemeAnalysis {
  /** A letter per line ("A", "B"…), "-" for a line with no rhyme partner. */
  scheme: string[];
  /** The partner each rhyming line was matched with. */
  pairs: RhymePair[];
}

export const NO_PARTNER = "-";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Near rhymes and assonance only pair lines this close; perfect and identical rhymes pair at any distance. */
const WEAK_RHYME_WINDOW = 4;
const ASSONANCE_SCHEME_MIN = 0.45;
const INTERNAL_KINDS: ReadonlySet<RhymeKind> = new Set([RhymeKind.Perfect, RhymeKind.Multisyllabic, RhymeKind.Near]);
const MAX_INTERNAL_PER_LINE = 6;

function letterName(index: number): string {
  const letter = LETTERS[index % LETTERS.length] ?? "Z";
  const round = Math.floor(index / LETTERS.length);
  return round === 0 ? letter : `${letter}${round + 1}`;
}

function lastWordText(line: LineAnalysis): string {
  return line.words.at(-1)?.text ?? "";
}

/** Lines joined into rhyme groups (disjoint sets). */
class LineGroups {
  private readonly parent: number[];

  constructor(count: number) {
    this.parent = Array.from({ length: count }, (_, index) => index);
  }

  root(index: number): number {
    let current = index;
    while (this.parent[current] !== current) current = this.parent[current] ?? current;
    return current;
  }

  join(line: number, partner: number): void {
    this.parent[this.root(line)] = this.root(partner);
  }
}

/** Groups line endings into a rhyme scheme and finds rhymes inside lines. */
export class RhymeSchemeBuilder {
  private readonly comparer = new RhymeComparer();

  build(lines: LineAnalysis[]): SchemeAnalysis {
    const units = lines.map((line) => lineEndUnits(line));
    const groups = new LineGroups(lines.length);
    const pairs: RhymePair[] = [];
    lines.forEach((line, index) => {
      let best: { partner: number; rhyme: RhymeResult } | null = null;
      for (let partner = 0; partner < index; partner++) {
        const rhyme = this.comparer.best(units[index] ?? [], units[partner] ?? []);
        if (!this.joins(rhyme, index - partner)) continue;
        if (!best || rhyme.score > best.rhyme.score) best = { partner, rhyme };
      }
      if (!best) return;
      pairs.push({
        lines: [best.partner, index],
        kind: best.rhyme.kind,
        score: best.rhyme.score,
        words: [lastWordText(lines[best.partner] ?? line), lastWordText(line)],
      });
      groups.join(index, best.partner);
    });
    return { scheme: this.letters(lines.length, groups), pairs };
  }

  /** Rhymes between words of the same line (content words only, a word never rhyming with itself). */
  internalRhymes(lines: LineAnalysis[]): InternalRhyme[] {
    const found: InternalRhyme[] = [];
    lines.forEach((line, lineIndex) => {
      const words = line.words.filter((word) => !isFunctionWord(word.text) && word.options.length > 0);
      const inLine: InternalRhyme[] = [];
      words.forEach((first, i) => {
        for (const second of words.slice(i + 1)) {
          if (first.text.toLowerCase() === second.text.toLowerCase()) continue;
          const rhyme = this.comparer.best(wordUnits(first), wordUnits(second));
          if (INTERNAL_KINDS.has(rhyme.kind)) {
            inLine.push({ line: lineIndex, words: [first.text, second.text], kind: rhyme.kind, score: rhyme.score });
          }
        }
      });
      found.push(...inLine.sort((a, b) => b.score - a.score).slice(0, MAX_INTERNAL_PER_LINE));
    });
    return found;
  }

  private joins(rhyme: RhymeResult, distance: number): boolean {
    if (!SCHEME_KINDS.has(rhyme.kind)) return false;
    if (STRONG_KINDS.has(rhyme.kind) || rhyme.kind === RhymeKind.Identical) return true;
    if (distance > WEAK_RHYME_WINDOW) return false;
    return rhyme.kind !== RhymeKind.Assonance || rhyme.score >= ASSONANCE_SCHEME_MIN;
  }

  private letters(count: number, groups: LineGroups): string[] {
    const sizes = new Map<number, number>();
    for (let index = 0; index < count; index++) {
      const group = groups.root(index);
      sizes.set(group, (sizes.get(group) ?? 0) + 1);
    }
    const names = new Map<number, string>();
    const scheme: string[] = [];
    for (let index = 0; index < count; index++) {
      const group = groups.root(index);
      if ((sizes.get(group) ?? 0) < 2) {
        scheme.push(NO_PARTNER);
        continue;
      }
      let name = names.get(group);
      if (!name) {
        name = letterName(names.size);
        names.set(group, name);
      }
      scheme.push(name);
    }
    return scheme;
  }
}

const builder = new RhymeSchemeBuilder();

/** Analyses lyric lines and returns their rhyme scheme and partners. */
export function analyzeScheme(lines: string[], accent: Accent): SchemeAnalysis {
  const analyzer = LineAnalyzer.for(accent);
  return builder.build(lines.map((line) => analyzer.analyze(line)));
}

/** Rhyme-scheme letter per line ("A", "B"…; "-" for a line with no partner). */
export function rhymeScheme(lines: string[], accent: Accent): string[] {
  return analyzeScheme(lines, accent).scheme;
}
