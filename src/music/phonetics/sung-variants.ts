import type { Accent } from "../../shared/personalisation";
import { parseIpa } from "./ipa";
import { isVowel } from "./phoneme";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";

/** Sung forms the rules below do not produce, as IPA with stress marks per accent. */
const EXTRA_SUNG_FORMS: ReadonlyMap<string, Readonly<Record<Accent, readonly string[]>>> = new Map([
  ["every", { us: ["ˈɛ v ɹ i", "ˈɛ v ə ɹ i"], uk: ["ˈɛ v ɹ i", "ˈɛ v ə ɹ i"] }],
  ["different", { us: ["d ˈɪ f ɹ ə n t", "d ˈɪ f ə ɹ ə n t"], uk: ["d ˈɪ f ɹ ə n t", "d ˈɪ f ə ɹ ə n t"] }],
  ["family", { us: ["f ˈæ m l i", "f ˈæ m ə l i"], uk: ["f ˈæ m l i", "f ˈæ m ə l i"] }],
  ["favorite", { us: ["f ˈeɪ v ɹ ɪ t", "f ˈeɪ v ə ɹ ɪ t"], uk: ["f ˈeɪ v ɹ ɪ t", "f ˈeɪ v ə ɹ ɪ t"] }],
  ["favourite", { us: ["f ˈeɪ v ɹ ɪ t", "f ˈeɪ v ə ɹ ɪ t"], uk: ["f ˈeɪ v ɹ ɪ t", "f ˈeɪ v ə ɹ ɪ t"] }],
  ["interest", { us: ["ˈɪ n t ɹ ə s t", "ˈɪ n t ə ɹ ə s t"], uk: ["ˈɪ n t ɹ ɪ s t", "ˈɪ n t ə ɹ ɪ s t"] }],
  ["evening", { us: ["ˈi v n ɪ ŋ", "ˈi v ə n ɪ ŋ"], uk: ["ˈiː v n ɪ ŋ", "ˈiː v ə n ɪ ŋ"] }],
  ["fire", { us: ["f ˈaɪ ɹ", "f ˈaɪ ɚ"], uk: ["f ˈaɪə", "f ˈaɪ ə"] }],
  ["hour", { us: ["ˈaʊ ɹ", "ˈaʊ ɚ"], uk: ["ˈaʊə", "ˈaʊ ə"] }],
  ["our", { us: ["ˈaʊ ɹ", "ˈaʊ ɚ"], uk: ["ˈaʊə", "ˈaʊ ə"] }],
  ["power", { us: ["p ˈaʊ ɹ", "p ˈaʊ ɚ"], uk: ["p ˈaʊə", "p ˈaʊ ə"] }],
  ["flower", { us: ["f l ˈaʊ ɹ", "f l ˈaʊ ɚ"], uk: ["f l ˈaʊə", "f l ˈaʊ ə"] }],
  ["desire", { us: ["d ɪ z ˈaɪ ɹ", "d ɪ z ˈaɪ ɚ"], uk: ["d ɪ z ˈaɪə", "d ɪ z ˈaɪ ə"] }],
  ["real", { us: ["ɹ ˈi l", "ɹ ˈi ə l"], uk: ["ɹ ˈɪə l", "ɹ ˈiː ə l"] }],
  ["heaven", { us: ["h ˈɛ v n", "h ˈɛ v ə n"], uk: ["h ˈɛ v n", "h ˈɛ v ə n"] }],
]);

const SCHWA_LIKE = new Set(["ə", "ɪ", "ɚ"]);
const LIQUIDS = new Set(["ɹ", "l"]);
const SMOOTHING_US = new Set(["aɪ", "aʊ"]);
const TRIPHTHONGS_UK = new Map<string, string>([
  ["aɪ", "aɪə"],
  ["aʊ", "aʊə"],
]);
const SPLIT_TRIPHTHONGS_UK = new Map<string, string>([
  ["aɪə", "aɪ"],
  ["aʊə", "aʊ"],
]);
const SPLIT_CENTRING_UK = new Map<string, string>([
  ["ɪə", "i"],
  ["ʊə", "u"],
]);
const MAX_CONSONANTS_BEFORE_ELISION = 2;

interface VowelSlot {
  position: number;
  stress: StressLevel;
}

function vowelSlots(pronunciation: Pronunciation): VowelSlot[] {
  const slots: VowelSlot[] = [];
  pronunciation.phonemes.forEach((phoneme, position) => {
    if (isVowel(phoneme)) slots.push({ position, stress: pronunciation.stresses[slots.length] ?? Stress.None });
  });
  return slots;
}

function edited(
  source: Pronunciation,
  phonemes: string[],
  stressEdit: (stresses: StressLevel[]) => void,
): Pronunciation {
  const stresses = [...source.stresses];
  stressEdit(stresses);
  return { phonemes, stresses, certain: source.certain };
}

/**
 * Adds the syllable counts singers commonly use besides the dictionary ones: dropped weak vowels
 * ("every" 2 or 3, "family" 2 or 3), smoothed vowels before r ("fire", "hour", "power" 1 or 2) and
 * split centring diphthongs in British English ("actual" 2 or 3).
 */
export class SungVariants {
  constructor(private readonly accent: Accent) {}

