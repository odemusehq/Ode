import type { Accent } from "../../shared/personalisation";
import { isOverusedPair } from "../originality/overused-rhymes";
import { Lexicon, normalizeWord } from "../phonetics/lexicon";
import { RhymeComparer } from "./rhyme-comparer";
import { KIND_ORDER, RhymeKind } from "./rhyme-kind";
import { lastStressedIndex, rhymeTail, unitFromPronunciation, type RhymeUnit } from "./rhyme-unit";

export interface RhymeSuggestion {
  word: string;
  kind: RhymeKind;
  score: number;
  /** Among the most frequent English words. */
  common: boolean;
  /** One of the over-used rhyme pairs with the query word (labelled, not banned). */
  overused: boolean;
}

export interface FindRhymesOptions {
  kinds?: RhymeKind[];
  limit?: number;
  commonOnly?: boolean;
}

const DEFAULT_LIMIT = 40;
const DEFAULT_KINDS: readonly RhymeKind[] = [
  RhymeKind.Perfect,
  RhymeKind.Multisyllabic,
  RhymeKind.Near,
  RhymeKind.Assonance,
  RhymeKind.Consonance,
];
/** Candidates read from each loose bucket (same vowels, same ending), common words first. */
const MAX_CANDIDATES_PER_BUCKET = 3000;
/** Plain words only: no contractions, abbreviations or hyphenated forms. */
const SUGGESTION_WORD = /^[a-z]+$/;

interface UnitKeys {
  tail: string;
  vowels: string;
  rest: string;
}

function keysOf(unit: RhymeUnit): UnitKeys {
  const index = lastStressedIndex(unit.syllables);
  const tail = rhymeTail(unit.syllables, index);
  const vowels = unit.syllables.slice(index).map((syllable) => syllable.nucleus);
  return { tail: tail.join(" "), vowels: vowels.join(" "), rest: tail.slice(1).join(" ") };
}

function add(index: Map<string, string[]>, key: string, word: string): void {
  if (!key) return;
  const list = index.get(key);
  if (!list) index.set(key, [word]);
  else if (list.at(-1) !== word) list.push(word);
}

/**
 * Reverse index of a lexicon by rhyming sound, built on first use: exact rhyming tails for perfect
 * rhymes, vowel patterns for near rhymes and assonance, consonant endings for consonance.
 */
export class RhymeIndex {
  private static readonly instances = new Map<Accent, RhymeIndex>();
  private readonly byTail = new Map<string, string[]>();
  private readonly byVowels = new Map<string, string[]>();
  private readonly byRest = new Map<string, string[]>();
  private readonly common = new Set<string>();
  private readonly comparer = new RhymeComparer();
  private built = false;

  private constructor(private readonly lexicon: Lexicon) {}

  static for(accent: Accent): RhymeIndex {
    let index = RhymeIndex.instances.get(accent);
    if (!index) {
      index = new RhymeIndex(Lexicon.for(accent));
      RhymeIndex.instances.set(accent, index);
    }
    return index;
  }

  find(word: string, options: FindRhymesOptions = {}): RhymeSuggestion[] {
    this.build();
    const query = normalizeWord(word);
    const queryUnits = this.lexicon.pronounce(query).map((pronunciation) => unitFromPronunciation(query, pronunciation));
    const kinds = new Set<RhymeKind>(options.kinds && options.kinds.length > 0 ? options.kinds : DEFAULT_KINDS);
    const suggestions: RhymeSuggestion[] = [];
    for (const candidate of this.candidates(queryUnits)) {
      if (candidate === query) continue;
      const common = this.common.has(candidate);
      if (options.commonOnly && !common) continue;
      const units = (this.lexicon.dictionary(candidate) ?? []).map((pronunciation) =>
        unitFromPronunciation(candidate, pronunciation),
      );
      const rhyme = this.comparer.best(queryUnits, units);
      if (!kinds.has(rhyme.kind)) continue;
      suggestions.push({ word: candidate, kind: rhyme.kind, score: rhyme.score, common, overused: isOverusedPair(query, candidate) });
    }
    return suggestions.sort((a, b) => this.order(a, b)).slice(0, options.limit ?? DEFAULT_LIMIT);
  }

  private candidates(units: RhymeUnit[]): Set<string> {
    const found = new Set<string>();
    for (const unit of units) {
      const keys = keysOf(unit);
      for (const word of this.byTail.get(keys.tail) ?? []) found.add(word);
      for (const word of (this.byVowels.get(keys.vowels) ?? []).slice(0, MAX_CANDIDATES_PER_BUCKET)) found.add(word);
      for (const word of (this.byRest.get(keys.rest) ?? []).slice(0, MAX_CANDIDATES_PER_BUCKET)) found.add(word);
    }
    return found;
  }

  private order(a: RhymeSuggestion, b: RhymeSuggestion): number {
    const kind = (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0);
    if (kind !== 0) return kind;
    if (a.common !== b.common) return a.common ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.word.length - b.word.length || a.word.localeCompare(b.word);
  }

  private build(): void {
    if (this.built) return;
    for (const [word, pronunciations] of this.lexicon.entries()) {
      if (!SUGGESTION_WORD.test(word)) continue;
      if (this.lexicon.isCommon(word)) this.common.add(word);
      for (const pronunciation of pronunciations) {
        const keys = keysOf(unitFromPronunciation(word, pronunciation));
        add(this.byTail, keys.tail, word);
        add(this.byVowels, keys.vowels, word);
        add(this.byRest, keys.rest, word);
      }
    }
    for (const index of [this.byVowels, this.byRest]) {
      for (const words of index.values()) {
        words.sort((a, b) => Number(this.common.has(b)) - Number(this.common.has(a)) || a.length - b.length);
      }
    }
    this.built = true;
  }
}

/** Rhymes for a word from the accent's dictionary, strongest kinds and common words first. */
export function findRhymes(word: string, accent: Accent, options: FindRhymesOptions = {}): RhymeSuggestion[] {
  return RhymeIndex.for(accent).find(word, options);
}
