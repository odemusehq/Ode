import { readFileSync } from "node:fs";
import { parseIpa } from "./ipa";
import type { Pronunciation } from "./pronunciation";

/** Britfone 3.0.1 (MIT licence, see britfone.LICENSE.txt beside the data file). */
const DATA_FILE = new URL("./data/britfone.main.3.0.1.csv", import.meta.url);
const FIELD_SEPARATOR = ", ";
/** Britfone joins multi-word entries with "_"; Ode looks up single words only. */
const MULTI_WORD_MARK = "_";
const ALTERNATE_SUFFIX = /\(\d+\)$/;

/**
 * British English (Standard Southern British) pronunciations from Britfone. Its vocabulary is the
 * most frequent English words (British National Corpus and Google Web Corpus), in UK and US spellings,
 * so membership doubles as a measure of how common a word is.
 */
export class BritfoneDictionary {
  private entries: Map<string, Pronunciation[]> | null = null;

  lookup(word: string): Pronunciation[] | undefined {
    return this.load().get(word);
  }

  has(word: string): boolean {
    return this.load().has(word);
  }

  words(): IterableIterator<string> {
    return this.load().keys();
  }

  private load(): Map<string, Pronunciation[]> {
    if (this.entries) return this.entries;
    const entries = new Map<string, Pronunciation[]>();
    for (const line of readFileSync(DATA_FILE, "utf8").split("\n")) {
      const separator = line.indexOf(FIELD_SEPARATOR);
      if (separator <= 0) continue;
      const key = line.slice(0, separator);
      if (key.includes(MULTI_WORD_MARK)) continue;
      const word = key.replace(ALTERNATE_SUFFIX, "").toLowerCase();
      const pronunciation = parseIpa(line.slice(separator + FIELD_SEPARATOR.length));
      if (!pronunciation) continue;
      const list = entries.get(word);
      if (list) list.push(pronunciation);
      else entries.set(word, [pronunciation]);
    }
    this.entries = entries;
    return entries;
  }
}
