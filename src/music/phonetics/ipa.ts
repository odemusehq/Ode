import { isConsonant, isVowel } from "./phoneme";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";

const PRIMARY_MARK = "ˈ";
const SECONDARY_MARK = "ˌ";
const SYLLABLE_BREAK = ".";

/**
 * Symbols written differently by sources, mapped to the ones Ode uses: Britfone's ɐ (STRUT) becomes
 * the traditional ʌ, the IPA single-storey ɡ becomes g, and a plain r or e becomes ɹ or ɛ.
 */
const SYMBOL_REPLACEMENTS = new Map<string, string>([
  ["ɐ", "ʌ"],
  ["ɡ", "g"],
  ["r", "ɹ"],
  ["e", "ɛ"],
]);

/**
 * Parses space-separated IPA with stress marks on vowels ("ɹ ˈeɪ n b ˌəʊ").
 * Returns null when a symbol is unknown or the text has no vowel.
 */
export function parseIpa(text: string, certain = true): Pronunciation | null {
  const phonemes: string[] = [];
  const stresses: StressLevel[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    let symbol = raw;
    let stress: StressLevel = Stress.None;
    if (symbol.startsWith(PRIMARY_MARK)) {
      stress = Stress.Primary;
      symbol = symbol.slice(PRIMARY_MARK.length);
    } else if (symbol.startsWith(SECONDARY_MARK)) {
      stress = Stress.Secondary;
      symbol = symbol.slice(SECONDARY_MARK.length);
    }
    symbol = SYMBOL_REPLACEMENTS.get(symbol) ?? symbol;
    if (isVowel(symbol)) {
      phonemes.push(symbol);
      stresses.push(stress);
    } else if (isConsonant(symbol) && stress === Stress.None) {
      phonemes.push(symbol);
    } else {
      return null;
    }
  }
  return stresses.length > 0 ? { phonemes, stresses, certain } : null;
}

/** Writes syllables as IPA with stress marks before stressed syllables: "ˈɛv.ɹi". */
export function formatIpa(syllables: string[][], stresses: StressLevel[]): string {
  return syllables
    .map((syllable, index) => {
      const stress = stresses[index] ?? Stress.None;
      const mark = stress === Stress.Primary ? PRIMARY_MARK : stress === Stress.Secondary ? SECONDARY_MARK : "";
      return mark + syllable.join("");
    })
    .join(SYLLABLE_BREAK);
}
