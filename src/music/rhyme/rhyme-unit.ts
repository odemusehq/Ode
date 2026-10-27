import type { LineAnalysis, SyllableInfo, WordAnalysis, WordOption } from "../../shared/lyrics";
import { normalizeWord } from "../phonetics/lexicon";
import { Stress, type Pronunciation, type StressLevel } from "../phonetics/pronunciation";
import { syllabify, syllableParts } from "../phonetics/syllabify";

export interface RhymeSyllable {
  onset: string[];
  nucleus: string;
  coda: string[];
  stress: StressLevel;
}

/** The end of a word or line as syllables, ready to compare for rhyme. */
export interface RhymeUnit {
  syllables: RhymeSyllable[];
  /** The last word, normalised, to spot a word rhymed with itself. */
  lastWord: string;
}

/** Syllables kept from a line ending: enough for multisyllabic rhymes. */
const LINE_END_SYLLABLES = 6;
/** Pronunciation combinations compared per line ending. */
const MAX_COMBINATIONS = 12;

function fromSyllableInfo(syllable: SyllableInfo): RhymeSyllable {
  return { ...syllableParts(syllable.phonemes), stress: syllable.stress };
}

/**
 * The last word carries the musical stress of a line ending even when it is a function word
 * ("…in love with you"), so its strongest syllable is raised to primary stress.
 */
function stressLastWord(syllables: RhymeSyllable[]): RhymeSyllable[] {
  if (syllables.some((syllable) => syllable.stress === Stress.Primary)) return syllables;
  const secondary = syllables.findIndex((syllable) => syllable.stress === Stress.Secondary);
  const raised = secondary >= 0 ? secondary : syllables.length - 1;
  return syllables.map((syllable, index) => (index === raised ? { ...syllable, stress: Stress.Primary } : syllable));
}

function unitFromOptions(options: WordOption[], lastWord: string): RhymeUnit {
  const syllables: RhymeSyllable[] = [];
  options.forEach((option, index) => {
    const parts = option.syllables.map(fromSyllableInfo);
    syllables.push(...(index === options.length - 1 ? stressLastWord(parts) : parts));
  });
  return { syllables, lastWord };
}

/** A single word from a dictionary pronunciation (lexical stress). */
export function unitFromPronunciation(word: string, pronunciation: Pronunciation): RhymeUnit {
  const parts = syllabify(pronunciation.phonemes).map((phonemes, index) => ({
    ...syllableParts(phonemes),
    stress: pronunciation.stresses[index] ?? Stress.None,
  }));
  return { syllables: stressLastWord(parts), lastWord: normalizeWord(word) };
}

/** Every pronunciation of one analysed word. */
export function wordUnits(word: WordAnalysis): RhymeUnit[] {
  const lastWord = normalizeWord(word.text);
  return word.options.map((option) => unitFromOptions([option], lastWord));
}

/** The end of a line (its last words, up to a few syllables), in each combination of pronunciations. */
export function lineEndUnits(line: LineAnalysis): RhymeUnit[] {
  const words = line.words.filter((word) => word.options.length > 0);
  const last = words.at(-1);
  if (!last) return [];
  let start = words.length;
  let covered = 0;
  while (start > 0 && covered < LINE_END_SYLLABLES) {
    start -= 1;
    covered += words[start]?.options[0]?.syllables.length ?? 0;
  }
  let combinations: WordOption[][] = [[]];
  for (const word of words.slice(start)) {
    combinations = combinations
      .flatMap((combination) => word.options.map((option) => [...combination, option]))
      .slice(0, MAX_COMBINATIONS);
  }
  const lastWord = normalizeWord(last.text);
  return combinations.map((combination) => unitFromOptions(combination, lastWord));
}

/** Index of the last syllable with primary stress, else secondary, else the last syllable. */
export function lastStressedIndex(syllables: RhymeSyllable[]): number {
  for (const level of [Stress.Primary, Stress.Secondary]) {
    for (let index = syllables.length - 1; index >= 0; index--) {
      if (syllables[index]?.stress === level) return index;
    }
  }
  return syllables.length - 1;
}

/** The rhyming part: from the vowel of the syllable at `index` to the end. */
export function rhymeTail(syllables: RhymeSyllable[], index: number): string[] {
  const tail: string[] = [];
  syllables.slice(index).forEach((syllable, offset) => {
    if (offset > 0) tail.push(...syllable.onset);
    tail.push(syllable.nucleus, ...syllable.coda);
  });
  return tail;
}
