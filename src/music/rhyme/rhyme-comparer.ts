import type { Accent } from "../../shared/personalisation";
import { LineAnalyzer } from "../phonetics/line-analyzer";
import { isVowel } from "../phonetics/phoneme";
import { Stress } from "../phonetics/pronunciation";
import { nucleiMatch, sequenceSimilarity, vowelSimilarity } from "./phoneme-similarity";
import { NO_RHYME, RhymeKind, strongerRhyme, type RhymeResult } from "./rhyme-kind";
import { lastStressedIndex, lineEndUnits, rhymeTail, type RhymeSyllable, type RhymeUnit } from "./rhyme-unit";

/** Scores per kind (0–1). An identical rhyme repeats the same sound outright, so it scores low. */
const PERFECT_SCORE = 1;
const IDENTICAL_SCORE = 0.5;
const MULTISYLLABIC_BASE = 0.9;
const MULTISYLLABIC_PER_SYLLABLE = 0.025;
const NEAR_BASE = 0.6;
const NEAR_RANGE = 0.3;
const NEAR_VOWEL_BASE = 0.55;
const NEAR_VOWEL_RANGE = 0.25;
const ASSONANCE_BASE = 0.4;
const ASSONANCE_RANGE = 0.25;
const CONSONANCE_BASE = 0.3;
const CONSONANCE_RANGE = 0.2;
const NONE_RANGE = 0.3;

/** How alike the sounds after the vowel must be for a near rhyme, and how alike two vowels must be. */
const NEAR_REST_MIN = 0.6;
const NEAR_VOWEL_MIN = 0.8;
/** How alike the final consonants must be for a multisyllabic rhyme. */
const MULTISYLLABIC_CODA_MIN = 0.5;
const MIN_MULTISYLLABIC_LENGTH = 2;

interface VowelRun {
  length: number;
  multisyllabic: boolean;
}

function sameSequence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((phoneme, index) => phoneme === b[index]);
}

function consonantsOf(phonemes: string[]): string[] {
  return phonemes.filter((phoneme) => !isVowel(phoneme));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function result(kind: RhymeKind, score: number): RhymeResult {
  return { kind, score: rounded(Math.min(1, Math.max(0, score))) };
}

/**
 * Labels how two word or line endings rhyme. The rhyming part runs from the last stressed vowel to
 * the end, across word boundaries for line endings: identical tails are a perfect rhyme (identical
 * when the stressed syllable's onset is the same too); vowels matching over several syllables beyond
 * that tail make a multisyllabic rhyme; otherwise near rhyme, assonance or consonance, and RhymeKind.None for the rest.
 */
export class RhymeComparer {
  compare(a: RhymeUnit, b: RhymeUnit): RhymeResult {
    if (a.lastWord.length > 0 && a.lastWord === b.lastWord) return result(RhymeKind.Identical, IDENTICAL_SCORE);
    const indexA = lastStressedIndex(a.syllables);
    const indexB = lastStressedIndex(b.syllables);
    const stressedA = a.syllables[indexA];
    const stressedB = b.syllables[indexB];
    if (!stressedA || !stressedB) return NO_RHYME;
    const tailA = rhymeTail(a.syllables, indexA);
    const tailB = rhymeTail(b.syllables, indexB);
    const shorterTail = Math.min(a.syllables.length - indexA, b.syllables.length - indexB);
    const run = this.vowelRun(a.syllables, b.syllables, shorterTail);
    if (sameSequence(tailA, tailB)) {
      if (sameSequence(stressedA.onset, stressedB.onset)) return result(RhymeKind.Identical, IDENTICAL_SCORE);
      return result(run.multisyllabic ? RhymeKind.Multisyllabic : RhymeKind.Perfect, PERFECT_SCORE);
    }
    if (run.multisyllabic) {
      return result(RhymeKind.Multisyllabic, MULTISYLLABIC_BASE + MULTISYLLABIC_PER_SYLLABLE * (run.length - MIN_MULTISYLLABIC_LENGTH));
    }
    const vowel = vowelSimilarity(stressedA.nucleus, stressedB.nucleus);
    const restA = tailA.slice(1);
    const restB = tailB.slice(1);
    const rest = sequenceSimilarity(restA, restB);
    if (stressedA.nucleus === stressedB.nucleus) {
      return rest >= NEAR_REST_MIN
        ? result(RhymeKind.Near, NEAR_BASE + NEAR_RANGE * rest)
        : result(RhymeKind.Assonance, ASSONANCE_BASE + ASSONANCE_RANGE * rest);
    }
    if (vowel >= NEAR_VOWEL_MIN && sameSequence(restA, restB)) {
      return result(RhymeKind.Near, NEAR_VOWEL_BASE + NEAR_VOWEL_RANGE * vowel);
    }
    const consonantsA = consonantsOf(restA);
    if (consonantsA.length > 0 && sameSequence(consonantsA, consonantsOf(restB))) {
      return result(RhymeKind.Consonance, CONSONANCE_BASE + CONSONANCE_RANGE * vowel);
    }
    return result(RhymeKind.None, NONE_RANGE * Math.max(vowel, rest));
  }

  /** The strongest rhyme over every pair of pronunciations. */
  best(first: RhymeUnit[], second: RhymeUnit[]): RhymeResult {
    let strongest = NO_RHYME;
    for (const a of first) {
      for (const b of second) strongest = strongerRhyme(strongest, this.compare(a, b));
    }
    return strongest;
  }

  /**
   * Syllables matching vowel for vowel from the end. It is a multisyllabic rhyme when the match reaches
   * past the shorter rhyming tail, includes a stressed syllable there, and the final consonants agree.
   */
  private vowelRun(a: RhymeSyllable[], b: RhymeSyllable[], shorterTail: number): VowelRun {
    let length = 0;
    let stressedBeyondTail = false;
    while (length < a.length && length < b.length) {
      const x = a[a.length - 1 - length];
      const y = b[b.length - 1 - length];
      if (!x || !y || !nucleiMatch(x.nucleus, x.stress, y.nucleus, y.stress)) break;
      if (length >= shorterTail && x.stress !== Stress.None && y.stress !== Stress.None) stressedBeyondTail = true;
      length += 1;
    }
    const lastA = a.at(-1);
    const lastB = b.at(-1);
    const coda = lastA && lastB ? sequenceSimilarity(lastA.coda, lastB.coda) : 0;
    const multisyllabic =
      length >= MIN_MULTISYLLABIC_LENGTH && length > shorterTail && stressedBeyondTail && coda >= MULTISYLLABIC_CODA_MIN;
    return { length, multisyllabic };
  }
}

const comparer = new RhymeComparer();

/** How two words or line endings rhyme in the given accent: kind and a 0–1 score. */
export function compareRhyme(a: string, b: string, accent: Accent): RhymeResult {
  const analyzer = LineAnalyzer.for(accent);
  return comparer.best(lineEndUnits(analyzer.analyze(a)), lineEndUnits(analyzer.analyze(b)));
}