  expand(word: string, pronunciations: Pronunciation[]): Pronunciation[] {
    const certain = pronunciations.every((pronunciation) => pronunciation.certain);
    const extra = (EXTRA_SUNG_FORMS.get(word)?.[this.accent] ?? [])
      .map((ipa) => parseIpa(ipa, certain))
      .filter((pronunciation): pronunciation is Pronunciation => pronunciation !== null);
    const variants = pronunciations.flatMap((pronunciation) => [
      ...this.elideWeakVowels(pronunciation),
      ...this.smoothBeforeR(pronunciation),
      ...this.splitCentringDiphthongs(pronunciation),
    ]);
    return [...pronunciations, ...extra, ...variants];
  }

  /** "every" ˈɛvəɹi → ˈɛvɹi: a weak vowel after a stressed syllable and before r or l plus a weak vowel. */
  private elideWeakVowels(source: Pronunciation): Pronunciation[] {
    const slots = vowelSlots(source);
    const results: Pronunciation[] = [];
    slots.forEach((slot, index) => {
      const previous = slots[index - 1];
      const following = slots[index + 1];
      const vowel = source.phonemes[slot.position] ?? "";
      if (!previous || !following || slot.stress !== Stress.None || !SCHWA_LIKE.has(vowel)) return;
      if (previous.stress === Stress.None || following.stress !== Stress.None) return;
      const consonantsBefore = slot.position - previous.position - 1;
      if (consonantsBefore < 1 || consonantsBefore > MAX_CONSONANTS_BEFORE_ELISION) return;
      const phonemes = [...source.phonemes];
      if (vowel === "ɚ") {
        if (following.position !== slot.position + 1) return;
        phonemes[slot.position] = "ɹ";
      } else {
        const next = source.phonemes[slot.position + 1];
        if (next === undefined || !LIQUIDS.has(next) || following.position !== slot.position + 2) return;
        phonemes.splice(slot.position, 1);
      }
      results.push(edited(source, phonemes, (stresses) => stresses.splice(index, 1)));
    });
    return results;
  }

  /** "fire" faɪɚ ↔ faɪɹ (US) and faɪ.ə ↔ faɪə (UK): one or two syllables. */
  private smoothBeforeR(source: Pronunciation): Pronunciation[] {
    return this.accent === "us" ? this.smoothUs(source) : this.smoothUk(source);
  }

  private smoothUs(source: Pronunciation): Pronunciation[] {
    const slots = vowelSlots(source);
    const results: Pronunciation[] = [];
    slots.forEach((slot, index) => {
      const vowel = source.phonemes[slot.position] ?? "";
      if (!SMOOTHING_US.has(vowel) || slot.stress === Stress.None) return;
      const next = source.phonemes[slot.position + 1];
      const afterNext = source.phonemes[slot.position + 2];
      const endsHere = afterNext === undefined || !isVowel(afterNext);
      if (next === "ɚ" && endsHere) {
        const phonemes = [...source.phonemes];
        phonemes[slot.position + 1] = "ɹ";
        results.push(edited(source, phonemes, (stresses) => stresses.splice(index + 1, 1)));
      } else if (next === "ɹ" && endsHere) {
        const phonemes = [...source.phonemes];
        phonemes[slot.position + 1] = "ɚ";
        results.push(edited(source, phonemes, (stresses) => stresses.splice(index + 1, 0, Stress.None)));
      }
    });
    return results;
  }

  private smoothUk(source: Pronunciation): Pronunciation[] {
    const slots = vowelSlots(source);
    const results: Pronunciation[] = [];
    slots.forEach((slot, index) => {
      const vowel = source.phonemes[slot.position] ?? "";
      const triphthong = TRIPHTHONGS_UK.get(vowel);
      const next = source.phonemes[slot.position + 1];
      const afterNext = source.phonemes[slot.position + 2];
      const endsHere = afterNext === undefined || !isVowel(afterNext);
      if (triphthong && next === "ə" && endsHere) {
        const phonemes = [...source.phonemes];
        phonemes.splice(slot.position, 2, triphthong);
        results.push(edited(source, phonemes, (stresses) => stresses.splice(index + 1, 1)));
      }
      const split = SPLIT_TRIPHTHONGS_UK.get(vowel);
      if (split) {
        const phonemes = [...source.phonemes];
        phonemes.splice(slot.position, 1, split, "ə");
        results.push(edited(source, phonemes, (stresses) => stresses.splice(index + 1, 0, Stress.None)));
      }
    });
    return results;
  }

  /** British unstressed ɪə and ʊə can be sung as two syllables: "India" ˈɪndɪə → ˈɪndiə. */
  private splitCentringDiphthongs(source: Pronunciation): Pronunciation[] {
    if (this.accent !== "uk") return [];
    const results: Pronunciation[] = [];
    vowelSlots(source).forEach((slot, index) => {
      const vowel = source.phonemes[slot.position] ?? "";
      const first = SPLIT_CENTRING_UK.get(vowel);
      if (!first || slot.stress !== Stress.None) return;
      const phonemes = [...source.phonemes];
      phonemes.splice(slot.position, 1, first, "ə");
      results.push(edited(source, phonemes, (stresses) => stresses.splice(index + 1, 0, Stress.None)));
    });
    return results;
  }
}
