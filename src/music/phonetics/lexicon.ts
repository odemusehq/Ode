import type { Accent } from "../../shared/personalisation";
import { BritfoneDictionary } from "./britfone-dictionary";
import { CmuDictionary } from "./cmu-dictionary";
import { contractionSounds, droppedGBase, elisionBases, POETIC_FORMS, splitContraction } from "./informal-spelling";
import { parseIpa } from "./ipa";
import { LetterToSound } from "./letter-to-sound";
import { applySuffix, stemCandidates } from "./morphology";
import { numberWords } from "./numbers";
import { isVowel } from "./phoneme";
import {
  joinPronunciations,
  Stress,
  uniquePronunciations,
  withCertainty,
  type Pronunciation,
  type StressLevel,
} from "./pronunciation";
import { spellingVariants } from "./spelling-variants";
import { SungVariants } from "./sung-variants";
import { UkConverter } from "./uk-converter";
import { UK_EXCEPTIONS } from "./uk-words";

/** The shortest piece accepted when guessing that an unknown word joins two known words ("moonlit"). */
const MIN_COMPOUND_PART = 3;
/** How many pronunciations of each part are combined for hyphenated words. */
const OPTIONS_PER_PART = 2;
const MAX_COMBINED_OPTIONS = 4;

const cmu = new CmuDictionary();
const britfone = new BritfoneDictionary();

/** Lower case, curly apostrophes made straight, surrounding punctuation removed (apostrophes kept). */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
}

function parseAll(ipa: readonly string[], certain = true): Pronunciation[] {
  return ipa.map((text) => parseIpa(text, certain)).filter((item): item is Pronunciation => item !== null);
}

function nonEmpty(list: Pronunciation[] | undefined): Pronunciation[] | undefined {
  return list && list.length > 0 ? list : undefined;
}

/**
 * Pronunciations for one accent: dictionary entries first, then forms derived from known words
 * (dropped g, contractions, inflections, spelling variants, compounds, numbers), then a letter-to-sound
 * guess marked uncertain. Sung variants are added to every result. Results are cached per word.
 */
export abstract class Lexicon {
  private static readonly instances = new Map<Accent, Lexicon>();
  private readonly cache = new Map<string, Pronunciation[]>();
  private readonly sung: SungVariants;
  protected readonly letterToSound = new LetterToSound();

  protected constructor(readonly accent: Accent) {
    this.sung = new SungVariants(accent);
  }

  static for(accent: Accent): Lexicon {
    let lexicon = Lexicon.instances.get(accent);
    if (!lexicon) {
      lexicon = accent === "uk" ? new UkLexicon() : new UsLexicon();
      Lexicon.instances.set(accent, lexicon);
    }
    return lexicon;
  }

  /** Every pronunciation of a word, sung variants included; empty only for text without letters or digits. */
  pronounce(word: string): Pronunciation[] {
    const key = normalizeWord(word);
    if (!/[\p{L}\p{N}]/u.test(key)) return [];
    const cached = this.cache.get(key);
    if (cached) return cached;
    const result = uniquePronunciations(this.sung.expand(key, this.resolve(key)));
    this.cache.set(key, result);
    return result;
  }

  /** Whether a word is among the most frequent English words. */
  isCommon(word: string): boolean {
    return britfone.has(normalizeWord(word));
  }

  /** Pronunciations from this accent's dictionaries only, without guesses or sung variants. */
  abstract dictionary(word: string): Pronunciation[] | undefined;

  /** Every dictionary word with its pronunciations, for reverse indexes. */
  abstract entries(): Iterable<[string, Pronunciation[]]>;

  /** A letter-to-sound guess in this accent. */
  protected abstract guess(word: string): Pronunciation;

  private resolve(word: string): Pronunciation[] {
    return (
      this.dictionary(word) ??
      this.poetic(word) ??
      this.withoutQuoteMarks(word) ??
      this.droppedG(word) ??
      this.contraction(word) ??
      this.hyphenated(word) ??
      this.number(word) ??
      this.otherSpelling(word) ??
      this.elided(word) ??
      this.inflected(word) ??
      this.compound(word) ?? [this.guess(word)]
    );
  }

