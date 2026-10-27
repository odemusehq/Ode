import type { LineAnalysis, SyllableInfo, WordOption } from "../../shared/lyrics";
import { isFunctionWord } from "../phonetics/function-words";
import { isVowel } from "../phonetics/phoneme";

/** One syllable of a line, in the chosen pronunciation, with the word it belongs to. */
export interface PlannedSyllable extends SyllableInfo {
  /** Index of the word in the line. */
  word: number;
  wordText: string;
  functionWord: boolean;
  firstInWord: boolean;
  lastInWord: boolean;
  /** The syllable's vowel. */
  vowel: string;
  onsetLength: number;
  codaLength: number;
}

/** Cost of each step away from a word's first (most usual) pronunciation. */
const ALTERNATE_OPTION_COST = 0.1;

interface ChoiceState {
  cost: number;
  choices: number[];
}

/**
 * Chooses one pronunciation per word so the line's syllable count is as close as possible to a
 * target (the number of notes), preferring fewer syllables to more and usual pronunciations to rare ones.
 */
export class OptionChooser {
  choose(line: LineAnalysis, target: number): (WordOption | null)[] {
    let states = new Map<number, ChoiceState>([[0, { cost: 0, choices: [] }]]);
    for (const word of line.words) {
      if (word.options.length === 0) {
        states = new Map(
          [...states].map(([total, state]): [number, ChoiceState] => [total, { ...state, choices: [...state.choices, -1] }]),
        );
        continue;
      }
      const next = new Map<number, ChoiceState>();
      for (const [total, state] of states) {
        word.options.forEach((option, index) => {
          const sum = total + option.syllables.length;
          const cost = state.cost + index * ALTERNATE_OPTION_COST;
          const existing = next.get(sum);
          if (!existing || cost < existing.cost) next.set(sum, { cost, choices: [...state.choices, index] });
        });
      }
      states = next;
    }
    let best: { total: number; state: ChoiceState } | null = null;
    for (const [total, state] of states) {
      if (!best || this.better(total, state, best.total, best.state, target)) best = { total, state };
    }
    const choices = best?.state.choices ?? [];
    return line.words.map((word, index) => word.options[choices[index] ?? -1] ?? null);
  }

  /** The syllables of the chosen pronunciations, in order. */
  flatten(line: LineAnalysis, options: (WordOption | null)[]): PlannedSyllable[] {
    const syllables: PlannedSyllable[] = [];
    line.words.forEach((word, wordIndex) => {
      const option = options[wordIndex];
      if (!option) return;
      const functionWord = isFunctionWord(word.text);
      option.syllables.forEach((syllable, index) => {
        const vowelAt = syllable.phonemes.findIndex((phoneme) => isVowel(phoneme));
        syllables.push({
          ...syllable,
          word: wordIndex,
          wordText: word.text,
          functionWord,
          firstInWord: index === 0,
          lastInWord: index === option.syllables.length - 1,
          vowel: syllable.phonemes[vowelAt] ?? "",
          onsetLength: Math.max(0, vowelAt),
          codaLength: vowelAt < 0 ? 0 : syllable.phonemes.length - vowelAt - 1,
        });
      });
    });
    return syllables;
  }

  /** Syllables for the line at a target count: choose, then flatten. */
  plan(line: LineAnalysis, target: number): PlannedSyllable[] {
    return this.flatten(line, this.choose(line, target));
  }

  private better(total: number, state: ChoiceState, bestTotal: number, bestState: ChoiceState, target: number): boolean {
    const distance = Math.abs(total - target);
    const bestDistance = Math.abs(bestTotal - target);
    if (distance !== bestDistance) return distance < bestDistance;
    const over = total > target;
    const bestOver = bestTotal > target;
    if (over !== bestOver) return !over;
    return state.cost < bestState.cost;
  }
}
