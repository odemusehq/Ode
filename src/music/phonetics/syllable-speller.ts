import createHyphenator from "hyphen/hyphen.js";
import britishPatterns from "hyphen/patterns/en-gb.js";
import americanPatterns from "hyphen/patterns/en-us.js";
import type { Accent } from "../../shared/personalisation";
import { vowelGroups } from "./grapheme-aligner";

/** Hyphenators built from the hyphen package's TeX patterns, per spelling. */
const HYPHENATION: Readonly<Record<Accent, Hyphenate>> = { us: createHyphenator(americanPatterns), uk: createHyphenator(britishPatterns) };
const SOFT_HYPHEN = "\u00AD";
const SPLIT_ANY_LENGTH = 1;
const DIGRAPHS = new Set(["ch", "sh", "th", "ph", "wh", "ck", "gh", "ng"]);

function vowelCount(text: string): number {
  return vowelGroups(text.toLowerCase()).length;
}

/**
 * Splits a word's spelling into a given number of syllables for display under notes. Starts from
 * dictionary hyphenation (en-us or en-gb), then merges or splits pieces to match the sung syllable
 * count. Letters are never lost or reordered; a piece is empty only when the word has fewer letters
 * than syllables.
 */
export class SyllableSpeller {
  private static readonly instances = new Map<Accent, SyllableSpeller>();
  private readonly cache = new Map<string, string[]>();

  private constructor(private readonly accent: Accent) {}

  static for(accent: Accent): SyllableSpeller {
    let speller = SyllableSpeller.instances.get(accent);
    if (!speller) {
      speller = new SyllableSpeller(accent);
      SyllableSpeller.instances.set(accent, speller);
    }
    return speller;
  }

  spell(word: string, count: number): string[] {
    const key = `${word}|${count}`;
    const cached = this.cache.get(key);
    if (cached) return [...cached];
    const pieces = this.hyphenate(word);
    while (pieces.length > Math.max(count, 1)) this.mergeBest(pieces);
    while (pieces.length < count) {
      if (!this.splitBest(pieces)) break;
    }
    while (pieces.length < count) pieces.push("");
    this.cache.set(key, pieces);
    return [...pieces];
  }

  private hyphenate(word: string): string[] {
    const marked = HYPHENATION[this.accent](word, { hyphenChar: SOFT_HYPHEN, minWordLength: SPLIT_ANY_LENGTH });
    const pieces = marked.split(SOFT_HYPHEN).filter((piece) => piece.length > 0);
    return pieces.join("") === word ? pieces : [word];
  }

  /** Merges the neighbours whose union looks most like one syllable, preferring the later pair. */
  private mergeBest(pieces: string[]): void {
    let best = 0;
    let bestVowels = Number.POSITIVE_INFINITY;
    for (let index = 0; index + 1 < pieces.length; index++) {
      const vowels = vowelCount((pieces[index] ?? "") + (pieces[index + 1] ?? ""));
      if (vowels <= bestVowels) {
        bestVowels = vowels;
        best = index;
      }
    }
    pieces.splice(best, 2, (pieces[best] ?? "") + (pieces[best + 1] ?? ""));
  }

  /** Splits the piece with the most vowel groups at its most natural point; false if nothing can be split. */
  private splitBest(pieces: string[]): boolean {
    let best = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestPoint = 0;
    pieces.forEach((piece, index) => {
      const point = this.splitPoint(piece);
      if (point === null) return;
      const score = vowelCount(piece) * piece.length + piece.length;
      if (score > bestScore) {
        bestScore = score;
        best = index;
        bestPoint = point;
      }
    });
    if (best < 0) return false;
    const piece = pieces[best] ?? "";
    pieces.splice(best, 1, piece.slice(0, bestPoint), piece.slice(bestPoint));
    return true;
  }

  private splitPoint(piece: string): number | null {
    if (piece.length < 2) return null;
    const hyphen = piece.indexOf("-");
    if (hyphen > 0 && hyphen < piece.length - 1) return hyphen + 1;
    const apostrophe = piece.indexOf("'", 1);
    if (apostrophe > 0 && apostrophe < piece.length - 1) {
      if (piece.startsWith("'")) return apostrophe + 1;
      return apostrophe;
    }
    const groups = vowelGroups(piece.toLowerCase());
    if (groups.length >= 2) {
      const middle = Math.floor(groups.length / 2);
      const left = groups[middle - 1];
      const right = groups[middle];
      if (left && right) return this.betweenVowels(piece.toLowerCase(), left.end, right.start);
    }
    const only = groups[0];
    if (only && only.end < piece.length) return only.end;
    if (only && only.start > 0) return only.start;
    return piece.length > 1 ? piece.length - 1 : null;
  }

  /** V-CV ("ti-ger"), VC-CV ("hap-py"), keeping digraphs together ("bro-ther"). */
  private betweenVowels(lower: string, leftEnd: number, rightStart: number): number {
    const consonants = rightStart - leftEnd;
    if (consonants <= 1) return leftEnd;
    if (DIGRAPHS.has(lower.slice(leftEnd, leftEnd + 2))) return consonants === 2 ? leftEnd : leftEnd + 2;
    return leftEnd + 1;
  }
}

/** The spelling of a word split into `count` syllables, in UK or US hyphenation. */
export function spellSyllables(word: string, count: number, accent: Accent): string[] {
  return SyllableSpeller.for(accent).spell(word, count);
}
