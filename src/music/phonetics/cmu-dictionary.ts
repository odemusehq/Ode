import { dictionary } from "cmu-pronouncing-dictionary";
import { arpabetToPronunciation } from "./arpabet";
import type { Pronunciation } from "./pronunciation";

/** Plain words, contractions and hyphenated words; abbreviations ("a.m.") and numbers are left out. */
const WORD_KEY = /^[a-z'][a-z'-]*$/;
/** Alternate pronunciations are stored as "word(2)", "word(3)"… */
const ALTERNATE_KEY = /^(.+)\(\d+\)$/;

/** US English pronunciations from the CMU Pronouncing Dictionary (public domain), converted to IPA. */
export class CmuDictionary {
  private codes: Map<string, string[]> | null = null;
  private readonly converted = new Map<string, Pronunciation[]>();

  lookup(word: string): Pronunciation[] | undefined {
    const cached = this.converted.get(word);
    if (cached) return cached;
    const codes = this.load().get(word);
    if (!codes) return undefined;
    const pronunciations = codes
      .map((code) => arpabetToPronunciation(code))
      .filter((pronunciation): pronunciation is Pronunciation => pronunciation !== null);
    if (pronunciations.length === 0) return undefined;
    this.converted.set(word, pronunciations);
    return pronunciations;
  }

  has(word: string): boolean {
    return this.load().has(word);
  }

  words(): IterableIterator<string> {
    return this.load().keys();
  }

  private load(): Map<string, string[]> {
    if (this.codes) return this.codes;
    const codes = new Map<string, string[]>();
    for (const [key, code] of Object.entries(dictionary)) {
      const word = ALTERNATE_KEY.exec(key)?.[1] ?? key;
      if (!WORD_KEY.test(word)) continue;
      const list = codes.get(word);
      if (list) list.push(code);
      else codes.set(word, [code]);
    }
    this.codes = codes;
    return codes;
  }
}
