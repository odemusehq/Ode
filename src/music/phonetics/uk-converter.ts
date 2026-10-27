import { alignVowels, type VowelGroup } from "./grapheme-aligner";
import { isVowel } from "./phoneme";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";
import { BATH_COMPOUND_PREFIXES, BATH_INFLECTIONS, BATH_WORDS, NURSE_BEFORE_R_BASES } from "./uk-words";

/** British vowels for an American vowel followed by an /r/ that ends its syllable (START, NORTH, SQUARE, NEAR, CURE). */
const BEFORE_FINAL_R = new Map<string, string>([
  ["ɑ", "ɑː"],
  ["æ", "ɑː"],
  ["ɔ", "ɔː"],
  ["oʊ", "ɔː"],
  ["ɛ", "ɛə"],
  ["eɪ", "ɛə"],
  ["ɪ", "ɪə"],
  ["i", "ɪə"],
  ["ʊ", "ʊə"],
  ["u", "ʊə"],
  ["aɪ", "aɪə"],
  ["aʊ", "aʊə"],
  ["ʌ", "ɜː"],
]);

/** Consonants after a stressed /æ/ where British English often has the BATH vowel instead. */
const BATH_FRICATIVES = new Set(["f", "θ", "s"]);
const BATH_AFTER_N = new Set(["s", "t", "tʃ"]);
const YOD_CONSONANTS = new Set(["t", "d", "n"]);
const YOD_SPELLINGS = new Set(["u", "ue", "ui", "ew", "eu", "eau"]);
const SUFFIXES_WITH_REDUCED_VOWEL = /(ary|ery|ory|aries|eries|ories|mony|monies)$/;
const ILE_SUFFIX = /iles?$/;
const IZATION_SPELLING = /i[sz]ation/;

interface VowelContext {
  word: string;
  phoneme: string;
  stress: StressLevel;
  group: VowelGroup | null;
  next: string | undefined;
  /** The /r/ after this vowel ends the syllable (it is not followed by a vowel). */
  beforeFinalR: boolean;
  previous: string | undefined;
  following: string[];
  bath: boolean;
}

interface VowelResult {
  /** Exactly one vowel, possibly with a consonant before (yod) or after (linking r). */
  symbols: string[];
  certain: boolean;
}

const sure = (...symbols: string[]): VowelResult => ({ symbols, certain: true });
const unsure = (...symbols: string[]): VowelResult => ({ symbols, certain: false });

/**
 * Derives a Standard Southern British pronunciation from a General American one: non-rhotic /r/,
 * the TRAP–BATH split, LOT, THOUGHT/CLOTH, GOAT, NURSE and lettER, yod after t/d/n, and the
 * reduced vowel of -ary/-ery/-ory/-mony. The result is uncertain where a rule had to guess.
 */
export class UkConverter {
  convert(word: string, us: Pronunciation): Pronunciation {
    const alignment = alignVowels(word, us.phonemes);
    const bathVowel = this.bathVowelIndex(word, us);
    const phonemes: string[] = [];
    const stresses: StressLevel[] = [];
    let certain = us.certain;
    let vowelIndex = -1;
    us.phonemes.forEach((phoneme, index) => {
      if (!isVowel(phoneme)) {
        if (!(phoneme === "ɹ" && this.endsSyllable(us.phonemes, index))) phonemes.push(phoneme);
        return;
      }
      vowelIndex += 1;
      const next = us.phonemes[index + 1];
      const result = this.convertVowel({
        word,
        phoneme,
        stress: us.stresses[vowelIndex] ?? Stress.None,
        group: alignment[vowelIndex] ?? null,
        next,
        beforeFinalR: next === "ɹ" && this.endsSyllable(us.phonemes, index + 1),
        previous: phonemes.at(-1),
        following: us.phonemes.slice(index + 1, index + 4),
        bath: vowelIndex === bathVowel,
      });
      phonemes.push(...result.symbols);
      stresses.push(us.stresses[vowelIndex] ?? Stress.None);
      certain &&= result.certain;
    });
    const converted: Pronunciation = { phonemes, stresses, certain };
    this.reduceSuffixVowel(word, converted);
    this.applyIleRule(word, converted);
    this.applyIzationRule(word, converted);
    return converted;
  }

  /** An /r/ after a vowel and not before one is silent in non-rhotic accents. */
  private endsSyllable(phonemes: string[], index: number): boolean {
    const before = phonemes[index - 1];
    const after = phonemes[index + 1];
    return before !== undefined && isVowel(before) && (after === undefined || !isVowel(after));
  }

