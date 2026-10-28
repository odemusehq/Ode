import type { Note } from "../../shared/live";
import type { ClipInfo } from "../../shared/live-ops";
import type { LineAnalysis, MelodyLine, SungSyllable } from "../../shared/lyrics";
import { Stress, type StressLevel } from "../phonetics/pronunciation";
import { melodyLine } from "./melody-line";
import { Meter } from "./meter";
import { ProsodyChecker } from "./prosody-checker";

/** Positions closer than this (in beats) count as the same. */
const SAME_TIME = 1e-3;
/** Shown under a note that holds the syllable before it, like the extender line in sheet music. */
const HELD = "_";
/** Joins syllables that have to share one note, as lyrics are hyphenated under notes. */
const SHARED = "-";
/** Strongest first: primary, secondary, unstressed. */
const STRESS_ORDER: readonly StressLevel[] = [Stress.Primary, Stress.Secondary, Stress.None];

/** A lyric line to set: its id in the lead sheet, its text and its analysis. */
export interface LineToSet {
  id: string;
  text: string;
  analysis: LineAnalysis;
}

/**
 * Sets a section's lyric lines to its melody: the melody is cut into one phrase per line at its longest
 * rests, then each line is set to its phrase and checked for prosody, so the Lyrics tab can show every
 * syllable under its note.
 */
export class MelodyFitter {
  private readonly checker: ProsodyChecker;

  constructor(private readonly meter: Meter) {
    this.checker = new ProsodyChecker(meter);
  }

  /** `notes` are in beats from the section start; lines without words get no phrase. */
  fit(lines: LineToSet[], notes: Note[], lengthBeats: number): MelodyLine[] {
    const sung = lines.filter((line) => line.analysis.words.length > 0);
    const phrases = this.phrases(melodyLine(notes), sung.length, lengthBeats);
    return sung.map((line, index) => this.setLine(line, phrases[index] ?? []));
  }

  /** The melody cut into `count` phrases at its longest rests; with too few rests, into equal stretches of whole bars. */
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
    const bar = this.meter.barLength;
    const stretch = lengthBeats / count >= bar ? Math.round(lengthBeats / count / bar) * bar : lengthBeats / count;
    const phrases: Note[][] = Array.from({ length: count }, () => []);
    for (const note of melody) phrases[Math.min(count - 1, Math.floor((note.start + SAME_TIME) / stretch))]?.push(note);
    return phrases;
  }

  /**
   * The clip's notes as they play in a stretch of the Arrangement, in beats from its start. An Arrangement
   * clip plays from its own position; a Session clip is laid from the start of the stretch, looping when it loops.
   */
  static melodyIn(clip: ClipInfo, arranged: boolean, startBeat: number, lengthBeats: number): Note[] {
    const notes = clip.notes ?? [];
    const clipStart = arranged ? clip.startTime : startBeat;
    const playLength = arranged ? clip.duration : clip.looping ? lengthBeats : clip.endMarker - clip.startMarker;
    const played: Note[] = [];
    const lay = (from: number, to: number, at: number) => {
      for (const note of notes) {
        if (note.start < from - SAME_TIME || note.start >= to - SAME_TIME) continue;
        const offset = at + note.start - from;
        if (offset < playLength - SAME_TIME) played.push({ ...note, start: clipStart + offset - startBeat });
      }
    };
    if (!clip.looping) {
      lay(clip.startMarker, clip.endMarker, 0);
    } else {
      const loop = clip.loopEnd - clip.loopStart;
      lay(clip.startMarker, clip.loopEnd, 0);
      for (let at = clip.loopEnd - clip.startMarker; loop > SAME_TIME && at < playLength; at += loop) lay(clip.loopStart, clip.loopEnd, at);
    }
    return played.filter((note) => note.start > -SAME_TIME && note.start < lengthBeats - SAME_TIME).sort((a, b) => a.start - b.start);
  }

  private setLine(line: LineToSet, phrase: Note[]): MelodyLine {
    const report = this.checker.check(line.analysis, phrase);
    const problems = new Set(report.issues.map((issue) => issue.syllable));
    const sungOn: number[][] = phrase.map(() => []);
    for (const { syllable, note } of report.alignment) {
      const part = report.notes[note];
      const at = part ? MelodyFitter.noteHolding(phrase, part.start) : -1;
      const syllables = sungOn[at];
      if (syllables && !syllables.includes(syllable)) syllables.push(syllable);
    }
    let previous = -1;
    const marks = sungOn.map((syllables): SungSyllable | null => {
      if (syllables.length === 0) return null;
      if (syllables.length === 1 && syllables[0] === previous) return { text: HELD, stress: Stress.None, problem: problems.has(previous) };
      previous = syllables.at(-1) ?? previous;
      const planned = syllables.flatMap((index) => report.syllables[index] ?? []);
      return {
        text: planned.map((syllable) => syllable.text).join(SHARED),
        stress: STRESS_ORDER.find((level) => planned.some((syllable) => syllable.stress === level)) ?? Stress.None,
        problem: syllables.some((index) => problems.has(index)),
      };
    });
    return {
      line: line.id,
      text: line.text,
      notes: phrase,
      marks,
      syllables: report.syllables.length,
      noteCount: phrase.length,
      score: report.score,
      issues: report.issues.map(({ problem, fix }) => ({ problem, fix })),
    };
  }

  /** The phrase note a (possibly split) part belongs to: the last one starting at or before it. */
  private static noteHolding(phrase: Note[], start: number): number {
    let found = -1;
    phrase.forEach((note, index) => {
      if (note.start <= start + SAME_TIME) found = index;
    });
    return found;
  }
}
