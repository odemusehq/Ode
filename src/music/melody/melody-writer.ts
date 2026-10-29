import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import type { ChordEvent } from "../../shared/song";
import { ChordTimeline } from "../harmony/chord-timeline";
import { KeyFinder } from "../harmony/key-finder";
import { MusicalKey } from "../harmony/musical-key";
import { requirePitchRange, type PitchRange } from "../harmony/pitch-range";
import { clamp } from "../prosody/melody-line";
import { Meter } from "../prosody/meter";
import { OptionChooser } from "../prosody/option-chooser";
import { SeededRandom } from "../rhythm/random";
import { DEFAULT_SEED, MAX_DENSITY, MIN_DENSITY, Register, type MelodyPlan } from "./melody-plan";
import { MelodyRhythm, type MelodyOnset } from "./melody-rhythm";
import { PitchPlanner, type MotifShape } from "./pitch-planner";

/** Where the middle of the melody sits inside the singer's range for each register. */
const REGISTER_POSITION: Readonly<Record<Register, number>> = {
  [Register.Low]: 0.3,
  [Register.Mid]: 0.5,
  [Register.High]: 0.7,
};
/** How far the contour moves from the middle, as a share of the range. */
const CONTOUR_SPAN_SHARE = 0.35;
const DEFAULT_MOTIF_BARS = 2;
/** Plans count beats in quarter notes. */
const BASE_VELOCITY = 80;
const ACCENT_VELOCITY = 20;
const MAX_VELOCITY = 127;

/**
 * Writes a melody from a plan described in words: stressed syllables and chord tones on strong beats,
 * mostly stepwise motion, leaps followed by a step back, a motif repeated and varied, inside the
 * singer's range, higher for a high register (a chorus) than a low one (a verse).
 */
export class MelodyWriter {
  private readonly meter: Meter;
  private readonly key: MusicalKey;
  private readonly chords: ChordTimeline;
  private readonly random: SeededRandom;
  private readonly range: PitchRange;

  constructor(
    private readonly plan: MelodyPlan,
    chords: ChordEvent[],
    range: PitchRange,
  ) {
    this.meter = new Meter(plan.signature.numerator, plan.signature.denominator);
    this.key = plan.key ? MusicalKey.from(plan.key) : new KeyFinder().find(chords);
    this.chords = new ChordTimeline(chords);
    this.random = new SeededRandom(plan.seed ?? DEFAULT_SEED);
    this.range = requirePitchRange(range);
  }

  write(lyric?: LineAnalysis): Note[] {
    const totalBeats = Math.max(1, this.plan.bars) * this.meter.barLength;
    const density = clamp(this.plan.density, MIN_DENSITY, MAX_DENSITY);
    const onsets = this.rhythm(lyric, totalBeats, density);
    const width = this.range.high - this.range.low;
    const planner = new PitchPlanner({
      key: this.key,
      range: this.range,
      chords: this.chords,
      meter: this.meter,
      random: this.random,
      contour: this.plan.contour,
      centre: this.range.low + width * REGISTER_POSITION[this.plan.register],
      span: width * CONTOUR_SPAN_SHARE,
      totalBeats,
    });
    const firstPass = planner.plan(onsets, null);
    const motif = this.motifShape(planner, onsets, firstPass);
    const pitches = motif ? planner.plan(onsets, motif) : firstPass;
    return onsets.map((onset, index) => ({
      pitch: pitches[index] ?? Math.round(this.range.low + width / 2),
      start: onset.start,
      duration: onset.duration,
      velocity: Math.min(MAX_VELOCITY, Math.round(BASE_VELOCITY + ACCENT_VELOCITY * this.meter.weightAt(onset.start))),
    }));
  }

  private rhythm(lyric: LineAnalysis | undefined, totalBeats: number, density: number): MelodyOnset[] {
    const rhythm = new MelodyRhythm(this.meter, this.random);
    if (lyric && lyric.words.length > 0) {
      const syllables = new OptionChooser().plan(lyric, Math.round(totalBeats * density));
      if (syllables.length > 0) return rhythm.forSyllables(syllables, totalBeats);
    }
    const bars = Math.max(1, this.plan.bars);
    const motifBars = clamp(Math.round(this.plan.motifBars ?? Math.min(DEFAULT_MOTIF_BARS, bars)), 1, bars);
    return rhythm.forMotif(totalBeats, motifBars * this.meter.barLength, density);
  }

  /** The scale steps of the motif's first statement, when the motif repeats. */
  private motifShape(planner: PitchPlanner, onsets: MelodyOnset[], pitches: number[]): MotifShape | null {
    if (!onsets.some((onset) => onset.instance > 0)) return null;
    const first = pitches.filter((_, index) => onsets[index]?.instance === 0);
    return first.length > 1 ? { steps: planner.stepsOf(first) } : null;
  }

}

/** Writes melody notes for a plan over chords, inside a pitch range, optionally setting a lyric line. */
export function writeMelody(plan: MelodyPlan, chords: ChordEvent[], range: PitchRange, lyric?: LineAnalysis): Note[] {
  return new MelodyWriter(plan, chords, range).write(lyric);
}
