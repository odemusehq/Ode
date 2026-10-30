import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import { melodyLine } from "./melody-line";
import { Meter } from "./meter";
import { ProsodyChecker } from "./prosody-checker";
import type { PlannedSyllable } from "./option-chooser";

/** Positions closer than this (in beats) count as the same. */
const SAME_TIME = 1e-3;

/** A sung lyric line to fit: its text and its analysis. */
export interface LineToSet {
  text: string;
  analysis: LineAnalysis;
}

/** One lyric line on its phrase of the melody, counted and checked. */
export interface FittedLine {
  /** The line's place among the lines given, from 0. */
  index: number;
  text: string;
  /** The notes of the phrase the line is sung on, as given (beats from the start of the stretch). */
  phrase: Note[];
  /** Syllables in the pronunciation that fits the phrase best. */
  syllables: number;
  noteCount: number;
  /** The setting that was checked, including any splits, with alignment into this array. */
  notes: Note[];
  alignment: { syllable: number; note: number }[];
  syllableDetails: PlannedSyllable[];
  uncertainWords: string[];
  /** 0–1 from the prosody check; 1 means zero issues. */
  score: number;
  issues: { problem: string; fix: string }[];
}

/**
 * Fits lyric lines to a melody: the melody is cut into one phrase per line at its longest rests, then each line is set
 * to its phrase and checked for prosody, so each line's syllables can be counted against its notes.
 */
export class MelodyFitter {
  private readonly checker: ProsodyChecker;

  constructor(private readonly meter: Meter) {
    this.checker = new ProsodyChecker(meter);
  }

  /** `notes` are in beats from the start of a stretch `lengthBeats` long; only lines with words get a phrase. */
  fit(lines: LineToSet[], notes: Note[], lengthBeats: number): FittedLine[] {
    const sung = lines.flatMap((line, index) => (line.analysis.words.length > 0 ? [{ line, index }] : []));
    const phrases = this.phrases(melodyLine(notes), sung.length, lengthBeats);
    return sung.map(({ line, index }, phrase) => this.setLine(line, index, phrases[phrase] ?? []));
  }

  /**
   * The melody cut into `count` phrases at its longest rests. With too few rests it is cut into stretches of whole
   * bars, as even as the bars allow (equal stretches when there are fewer bars than phrases); the last phrase runs to
   * the end of the melody.
   */
  phrases(melody: Note[], count: number, lengthBeats: number): Note[][] {
    if (count <= 1) return count === 1 ? [melody] : [];
    const rests = melody
      .slice(0, -1)
      .map((note, index) => ({ after: index, length: (melody[index + 1]?.start ?? 0) - (note.start + note.duration) }))
      .filter((rest) => rest.length > SAME_TIME);
    if (rests.length >= count - 1) {
      const cuts = rests
        .sort((a, b) => b.length - a.length || a.after - b.after)
        .slice(0, count - 1)
        .map((rest) => rest.after)
        .sort((a, b) => a - b);
      return [-1, ...cuts].map((cut, index) => melody.slice(cut + 1, (cuts[index] ?? melody.length - 1) + 1));
    }
    const starts = this.stretchStarts(count, lengthBeats);
    const phrases: Note[][] = starts.map(() => []);
    for (const note of melody) {
      const index = starts.findLastIndex((start) => start <= note.start + SAME_TIME);
      phrases[Math.max(0, index)]?.push(note);
    }
    return phrases;
  }

  /** Where each of `count` stretches starts: on bar lines spread as evenly as the bars allow, or evenly when bars are fewer. */
  private stretchStarts(count: number, lengthBeats: number): number[] {
    const bar = this.meter.barLength;
    const bars = lengthBeats / bar;
    return Array.from({ length: count }, (_, index) => (bars >= count ? Math.round((index * bars) / count) * bar : (index * lengthBeats) / count));
  }

  private setLine(line: LineToSet, index: number, phrase: Note[]): FittedLine {
    const report = this.checker.check(line.analysis, phrase);
    return {
      index,
      text: line.text,
      phrase,
      syllables: report.syllables.length,
      noteCount: phrase.length,
      notes: report.notes,
      alignment: report.alignment,
      syllableDetails: report.syllables,
      uncertainWords: line.analysis.words.filter((word) => !word.certain).map((word) => word.text),
      score: report.score,
      issues: report.issues.map(({ problem, fix }) => ({ problem, fix })),
    };
  }
}
