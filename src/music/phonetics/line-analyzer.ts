import type { LineAnalysis, WordAnalysis, WordOption } from "../../shared/lyrics";
import type { Accent } from "../../shared/personalisation";
import { isFunctionWord } from "./function-words";
import { Lexicon } from "./lexicon";
import { Stress, type Pronunciation, type StressLevel } from "./pronunciation";
import { SyllableSpeller } from "./syllable-speller";
import { syllabify } from "./syllabify";
import { tokenize, type Token } from "./tokenizer";

/** Function words of this many syllables or fewer lose all stress inside a line ("the", "and", "you"). */
const SHORT_FUNCTION_WORD_SYLLABLES = 1;

/** Short function words lose their stress; longer ones ("about", "into") keep their shape one level weaker. */
export function weakenStress(stresses: StressLevel[]): StressLevel[] {
  if (stresses.length <= SHORT_FUNCTION_WORD_SYLLABLES) return stresses.map(() => Stress.None);
  return stresses.map((stress) => (stress === Stress.Primary ? Stress.Secondary : Stress.None));
}

/** Every total syllable count the line can have, ascending. */
export function possibleCounts(words: WordAnalysis[]): number[] {
  let totals = new Set<number>([0]);
  for (const word of words) {
    const counts = new Set(word.options.map((option) => option.syllables.length));
    if (counts.size === 0) continue;
    const next = new Set<number>();
    for (const total of totals) for (const count of counts) next.add(total + count);
    totals = next;
  }
  return [...totals].sort((a, b) => a - b);
}

/**
 * Analyses a lyric line in one accent: every pronunciation of every word, syllables spelled for
 * display, phrase stress (content words keep their stress, function words are weakened unless they
 * are the only word) and every possible syllable count of the line.
 */
export class LineAnalyzer {
  private static readonly instances = new Map<Accent, LineAnalyzer>();
  private readonly lexicon: Lexicon;
  private readonly speller: SyllableSpeller;

  private constructor(readonly accent: Accent) {
    this.lexicon = Lexicon.for(accent);
    this.speller = SyllableSpeller.for(accent);
  }

  static for(accent: Accent): LineAnalyzer {
    let analyzer = LineAnalyzer.instances.get(accent);
    if (!analyzer) {
      analyzer = new LineAnalyzer(accent);
      LineAnalyzer.instances.set(accent, analyzer);
    }
    return analyzer;
  }

  analyze(text: string): LineAnalysis {
    const tokens = tokenize(text, (word) => this.lexicon.dictionary(word) !== undefined);
    const onlyWord = tokens.length === 1;
    const words = tokens.map((token) => this.analyzeWord(token, onlyWord));
    return { text, words, counts: possibleCounts(words) };
  }

  private analyzeWord(token: Token, onlyWord: boolean): WordAnalysis {
    const pronunciations = this.lexicon.pronounce(token.word);
    const weakened = !onlyWord && isFunctionWord(token.word);
    return {
      text: token.text,
      options: pronunciations.map((pronunciation) => this.option(token.text, pronunciation, weakened)),
      certain: pronunciations.length > 0 && pronunciations.every((pronunciation) => pronunciation.certain),
    };
  }

  private option(text: string, pronunciation: Pronunciation, weakened: boolean): WordOption {
    const syllables = syllabify(pronunciation.phonemes);
    const spelled = this.speller.spell(text, syllables.length);
    const stresses = weakened ? weakenStress(pronunciation.stresses) : pronunciation.stresses;
    return {
      syllables: syllables.map((phonemes, index) => ({
        text: spelled[index] ?? "",
        phonemes,
        stress: stresses[index] ?? Stress.None,
      })),
    };
  }
}

/** Analyses one lyric line: words, pronunciation options with syllables and stress, possible syllable counts. */
export function analyzeLine(text: string, accent: Accent): LineAnalysis {
  return LineAnalyzer.for(accent).analyze(text);
}
