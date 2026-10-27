import type { Accent } from "../../shared/personalisation";
import { isVoiceless, isVowel } from "./phoneme";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";

export enum Suffix {
  Plural = "s",
  Possessive = "'s",
  Past = "ed",
  Progressive = "ing",
  Comparative = "er",
  Superlative = "est",
  Adverb = "ly",
  Ness = "ness",
  Ful = "ful",
  Less = "less",
  Ment = "ment",
}

export interface StemCandidate {
  stem: string;
  suffix: Suffix;
}

const SIBILANTS = new Set(["s", "z", "ʃ", "ʒ", "tʃ", "dʒ"]);
const ALVEOLAR_STOPS = new Set(["t", "d"]);
const VOWEL_LETTERS = /[aeiouy]/;
const ES_PLURAL_STEM = /(s|x|z|sh|ch|o)$/;
/** British pronunciations of r-final spellings end in a vowel and take a linking /r/ before a vowel suffix. */
const R_FINAL_SPELLING = /re?$/;

interface SpellingRule {
  ending: string;
  suffix: Suffix;
  restore: string;
}

/** Spelling endings and what to put back on the stem: "cities" → "city", "loving" → "love". */
const SPELLING_RULES: readonly SpellingRule[] = [
  { ending: "'s", suffix: Suffix.Possessive, restore: "" },
  { ending: "ies", suffix: Suffix.Plural, restore: "y" },
  { ending: "es", suffix: Suffix.Plural, restore: "" },
  { ending: "s", suffix: Suffix.Plural, restore: "" },
  { ending: "ied", suffix: Suffix.Past, restore: "y" },
  { ending: "ed", suffix: Suffix.Past, restore: "" },
  { ending: "ed", suffix: Suffix.Past, restore: "e" },
  { ending: "ying", suffix: Suffix.Progressive, restore: "y" },
  { ending: "ing", suffix: Suffix.Progressive, restore: "" },
  { ending: "ing", suffix: Suffix.Progressive, restore: "e" },
  { ending: "ier", suffix: Suffix.Comparative, restore: "y" },
  { ending: "er", suffix: Suffix.Comparative, restore: "" },
  { ending: "er", suffix: Suffix.Comparative, restore: "e" },
  { ending: "iest", suffix: Suffix.Superlative, restore: "y" },
  { ending: "est", suffix: Suffix.Superlative, restore: "" },
  { ending: "est", suffix: Suffix.Superlative, restore: "e" },
  { ending: "ily", suffix: Suffix.Adverb, restore: "y" },
  { ending: "ly", suffix: Suffix.Adverb, restore: "" },
  { ending: "iness", suffix: Suffix.Ness, restore: "y" },
  { ending: "ness", suffix: Suffix.Ness, restore: "" },
  { ending: "iful", suffix: Suffix.Ful, restore: "y" },
  { ending: "ful", suffix: Suffix.Ful, restore: "" },
  { ending: "less", suffix: Suffix.Less, restore: "" },
  { ending: "ment", suffix: Suffix.Ment, restore: "" },
];

/** Possible stems of a regularly inflected word, most likely first. */
export function stemCandidates(word: string): StemCandidate[] {
  const candidates: StemCandidate[] = [];
  for (const rule of SPELLING_RULES) {
    if (!word.endsWith(rule.ending) || word.length <= rule.ending.length + 1) continue;
    const base = word.slice(0, word.length - rule.ending.length);
    if (rule.ending === "s" && base.endsWith("s")) continue;
    if (rule.ending === "es" && !ES_PLURAL_STEM.test(base)) continue;
    if (!VOWEL_LETTERS.test(base)) continue;
    candidates.push({ stem: base + rule.restore, suffix: rule.suffix });
    const doubled = base.length > 2 && base.at(-1) === base.at(-2) && rule.restore === "";
    if (doubled) candidates.push({ stem: base.slice(0, -1), suffix: rule.suffix });
  }
  return candidates;
}

/** Sounds each suffix adds, chosen by the last sound of the stem. */
function suffixSounds(suffix: Suffix, last: string | undefined, accent: Accent): string[] {
  switch (suffix) {
    case Suffix.Plural:
    case Suffix.Possessive:
      if (last !== undefined && SIBILANTS.has(last)) return ["ɪ", "z"];
      return last !== undefined && isVoiceless(last) ? ["s"] : ["z"];
    case Suffix.Past:
      if (last !== undefined && ALVEOLAR_STOPS.has(last)) return ["ɪ", "d"];
      return last !== undefined && isVoiceless(last) ? ["t"] : ["d"];
    case Suffix.Progressive:
      return ["ɪ", "ŋ"];
    case Suffix.Comparative:
      return [accent === "us" ? "ɚ" : "ə"];
    case Suffix.Superlative:
      return ["ɪ", "s", "t"];
    case Suffix.Adverb:
      return ["l", "i"];
    case Suffix.Ness:
      return ["n", "ə", "s"];
    case Suffix.Ful:
      return ["f", "ə", "l"];
    case Suffix.Less:
      return ["l", "ə", "s"];
    case Suffix.Ment:
      return ["m", "ə", "n", "t"];
  }
}

/** Adds a regular suffix to a stem pronunciation; the suffix is unstressed. */
export function applySuffix(stem: Pronunciation, stemSpelling: string, suffix: Suffix, accent: Accent): Pronunciation {
  const phonemes = [...stem.phonemes];
  const stresses: StressLevel[] = [...stem.stresses];
  const last = phonemes.at(-1);
  if (suffix === Suffix.Adverb && stemSpelling.endsWith("le") && last === "l" && phonemes.at(-2) === "ə") {
    phonemes.splice(phonemes.length - 2, 1);
    phonemes.push("i");
    return { phonemes, stresses, certain: stem.certain };
  }
  const sounds = suffixSounds(suffix, last, accent);
  const first = sounds[0];
  const suffixStartsWithVowel = first !== undefined && isVowel(first);
  if (accent === "uk" && suffixStartsWithVowel && last !== undefined && isVowel(last) && R_FINAL_SPELLING.test(stemSpelling)) {
    phonemes.push("ɹ");
  }
  for (const sound of sounds) {
    phonemes.push(sound);
    if (isVowel(sound)) stresses.push(Stress.None);
  }
  return { phonemes, stresses, certain: stem.certain };
}
