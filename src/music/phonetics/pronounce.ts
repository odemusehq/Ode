import type { Accent } from "../../shared/personalisation";
import { Lexicon } from "./lexicon";
import type { Pronunciation } from "./pronunciation";

/**
 * Every pronunciation of a word in US or UK English (IPA, stress per syllable), dictionary
 * alternatives and common sung forms included. Words missing from the dictionaries get a
 * letter-to-sound guess with certain = false.
 */
export function pronounce(word: string, accent: Accent): Pronunciation[] {
  return Lexicon.for(accent).pronounce(word);
}
