export interface Token {
  /** The word as written in the line, without surrounding quote marks. */
  text: string;
  /** Lower case with straight apostrophes, for dictionary lookups. */
  word: string;
}

/**
 * Words with inner apostrophes and hyphens kept ("don't", "rock'n'roll", "heart-shaped"), plus a
 * leading or trailing apostrophe that may mark a dropped sound ("'cause", "lovin'").
 */
const WORD_PATTERN = /['’]?[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*['’]?/gu;
const APOSTROPHES = /[’‘]/g;
/** Trailing apostrophes that belong to the word: dropped g ("nothin'") and plural possessive ("lovers'"). */
const KEPT_TRAILING = /(in|s)'$/;

function normalize(text: string): string {
  return text.toLowerCase().replace(APOSTROPHES, "'");
}

/** Splits a lyric line into words. A leading apostrophe stays only when `knowsWord` recognises the form. */
export function tokenize(text: string, knowsWord: (word: string) => boolean): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    let written = match[0];
    let word = normalize(written);
    if (word.endsWith("'") && !KEPT_TRAILING.test(word)) {
      written = written.slice(0, -1);
      word = word.slice(0, -1);
    }
    if (word.startsWith("'") && !knowsWord(word)) {
      written = written.slice(1);
      word = word.slice(1);
    }
    if (word.length > 0) tokens.push({ text: written, word });
  }
  return tokens;
}
