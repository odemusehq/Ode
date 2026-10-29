import type { Note } from "../../shared/live";
import type { SyllableNote } from "./lyric-setter";
import { clamp, roundTo } from "./melody-line";
import type { PlannedSyllable } from "./option-chooser";

export interface CheckIssue {
  /** Index of the syllable in the line (0-based, in the chosen pronunciation). */
  syllable: number;
  problem: string;
  fix: string;
}

export interface CheckResult {
  /** 0–1, 1 = zero issues. */
  score: number;
  issues: CheckIssue[];
}

/** A check with the setting it was made on, so the caller can show syllables under notes. */
export interface CheckReport extends CheckResult {
  syllables: PlannedSyllable[];
  notes: Note[];
  alignment: SyllableNote[];
}

/** Penalties add up per line; a total of half the syllable count brings the score to 0. */
export function scoreFromPenalties(penalty: number, syllables: number): number {
  return roundTo(clamp(1 - penalty / Math.max(1, syllables / 2), 0, 1), 2);
}

/** Issues found on a line and the penalty they add up to. */
export class IssueList {
  private readonly issues: CheckIssue[] = [];
  private penalty = 0;

  add(syllable: number, problem: string, fix: string, penalty: number): void {
    this.issues.push({ syllable, problem, fix });
    this.penalty += penalty;
  }

  has(syllable: number): boolean {
    return this.issues.some((issue) => issue.syllable === syllable);
  }

  result(syllables: number): CheckResult {
    return {
      score: scoreFromPenalties(this.penalty, syllables),
      issues: [...this.issues].sort((a, b) => a.syllable - b.syllable),
    };
  }
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The syllables of a word with one of them in capitals: "BE-tween". */
export function emphasise(syllables: PlannedSyllable[], word: number, loud: number): string {
  return syllables
    .map((syllable, index) => ({ syllable, index }))
    .filter(({ syllable }) => syllable.word === word)
    .map(({ syllable, index }) => (index === loud ? syllable.text.toUpperCase() : syllable.text.toLowerCase()))
    .join("-");
}
