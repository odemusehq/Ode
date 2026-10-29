import type { Note } from "../../shared/live";
import { noteName } from "../../shared/notes";
import type { ChordEvent } from "../../shared/song";
import { ChordTimeline } from "../harmony/chord-timeline";
import { MusicalKey, type KeySpec } from "../harmony/musical-key";
import { inRange, type PitchRange } from "../harmony/pitch-range";
import { melodyLine, roundTo } from "../prosody/melody-line";
import { METRICAL_WEIGHT, type Meter } from "../prosody/meter";

/** Onsets closer than a thirty-second note (in beats) sound together. */
const TOGETHER_BEATS = 0.125;

/** A note where a check found something: its beat, Live's name for its pitch and its MIDI number. */
export interface PlacedNote {
  beat: number;
  pitch: string;
  midi: number;
}

/** What to check a part against; leave a field out to skip that check. */
export interface PartCheckOptions {
  key?: KeySpec | null;
  range?: PitchRange | null;
  /** Chords in the same time base as the notes. */
  chords?: ChordEvent[];
  /** Notes of the part to line up with, such as the kick's. */
  lockTo?: Note[];
  /** The Drum Rack's pad notes. */
  pads?: number[];
  /** Leaps wider than this many semitones are listed. */
  maxLeap?: number;
}

export interface PartCheck {
  notes: number;
  lowest: PlacedNote | null;
  highest: PlacedNote | null;
  /** Mean MIDI pitch, to compare how high two sections sit. */
  averagePitch: number | null;
  key?: { key: string; outOfKey: PlacedNote[] };
  range?: { low: string; high: string; outside: PlacedNote[] };
  chordTones?: { strongBeatNotes: number; offChord: (PlacedNote & { chord: string })[] };
  lock?: { onsets: number; together: number; apart: number[]; targetsWithoutNote: number[] };
  pads?: { missing: { pitch: string; midi: number; notes: number }[] };
  leaps?: { largest: number; over: { from: PlacedNote; to: PlacedNote; semitones: number }[] };
  /** True when every check that ran came back clean. */
  passed: boolean;
}

/**
 * Checks the notes of a part (a melody, bassline, chord part or drum pattern): notes outside the key or
 * the range, notes on strong beats outside the chord, onsets apart from another part's onsets,
 * notes without a Drum Rack pad, and wide leaps.
 */
export class PartChecker {
  constructor(private readonly meter: Meter) {}

  check(notes: Note[], options: PartCheckOptions): PartCheck {
    const sounding = notes.filter((note) => !note.muted).sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    const pitches = sounding.map((note) => note.pitch);
    const result: PartCheck = {
      notes: sounding.length,
      lowest: PartChecker.extreme(sounding, (a, b) => a.pitch < b.pitch),
      highest: PartChecker.extreme(sounding, (a, b) => a.pitch > b.pitch),
      averagePitch: pitches.length > 0 ? roundTo(pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length, 1) : null,
      passed: true,
    };
    if (options.key) {
      const key = MusicalKey.from(options.key);
      result.key = { key: key.label, outOfKey: sounding.filter((note) => !key.contains(note.pitch)).map(PartChecker.placed) };
      result.passed &&= result.key.outOfKey.length === 0;
    }
    if (options.range) {
      const range = options.range;
      result.range = { low: noteName(range.low), high: noteName(range.high), outside: sounding.filter((note) => !inRange(note.pitch, range)).map(PartChecker.placed) };
      result.passed &&= result.range.outside.length === 0;
    }
    if (options.chords && options.chords.length > 0) {
      result.chordTones = this.chordTones(sounding, new ChordTimeline(options.chords));
      result.passed &&= result.chordTones.offChord.length === 0;
    }
    if (options.lockTo) {
      result.lock = PartChecker.lock(sounding, options.lockTo.filter((note) => !note.muted));
      result.passed &&= result.lock.apart.length === 0;
    }
    if (options.pads) {
      result.pads = PartChecker.pads(sounding, new Set(options.pads));
      result.passed &&= result.pads.missing.length === 0;
    }
    if (options.maxLeap !== undefined || sounding.length > 1) {
      result.leaps = PartChecker.leaps(melodyLine(sounding), options.maxLeap);
      result.passed &&= result.leaps.over.length === 0;
    }
    return result;
  }

  /** Notes on strong beats (beats 1 and 3 in 4/4, beat 1 in 3/4 and 6/8) checked against the chord sounding there. */
  private chordTones(notes: Note[], chords: ChordTimeline): NonNullable<PartCheck["chordTones"]> {
    const strong = notes.filter((note) => this.meter.weightAt(note.start) >= METRICAL_WEIGHT.middleBeat);
    const offChord = strong.flatMap((note) => {
      const chord = chords.at(note.start);
      return chord && !chord.contains(note.pitch) ? [{ ...PartChecker.placed(note), chord: chord.symbol }] : [];
    });
    return { strongBeatNotes: strong.length, offChord };
  }

  private static lock(notes: Note[], targets: Note[]): NonNullable<PartCheck["lock"]> {
    const onsets = PartChecker.onsets(notes);
    const targetOnsets = PartChecker.onsets(targets);
    const near = (beat: number, list: number[]) => list.some((other) => Math.abs(other - beat) <= TOGETHER_BEATS);
    const apart = onsets.filter((beat) => !near(beat, targetOnsets));
    return {
      onsets: onsets.length,
      together: onsets.length - apart.length,
      apart,
      targetsWithoutNote: targetOnsets.filter((beat) => !near(beat, onsets)),
    };
  }

  private static pads(notes: Note[], pads: ReadonlySet<number>): NonNullable<PartCheck["pads"]> {
    const counts = new Map<number, number>();
    for (const note of notes) if (!pads.has(note.pitch)) counts.set(note.pitch, (counts.get(note.pitch) ?? 0) + 1);
    return { missing: [...counts].sort(([a], [b]) => a - b).map(([midi, count]) => ({ pitch: noteName(midi), midi, notes: count })) };
  }

  private static leaps(line: Note[], maxLeap: number | undefined): NonNullable<PartCheck["leaps"]> {
    const steps = line.slice(1).map((note, index) => ({ from: line[index] as Note, to: note, semitones: Math.abs(note.pitch - (line[index] as Note).pitch) }));
    return {
      largest: steps.reduce((widest, step) => Math.max(widest, step.semitones), 0),
      over: maxLeap === undefined ? [] : steps.filter((step) => step.semitones > maxLeap).map((step) => ({ from: PartChecker.placed(step.from), to: PartChecker.placed(step.to), semitones: step.semitones })),
    };
  }

  /** Distinct start times, in order. */
  private static onsets(notes: Note[]): number[] {
    const starts = [...new Set(notes.map((note) => note.start))].sort((a, b) => a - b);
    return starts.filter((start, index) => index === 0 || start - (starts[index - 1] ?? start) > TOGETHER_BEATS / 2);
  }

  private static extreme(notes: Note[], better: (a: Note, b: Note) => boolean): PlacedNote | null {
    const found = notes.reduce<Note | null>((best, note) => (best === null || better(note, best) ? note : best), null);
    return found ? PartChecker.placed(found) : null;
  }

  private static placed(note: Note): PlacedNote {
    return { beat: note.start, pitch: noteName(note.pitch), midi: note.pitch };
  }
}