  private convertVowel(context: VowelContext): VowelResult {
    const { phoneme, next } = context;
    const vowelFollows = next !== undefined && isVowel(next);
    if (phoneme === "ɝ") return vowelFollows ? this.nurseBeforeVowel(context) : sure("ɜː");
    if (phoneme === "ɚ") return vowelFollows ? sure("ə", "ɹ") : sure("ə");
    if (next === "ɹ") return context.beforeFinalR ? sure(BEFORE_FINAL_R.get(phoneme) ?? phoneme) : this.beforeLinkingR(context);
    switch (phoneme) {
      case "ɑ":
        return this.lotOrPalm(context);
      case "ɔ":
        return this.thoughtOrCloth(context);
      case "oʊ":
        return sure("əʊ");
      case "i":
        return sure(context.stress === Stress.None ? "i" : "iː");
      case "u":
        return this.goose(context);
      case "æ":
        return this.trapOrBath(context);
      default:
        return sure(phoneme);
    }
  }

  /** "hurry", "worry", "courage" have /ʌ/ before r; "furry", "occurring" keep /ɜː/. */
  private nurseBeforeVowel({ word, group }: VowelContext): VowelResult {
    if (!group) return sure("ɜː", "ɹ");
    const after = word.slice(group.end);
    const strut = after.startsWith("rr") || (group.letters === "ou" && after.startsWith("r"));
    const nurseBase = NURSE_BEFORE_R_BASES.some((base) => word.startsWith(base) && word.slice(base.length).startsWith("r"));
    return strut && !nurseBase ? sure("ʌ", "ɹ") : sure("ɜː", "ɹ");
  }

  private beforeLinkingR(context: VowelContext): VowelResult {
    const { word, phoneme, group } = context;
    const letters = group?.letters ?? "";
    const after = group ? word.slice(group.end) : "";
    switch (phoneme) {
      case "ɑ":
        return sure(letters.startsWith("o") ? "ɒ" : "ɑː");
      case "ɔ":
        return sure(after.startsWith("rr") ? "ɒ" : "ɔː");
      case "ɛ":
        return this.squareBeforeVowel(letters, after);
      case "ɪ":
      case "i":
        return sure(letters.includes("e") ? "ɪə" : "ɪ");
      case "ʊ":
      case "u":
        return sure("ʊə");
      case "oʊ":
        return sure("ɔː");
      default:
        return sure(phoneme);
    }
  }

  /** The Mary–marry–merry vowels before a linking r: "carry" /æ/, "very" /ɛ/, "parent" /ɛə/. */
  private squareBeforeVowel(letters: string, after: string): VowelResult {
    if (letters === "a") {
      if (after.startsWith("rr")) return sure("æ");
      if (/^ri?ous/.test(after)) return sure("ɛə");
      if (/^r[ioua]/.test(after)) return sure("æ");
      return sure("ɛə");
    }
    if (letters === "e") return sure("ɛ");
    return sure("ɛə");
  }

  /** American /ɑ/ is LOT (/ɒ/, spelled o or after w) or PALM (/ɑː/, spelled a). */
  private lotOrPalm({ word, group }: VowelContext): VowelResult {
    if (!group) return unsure("ɒ");
    const letters = group.letters;
    if (letters.startsWith("o")) return sure("ɒ");
    if (letters.startsWith("au")) return sure("ɔː");
    if (letters.startsWith("a")) {
      const before = word.slice(Math.max(0, group.start - 2), group.start);
      return /(w|qu|wh)$/.test(before) ? sure("ɒ") : sure("ɑː");
    }
    return unsure("ɒ");
  }

  /** American /ɔ/ is CLOTH (/ɒ/, a lone o: "dog", "long") or THOUGHT (/ɔː/: "law", "talk", "bought"). */
  private thoughtOrCloth({ group }: VowelContext): VowelResult {
    if (!group) return unsure("ɔː");
    return sure(group.letters === "o" ? "ɒ" : "ɔː");
  }

  /** GOOSE is /uː/, with /j/ after t, d, n when spelled u or ew ("tune", "duty", "new"). */
  private goose({ stress, previous, group }: VowelContext): VowelResult {
    const yod =
      stress !== Stress.None &&
      previous !== undefined &&
      YOD_CONSONANTS.has(previous) &&
      group !== null &&
      YOD_SPELLINGS.has(group.letters);
    return yod ? sure("j", "uː") : sure("uː");
  }

  private trapOrBath(context: VowelContext): VowelResult {
    if (context.bath) return sure("ɑː");
    if (context.stress !== Stress.None && this.isBathContext(context.following)) return unsure("æ");
    return sure("æ");
  }