  private poetic(word: string): Pronunciation[] | undefined {
    const ipa = POETIC_FORMS.get(word)?.[this.accent];
    return ipa ? nonEmpty(parseAll([ipa])) : undefined;
  }

  /** "'hello'" in quotes, or a plural possessive "lovers'". */
  private withoutQuoteMarks(word: string): Pronunciation[] | undefined {
    if (word.startsWith("'") && word.length > 1) return this.resolve(word.slice(1));
    if (word.endsWith("'") && !word.endsWith("in'") && word.length > 1) return this.resolve(word.slice(0, -1));
    return undefined;
  }

  private droppedG(word: string): Pronunciation[] | undefined {
    const base = droppedGBase(word);
    const found = base ? this.known(base) : undefined;
    return found?.map((pronunciation) => {
      const phonemes = [...pronunciation.phonemes];
      if (phonemes.at(-1) === "ŋ") phonemes[phonemes.length - 1] = "n";
      return { ...pronunciation, phonemes };
    });
  }

  private contraction(word: string): Pronunciation[] | undefined {
    const parts = splitContraction(word);
    const found = parts ? this.known(parts.base) : undefined;
    if (!parts || !found) return undefined;
    return found.map((pronunciation) => {
      const sounds = contractionSounds(parts.ending, pronunciation.phonemes.at(-1), this.accent);
      const added = sounds.filter((sound) => isVowel(sound)).map((): StressLevel => Stress.None);
      return {
        phonemes: [...pronunciation.phonemes, ...sounds],
        stresses: [...pronunciation.stresses, ...added],
        certain: pronunciation.certain,
      };
    });
  }

  private hyphenated(word: string): Pronunciation[] | undefined {
    const parts = word.split("-").filter((part) => part.length > 0);
    if (parts.length < 2) return undefined;
    let combinations: Pronunciation[][] = [[]];
    for (const part of parts) {
      const options = this.resolve(part).slice(0, OPTIONS_PER_PART);
      combinations = combinations
        .flatMap((combination) => options.map((option) => [...combination, option]))
        .slice(0, MAX_COMBINED_OPTIONS);
    }
    return combinations.map((combination) =>
      joinPronunciations(combination, combination.every((pronunciation) => pronunciation.certain)),
    );
  }

  private number(word: string): Pronunciation[] | undefined {
    const words = numberWords(word);
    if (!words) return undefined;
    const parts = words.map((spoken) => this.resolve(spoken)[0]).filter((part): part is Pronunciation => part !== undefined);
    return [joinPronunciations(parts, parts.every((part) => part.certain))];
  }

  private otherSpelling(word: string): Pronunciation[] | undefined {
    for (const variant of spellingVariants(word)) {
      const found = this.dictionary(variant);
      if (found) return found;
    }
    return undefined;
  }

  /** "ev'ry" is "every" with a weak vowel left out. */
  private elided(word: string): Pronunciation[] | undefined {
    const apostrophe = word.indexOf("'");
    for (const base of elisionBases(word)) {
      const found = this.dictionary(base);
      if (!found) continue;
      const counts = found.map((pronunciation) => pronunciation.stresses.length);
      const fewest = Math.min(...counts);
      const shortest = found.filter((pronunciation) => pronunciation.stresses.length === fewest);
      if (fewest < Math.max(...counts)) return shortest;
      return shortest.map((pronunciation) => this.dropWeakVowel(pronunciation, apostrophe / base.length));
    }
    return undefined;
  }

