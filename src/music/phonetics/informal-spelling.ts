// Spellings common in lyrics: dropped g ("lovin'"), elisions ("ev'ry"), poetic forms ("o'er"), contractions.
import type { Accent } from "../../shared/personalisation";
import { isVoiceless, isVowel } from "./phoneme";

/** Poetic and informal forms with their pronunciations, as IPA with stress marks. */
export const POETIC_FORMS: ReadonlyMap<string, Readonly<Record<Accent, string>>> = new Map([
  ["o'er", { us: "ˈɔ ɹ", uk: "ˈɔː" }],
  ["e'er", { us: "ˈɛ ɹ", uk: "ˈɛə" }],
  ["ne'er", { us: "n ˈɛ ɹ", uk: "n ˈɛə" }],
  ["o'", { us: "ə", uk: "ə" }],
  ["'n'", { us: "ə n", uk: "ə n" }],
  ["n'", { us: "ə n", uk: "ə n" }],
]);

const DROPPED_G = /in'$/;
const VOWEL_LETTERS = ["e", "i", "o", "a", "u"];
const CONTRACTION = /^(.+?)('ll|'re|'ve|'d|'m|'s)$/;
const SIBILANTS = new Set(["s", "z", "ʃ", "ʒ", "tʃ", "dʒ"]);

/** "lovin'" is "loving" with its final /ŋ/ sung as /n/. */
export function droppedGBase(word: string): string | null {
  return DROPPED_G.test(word) ? `${word.slice(0, -1)}g` : null;
}

/** Full spellings an elided word may stand for: "ev'ry" → "every", "heav'n" → "heaven". */
export function elisionBases(word: string): string[] {
  const apostrophe = word.indexOf("'");
  if (apostrophe <= 0 || apostrophe === word.length - 1) return [];
  return VOWEL_LETTERS.map((letter) => word.slice(0, apostrophe) + letter + word.slice(apostrophe + 1));
}

export interface ContractionParts {
  base: string;
  ending: string;
}

export function splitContraction(word: string): ContractionParts | null {
  const match = CONTRACTION.exec(word);
  if (!match) return null;
  const base = match[1];
  const ending = match[2];
  return base && ending ? { base, ending } : null;
}

/** Sounds a contracted ending adds after a base word ending in `last`. */
export function contractionSounds(ending: string, last: string | undefined, accent: Accent): string[] {
  const afterVowel = last !== undefined && isVowel(last);
  switch (ending) {
    case "'ll":
      return afterVowel ? ["l"] : ["ə", "l"];
    case "'re":
      return [accent === "us" ? "ɚ" : "ə"];
    case "'ve":
      return afterVowel ? ["v"] : ["ə", "v"];
    case "'d":
      return afterVowel ? ["d"] : ["ə", "d"];
    case "'m":
      return ["m"];
    default:
      if (last !== undefined && SIBILANTS.has(last)) return ["ɪ", "z"];
      return last !== undefined && isVoiceless(last) ? ["s"] : ["z"];
  }
}