  /** Stressed /æ/ before f, θ, s + consonant, n + s/t/tʃ, or mpl may be BATH in British English. */
  private isBathContext(following: string[]): boolean {
    const [first, second, third] = following;
    if (first === undefined) return false;
    if (BATH_FRICATIVES.has(first)) return second === undefined || !isVowel(second);
    if (first === "n") return second !== undefined && BATH_AFTER_N.has(second);
    return first === "m" && second === "p" && third === "l";
  }

  private bathVowelIndex(word: string, us: Pronunciation): number {
    const match = this.bathMatch(word);
    if (!match) return -1;
    const candidates: number[] = [];
    let vowelIndex = -1;
    for (const phoneme of us.phonemes) {
      if (!isVowel(phoneme)) continue;
      vowelIndex += 1;
      if (phoneme === "æ" && (us.stresses[vowelIndex] ?? Stress.None) !== Stress.None) candidates.push(vowelIndex);
    }
    const chosen = match.atEnd ? candidates.at(-1) : candidates[0];
    return chosen ?? -1;
  }

  private bathMatch(word: string): { atEnd: boolean } | null {
    if (this.isBathForm(word)) return { atEnd: false };
    for (const prefix of BATH_COMPOUND_PREFIXES) {
      if (word.length > prefix.length + 2 && word.startsWith(prefix) && this.isBathForm(word.slice(prefix.length))) {
        return { atEnd: true };
      }
    }
    return null;
  }

  private isBathForm(word: string): boolean {
    return BATH_INFLECTIONS.some((inflection) => {
      if (!word.endsWith(inflection)) return false;
      const stem = word.slice(0, word.length - inflection.length);
      return stem.length > 1 && (BATH_WORDS.has(stem) || BATH_WORDS.has(`${stem}e`));
    });
  }

  /** "secretary" ˈsɛkɹəˌtɛɹi becomes ˈsɛkɹətəɹi; "ceremony" ˈsɛɹəˌmoʊni becomes ˈsɛɹəməni. */
  private reduceSuffixVowel(word: string, pronunciation: Pronunciation): void {
    if (!SUFFIXES_WITH_REDUCED_VOWEL.test(word)) return;
    const { phonemes, stresses } = pronunciation;
    const tailStart = phonemes.length - (phonemes.at(-1) === "z" ? 3 : 2);
    const consonant = phonemes[tailStart];
    if ((consonant !== "ɹ" && consonant !== "n") || phonemes[tailStart + 1] !== "i") return;
    const vowelPosition = tailStart - 1;
    const symbol = phonemes[vowelPosition];
    if (symbol === undefined || !isVowel(symbol)) return;
    const stressIndex = this.vowelNumber(phonemes, vowelPosition);
    if (stresses[stressIndex] !== Stress.Secondary || !stresses.slice(0, stressIndex).includes(Stress.Primary)) return;
    phonemes[vowelPosition] = "ə";
    stresses[stressIndex] = Stress.None;
  }

  /** "fertile", "hostile", "missile" end in /aɪl/ in British English. */
  private applyIleRule(word: string, pronunciation: Pronunciation): void {
    if (!ILE_SUFFIX.test(word)) return;
    const { phonemes, stresses } = pronunciation;
    const lPosition = phonemes.at(-1) === "z" ? phonemes.length - 2 : phonemes.length - 1;
    const vowelPosition = lPosition - 1;
    if (phonemes[lPosition] !== "l") return;
    const symbol = phonemes[vowelPosition];
    if (symbol !== "ə" && symbol !== "ɪ") return;
    const stressIndex = this.vowelNumber(phonemes, vowelPosition);
    if (stresses[stressIndex] !== Stress.None) return;
    phonemes[vowelPosition] = "aɪ";
    stresses[stressIndex] = Stress.Secondary;
  }

  /** "organisation" has /aɪ/ before -zation in British English. */
  private applyIzationRule(word: string, pronunciation: Pronunciation): void {
    if (!IZATION_SPELLING.test(word)) return;
    const { phonemes, stresses } = pronunciation;
    for (let position = 0; position + 2 < phonemes.length; position++) {
      const symbol = phonemes[position];
      if ((symbol !== "ɪ" && symbol !== "ə") || phonemes[position + 1] !== "z" || phonemes[position + 2] !== "eɪ") continue;
      if (stresses[this.vowelNumber(phonemes, position)] === Stress.None) phonemes[position] = "aɪ";
    }
  }

  /** Index among the vowels of the vowel at a phoneme position. */
  private vowelNumber(phonemes: string[], position: number): number {
    return phonemes.slice(0, position).filter((phoneme) => isVowel(phoneme)).length;
  }
}
