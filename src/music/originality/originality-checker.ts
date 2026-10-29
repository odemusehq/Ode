import { CLICHES } from "./cliches";
import { isOverusedPair } from "./overused-rhymes";

export enum QuoteRisk {
  Unknown = "unknown",
  Low = "low",
  Possible = "possible",
}

export interface OriginalityReport {
  /** Clichéd phrases found in the text. */
  cliches: string[];
  /** Phrases repeated from the artist's earlier songs. */
  repeats: string[];
  /** Over-used rhyme pairs at line endings, as "fire / desire". */
  overusedRhymes: string[];
  /** Unknown until a separate quotation check runs; model recollection is not corpus-backed clearance. */
  quoteRisk: QuoteRisk;
}

/** Consecutive words shared with an earlier song that count as a repeat. */
const REPEAT_WORDS = 5;
/** A whole line this long that appears in an earlier song counts as a repeat. */
const MIN_REPEATED_LINE_WORDS = 3;
/** Over-used rhyme pairs are reported between line endings this close. */
const RHYME_WINDOW = 4;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

function wordsOf(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}']+/u)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 0);
}

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Flags clichés, over-used rhyme pairs and repeats of the artist's own earlier lyrics. These are
 * warnings only; quotation of other songs is checked by a model in the tool.
 */
export class OriginalityChecker {
  check(text: string, pastLyrics: string[]): OriginalityReport {
    const lines = linesOf(text);
    return {
      cliches: this.findCliches(lines),
      repeats: this.findRepeats(lines, pastLyrics),
      overusedRhymes: this.findOverusedRhymes(lines),
      quoteRisk: QuoteRisk.Unknown,
    };
  }

  findCliches(lines: string[]): string[] {
    const found = new Set<string>();
    for (const line of lines) {
      const normalized = normalize(line);
      for (const cliche of CLICHES) if (cliche.pattern.test(normalized)) found.add(cliche.phrase);
    }
    return [...found];
  }

  findOverusedRhymes(lines: string[]): string[] {
    const endings = lines.map((line) => wordsOf(line).at(-1) ?? "");
    const found = new Set<string>();
    endings.forEach((ending, index) => {
      for (let other = index + 1; other < endings.length && other - index <= RHYME_WINDOW; other++) {
        const partner = endings[other] ?? "";
        if (ending && partner && isOverusedPair(ending, partner)) found.add(`${ending} / ${partner}`);
      }
    });
    return [...found];
  }

  findRepeats(lines: string[], pastLyrics: string[]): string[] {
    const pastPhrases = new Set<string>();
    const pastLines = new Set<string>();
    for (const past of pastLyrics) {
      for (const line of linesOf(past)) {
        const words = wordsOf(line);
        if (words.length >= MIN_REPEATED_LINE_WORDS) pastLines.add(words.join(" "));
        for (let start = 0; start + REPEAT_WORDS <= words.length; start++) {
          pastPhrases.add(words.slice(start, start + REPEAT_WORDS).join(" "));
        }
      }
    }
    const found = new Set<string>();
    for (const line of lines) {
      const words = wordsOf(line);
      const whole = words.join(" ");
      if (words.length >= MIN_REPEATED_LINE_WORDS && pastLines.has(whole)) {
        found.add(whole);
        continue;
      }
      for (const span of this.sharedSpans(words, pastPhrases)) found.add(span);
    }
    return [...found];
  }

  /** Longest runs of words whose every five-word stretch also appears in the earlier lyrics. */
  private sharedSpans(words: string[], pastPhrases: ReadonlySet<string>): string[] {
    const spans: string[] = [];
    let spanStart = -1;
    let spanEnd = -1;
    for (let start = 0; start + REPEAT_WORDS <= words.length; start++) {
      if (!pastPhrases.has(words.slice(start, start + REPEAT_WORDS).join(" "))) continue;
      if (spanStart >= 0 && start <= spanEnd) {
        spanEnd = start + REPEAT_WORDS;
        continue;
      }
      if (spanStart >= 0) spans.push(words.slice(spanStart, spanEnd).join(" "));
      spanStart = start;
      spanEnd = start + REPEAT_WORDS;
    }
    if (spanStart >= 0) spans.push(words.slice(spanStart, spanEnd).join(" "));
    return spans;
  }
}

const checker = new OriginalityChecker();

/** Local cliché/repetition checks; quotation risk remains unknown here. */
export function originalityCheck(text: string, pastLyrics: string[]): OriginalityReport {
  return checker.check(text, pastLyrics);
}
