import { GraphemeReader, VowelLength, type Segment } from "./grapheme-reader";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";

/** Endings that put the main stress just before them, with how many vowels the ending itself has. */
const STRESS_BEFORE_SUFFIX: readonly [RegExp, number][] = [
  [/(tion|sion|cian|tial|cial|cious|tious)s?$/, 1],
  [/ics?$/, 1],
  [/ically$/, 3],
  [/ical$/, 2],
  [/(ity|ities)$/, 2],
  [/(ian|ial|ious|eous|ient|ience)$/, 2],
];
/** Endings that take the main stress themselves: "referee", "career", "Japanese", "cassette", "balloon". */
const STRESSED_SUFFIX = /(ee|eer|ese|ette|esque|ique|oon)s?$/;
/** Unstressed prefixes before a stressed root: "about", "begin", "return", "unless", "dismiss". */
const UNSTRESSED_PREFIX = /^(a|be|de|re|un|dis|mis|pre|ex)/;
const SHORTEST_PREFIXED_WORD = 5;
const MAX_PREFIXED_SYLLABLES = 3;
/** Two-syllable words are usually stressed on the first syllable; longer ones get a secondary stress at the start. */
const TWO_SYLLABLES = 2;
const SYLLABLES_BEFORE_SECONDARY = 2;
const REDUCIBLE = new Set(["æ", "ɛ", "ɑ", "ʌ"]);
const R_COLOURED_STARTS = new Set(["ɑ", "ɔ", "ɛ"]);

/**
 * Best-guess General American pronunciation for a word missing from every dictionary, from spelling
 * rules (letter groups, silent e, open and closed syllables) and English stress tendencies.
 * Always marked uncertain.
 */
export class LetterToSound {
  pronounce(word: string): Pronunciation {
    const letters = word.toLowerCase().replace(/[^a-z]/g, "");
    const segments = new GraphemeReader(letters).read();
    const vowels = segments.filter((segment) => segment.vowel);
    if (vowels.length === 0) return this.syllabicConsonant(segments);
    const stresses = this.assignStress(letters, vowels);
    vowels.forEach((segment, index) => this.reduce(segment, stresses[index] ?? Stress.None));
    return { phonemes: segments.flatMap((segment) => segment.phonemes), stresses, certain: false };
  }

  private assignStress(word: string, vowels: Segment[]): StressLevel[] {
    const stresses: StressLevel[] = vowels.map(() => Stress.None);
    const primary = this.primaryIndex(word, vowels);
    stresses[primary] = Stress.Primary;
    if (primary >= SYLLABLES_BEFORE_SECONDARY) stresses[0] = Stress.Secondary;
    return stresses;
  }

  private primaryIndex(word: string, vowels: Segment[]): number {
    const count = vowels.length;
    if (count === 1) return 0;
    for (const [pattern, suffixVowels] of STRESS_BEFORE_SUFFIX) {
      if (pattern.test(word) && count > suffixVowels) return count - suffixVowels - 1;
    }
    if (STRESSED_SUFFIX.test(word)) return count - 1;
    if (count <= MAX_PREFIXED_SYLLABLES && word.length >= SHORTEST_PREFIXED_WORD && UNSTRESSED_PREFIX.test(word)) return 1;
    if (count === TWO_SYLLABLES) return 0;
    const penultimate = vowels[count - 2];
    return penultimate && penultimate.length === VowelLength.Long ? count - 2 : count - 3;
  }

  /** Unstressed short vowels weaken to schwa; unstressed r-coloured vowels become ɚ. */
  private reduce(segment: Segment, stress: StressLevel): void {
    if (stress !== Stress.None) return;
    const [first, second] = segment.phonemes;
    if (first === undefined) return;
    if (second === "ɹ" && R_COLOURED_STARTS.has(first)) segment.phonemes = ["ɚ"];
    else if (first === "ɝ") segment.phonemes = ["ɚ"];
    else if (REDUCIBLE.has(first) && segment.length !== VowelLength.Long) segment.phonemes = ["ə", ...segment.phonemes.slice(1)];
  }

  /** Words without vowel letters ("hmm", "shh") are sung on a syllabic consonant, written with ə. */
  private syllabicConsonant(segments: Segment[]): Pronunciation {
    const consonants = segments.flatMap((segment) => segment.phonemes);
    const last = consonants.pop();
    const phonemes = last === undefined ? ["ə"] : [...consonants, "ə", last];
    return { phonemes, stresses: [Stress.Primary], certain: false };
  }
}
