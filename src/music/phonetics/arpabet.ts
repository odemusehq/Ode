import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";

interface ArpabetVowel {
  stressed: string;
  unstressed: string;
}

/** ARPAbet vowels as General American IPA; AH and ER reduce to ə and ɚ when unstressed. */
const VOWELS = new Map<string, ArpabetVowel>([
  ["AA", { stressed: "ɑ", unstressed: "ɑ" }],
  ["AE", { stressed: "æ", unstressed: "æ" }],
  ["AH", { stressed: "ʌ", unstressed: "ə" }],
  ["AO", { stressed: "ɔ", unstressed: "ɔ" }],
  ["AW", { stressed: "aʊ", unstressed: "aʊ" }],
  ["AY", { stressed: "aɪ", unstressed: "aɪ" }],
  ["EH", { stressed: "ɛ", unstressed: "ɛ" }],
  ["ER", { stressed: "ɝ", unstressed: "ɚ" }],
  ["EY", { stressed: "eɪ", unstressed: "eɪ" }],
  ["IH", { stressed: "ɪ", unstressed: "ɪ" }],
  ["IY", { stressed: "i", unstressed: "i" }],
  ["OW", { stressed: "oʊ", unstressed: "oʊ" }],
  ["OY", { stressed: "ɔɪ", unstressed: "ɔɪ" }],
  ["UH", { stressed: "ʊ", unstressed: "ʊ" }],
  ["UW", { stressed: "u", unstressed: "u" }],
]);

const CONSONANTS = new Map<string, string>([
  ["B", "b"],
  ["CH", "tʃ"],
  ["D", "d"],
  ["DH", "ð"],
  ["F", "f"],
  ["G", "g"],
  ["HH", "h"],
  ["JH", "dʒ"],
  ["K", "k"],
  ["L", "l"],
  ["M", "m"],
  ["N", "n"],
  ["NG", "ŋ"],
  ["P", "p"],
  ["R", "ɹ"],
  ["S", "s"],
  ["SH", "ʃ"],
  ["T", "t"],
  ["TH", "θ"],
  ["V", "v"],
  ["W", "w"],
  ["Y", "j"],
  ["Z", "z"],
  ["ZH", "ʒ"],
]);

const STRESS_DIGITS = new Map<string, StressLevel>([
  ["0", Stress.None],
  ["1", Stress.Primary],
  ["2", Stress.Secondary],
]);

const COMMENT_MARK = "#";
const TOKEN = /^([A-Z]+)([012])?$/;

/** Converts a CMU dictionary entry ("F AY1 ER0 # note") to IPA; null when it has an unknown symbol or zero vowels. */
export function arpabetToPronunciation(code: string): Pronunciation | null {
  const body = code.split(COMMENT_MARK)[0] ?? "";
  const phonemes: string[] = [];
  const stresses: StressLevel[] = [];
  for (const token of body.trim().split(/\s+/)) {
    if (!token) continue;
    const match = TOKEN.exec(token);
    if (!match) return null;
    const symbol = match[1] ?? "";
    const vowel = VOWELS.get(symbol);
    if (vowel) {
      const stress = STRESS_DIGITS.get(match[2] ?? "") ?? Stress.None;
      phonemes.push(stress === Stress.None ? vowel.unstressed : vowel.stressed);
      stresses.push(stress);
      continue;
    }
    const consonant = CONSONANTS.get(symbol);
    if (!consonant) return null;
    phonemes.push(consonant);
  }
  return stresses.length > 0 ? { phonemes, stresses, certain: true } : null;
}