  private dropWeakVowel(pronunciation: Pronunciation, position: number): Pronunciation {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    let vowelIndex = -1;
    pronunciation.phonemes.forEach((phoneme, index) => {
      if (!isVowel(phoneme)) return;
      vowelIndex += 1;
      if (pronunciation.stresses[vowelIndex] !== Stress.None) return;
      const distance = Math.abs(index / pronunciation.phonemes.length - position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    if (best < 0) return pronunciation;
    const phonemes = [...pronunciation.phonemes];
    const removedIndex = pronunciation.phonemes.slice(0, best).filter((phoneme) => isVowel(phoneme)).length;
    if (phonemes[best] === "ɚ") phonemes[best] = "ɹ";
    else phonemes.splice(best, 1);
    const stresses = pronunciation.stresses.filter((_, index) => index !== removedIndex);
    return { phonemes, stresses, certain: pronunciation.certain };
  }

  private inflected(word: string): Pronunciation[] | undefined {
    for (const { stem, suffix } of stemCandidates(word)) {
      const found = this.dictionary(stem);
      if (found) return found.map((pronunciation) => applySuffix(pronunciation, stem, suffix, this.accent));
    }
    return undefined;
  }

  /** "moonlit" from "moon" + "lit": a guess, so uncertain. */
  private compound(word: string): Pronunciation[] | undefined {
    for (let split = word.length - MIN_COMPOUND_PART; split >= MIN_COMPOUND_PART; split--) {
      const left = this.dictionary(word.slice(0, split))?.[0];
      const right = this.dictionary(word.slice(split))?.[0];
      if (left && right) return [joinPronunciations([left, right], false)];
    }
    return undefined;
  }

  /** Dictionary entries or regular inflections of them. */
  private known(word: string): Pronunciation[] | undefined {
    return this.dictionary(word) ?? this.inflected(word);
  }
}

export class UsLexicon extends Lexicon {
  constructor() {
    super("us");
  }

  dictionary(word: string): Pronunciation[] | undefined {
    return cmu.lookup(word);
  }

  *entries(): Iterable<[string, Pronunciation[]]> {
    for (const word of cmu.words()) {
      const pronunciations = cmu.lookup(word);
      if (pronunciations) yield [word, pronunciations];
    }
  }

  protected guess(word: string): Pronunciation {
    return this.letterToSound.pronounce(word);
  }
}

export class UkLexicon extends Lexicon {
  private readonly converter = new UkConverter();
  private readonly converted = new Map<string, Pronunciation[] | null>();

  constructor() {
    super("uk");
  }

  dictionary(word: string): Pronunciation[] | undefined {
    return (
      britfone.lookup(word) ??
      this.exception(word) ??
      this.inflectedFrom(word, (stem) => this.exception(stem) ?? britfone.lookup(stem)) ??
      this.fromUs(word)
    );
  }

  *entries(): Iterable<[string, Pronunciation[]]> {
    for (const word of britfone.words()) {
      const pronunciations = britfone.lookup(word);
      if (pronunciations) yield [word, pronunciations];
    }
    for (const word of cmu.words()) {
      if (britfone.has(word)) continue;
      const pronunciations = this.fromUs(word);
      if (pronunciations) yield [word, pronunciations];
    }
  }

  protected guess(word: string): Pronunciation {
    return withCertainty(this.converter.convert(word, this.letterToSound.pronounce(word)), false);
  }

  private exception(word: string): Pronunciation[] | undefined {
    const ipa = UK_EXCEPTIONS.get(word);
    return ipa ? nonEmpty(parseAll(ipa)) : undefined;
  }

  private inflectedFrom(word: string, lookup: (stem: string) => Pronunciation[] | undefined): Pronunciation[] | undefined {
    for (const { stem, suffix } of stemCandidates(word)) {
      const found = lookup(stem);
      if (found) return found.map((pronunciation) => applySuffix(pronunciation, stem, suffix, "uk"));
    }
    return undefined;
  }

  /** British forms derived from the American dictionary entry. */
  private fromUs(word: string): Pronunciation[] | undefined {
    const cached = this.converted.get(word);
    if (cached !== undefined) return cached ?? undefined;
    const us = cmu.lookup(word);
    const result = us ? uniquePronunciations(us.map((pronunciation) => this.converter.convert(word, pronunciation))) : null;
    this.converted.set(word, result);
    return result ?? undefined;
  }
}
