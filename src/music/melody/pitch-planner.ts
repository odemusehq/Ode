import type { ChordTimeline } from "../harmony/chord-timeline";
import type { MusicalKey } from "../harmony/musical-key";
import type { PitchRange } from "../harmony/pitch-range";
import { Stress } from "../phonetics/pronunciation";
import { METRICAL_WEIGHT, type Meter } from "../prosody/meter";
import type { SeededRandom } from "../rhythm/random";
import { contourAt } from "./contour";
import type { Contour } from "./melody-plan";
import type { MelodyOnset } from "./melody-rhythm";

export interface PitchContext {
  key: MusicalKey;
  range: PitchRange;
  chords: ChordTimeline;
  meter: Meter;
  random: SeededRandom;
  contour: Contour;
  /** Middle of the melody's register and how far the contour moves from it, in semitones. */
  centre: number;
  span: number;
  totalBeats: number;
}

export interface MotifShape {
  /** Scale steps between consecutive notes of the motif's first statement. */
  steps: number[];
}

/** For each note: the scale step the motif asks for from the previous note, and how strongly. */
interface MotifGuide {
  step: number | undefined;
  weight: number;
}

/** Interval costs: steps are free, repeated notes cheap, leaps dearer the wider they are. */
const STEP = 2;
const THIRD = 4;
const FIFTH = 7;
const SIXTH = 9;
const OCTAVE = 12;
const REPEAT_COST = 0.15;
const THIRD_COST = 0.35;
const FOURTH_FIFTH_COST = 0.9;
const SIXTH_COST = 1.6;
const OCTAVE_COST = 1.8;
const WIDE_LEAP_COST = 2.5;
/** A leap of a fourth or more should be followed by a step back the other way. */
const LEAP = 5;
const UNRECOVERED_LEAP_COST = 1.2;
const TARGET_WEIGHT = 1;
/** Notes on beats, long notes and stressed syllables want chord tones. */
const STRONG_NON_CHORD_COST = 1.2;
const WEAK_NON_CHORD_COST = 0.25;
const LONG_NOTE_BEATS = 1;
const FINAL_TONIC_BONUS = 0.5;
const FINAL_NON_CHORD_COST = 1.5;
const MOTIF_STEP_COST = 0.45;
/** The last notes of a varied motif statement follow the motif less closely. */
const VARIED_ENDING_FACTOR = 0.2;
const VARIED_ENDING_NOTES = 2;
const RANDOM_WEIGHT = 0.3;

/**
 * Chooses pitches for a rhythm by second-order Viterbi search over scale tones in the range: follows
 * the contour, puts chord tones on strong beats, moves mostly by step, recovers leaps with a step back
 * and repeats the motif's shape in later bars with a varied ending.
 */
export class PitchPlanner {
  private readonly pitches: number[];

  constructor(private readonly context: PitchContext) {
    this.pitches = context.key.pitchesBetween(context.range.low, context.range.high);
    if (this.pitches.length === 0) throw new RangeError("The requested range contains no pitch in the chosen scale; change the range or key explicitly.");
  }

  plan(onsets: MelodyOnset[], motif: MotifShape | null): number[] {
    const count = onsets.length;
    const options = this.pitches.length;
    if (count === 0 || options === 0) return onsets.map(() => Math.round(this.context.centre));
    const unary = onsets.map((onset, index) => this.pitches.map((pitch) => this.unaryCost(onset, pitch, index === count - 1)));
    if (count === 1) return [this.pitches[this.argmin(unary[0] ?? [])] ?? this.pitches[0] ?? 0];
    const guides = this.motifGuides(onsets, motif);
    let costs = this.firstPairs(unary, guides);
    const back: number[][] = [];
    for (let index = 2; index < count; index++) {
      const next = new Array<number>(options * options).fill(Number.POSITIVE_INFINITY);
      const choice = new Array<number>(options * options).fill(0);
      for (let middle = 0; middle < options; middle++) {
        for (let last = 0; last < options; last++) {
          const step = this.pairCost(guides[index], middle, last) + (unary[index]?.[last] ?? 0);
          for (let first = 0; first < options; first++) {
            const total = (costs[first * options + middle] ?? Number.POSITIVE_INFINITY) + step + this.leapCost(first, middle, last);
            if (total < (next[middle * options + last] ?? Number.POSITIVE_INFINITY)) {
              next[middle * options + last] = total;
              choice[middle * options + last] = first;
            }
          }
        }
      }
      back.push(choice);
      costs = next;
    }
    return this.backtrack(costs, back, count).map((index) => this.pitches[index] ?? this.pitches[0] ?? 0);
  }

  /** Scale steps between consecutive pitches (as positions among the scale tones in range). */
  stepsOf(pitches: number[]): number[] {
    const indexes = pitches.map((pitch) => this.pitches.indexOf(pitch));
    return indexes.slice(1).map((index, position) => index - (indexes[position] ?? index));
  }

  private firstPairs(unary: number[][], guides: MotifGuide[]): number[] {
    const options = this.pitches.length;
    const costs = new Array<number>(options * options).fill(Number.POSITIVE_INFINITY);
    for (let first = 0; first < options; first++) {
      for (let second = 0; second < options; second++) {
        costs[first * options + second] = (unary[0]?.[first] ?? 0) + (unary[1]?.[second] ?? 0) + this.pairCost(guides[1], first, second);
      }
    }
    return costs;
  }

  /** Later statements of the motif follow its steps; the last notes of varied statements (odd and final ones) less so. */
  private motifGuides(onsets: MelodyOnset[], motif: MotifShape | null): MotifGuide[] {
    const lastInstance = onsets.at(-1)?.instance ?? 0;
    return onsets.map((onset, index) => {
      if (!motif || onset.instance === 0 || onset.motifIndex === 0) return { step: undefined, weight: 0 };
      const remaining = onsets.slice(index + 1).filter((other) => other.instance === onset.instance).length;
      const varied = onset.instance === lastInstance || onset.instance % 2 === 1;
      const factor = varied && remaining < VARIED_ENDING_NOTES ? VARIED_ENDING_FACTOR : 1;
      return { step: motif.steps[onset.motifIndex - 1], weight: factor * MOTIF_STEP_COST };
    });
  }

  private backtrack(costs: number[], back: number[][], count: number): number[] {
    const options = this.pitches.length;
    const best = this.argmin(costs);
    const path = new Array<number>(count).fill(0);
    path[count - 1] = best % options;
    path[count - 2] = Math.floor(best / options);
    for (let index = count - 1; index >= 2; index--) {
      const middle = path[index - 1] ?? 0;
      const last = path[index] ?? 0;
      path[index - 2] = back[index - 2]?.[middle * options + last] ?? 0;
    }
    return path;
  }

  private argmin(values: number[]): number {
    let best = 0;
    values.forEach((value, index) => {
      if (value < (values[best] ?? Number.POSITIVE_INFINITY)) best = index;
    });
    return best;
  }

  private unaryCost(onset: MelodyOnset, pitch: number, final: boolean): number {
    const { centre, span, totalBeats, contour, meter, random, chords, key } = this.context;
    const target = centre + contourAt(contour, onset.start / Math.max(1, totalBeats)) * span;
    let cost = TARGET_WEIGHT * ((pitch - target) / Math.max(1, span)) ** 2 + RANDOM_WEIGHT * random.next();
    const chord = chords.at(onset.start);
    const chordTone = chord ? chord.contains(pitch) : true;
    if (final) {
      if (pitch % OCTAVE === key.root) cost -= FINAL_TONIC_BONUS;
      return chordTone ? cost : cost + FINAL_NON_CHORD_COST;
    }
    const strong =
      meter.weightAt(onset.start) >= METRICAL_WEIGHT.beat ||
      onset.duration >= LONG_NOTE_BEATS ||
      (onset.stress !== null && onset.stress !== Stress.None);
    if (!chordTone) cost += strong ? STRONG_NON_CHORD_COST : WEAK_NON_CHORD_COST;
    return cost;
  }

  private pairCost(guide: MotifGuide | undefined, previous: number, current: number): number {
    const from = this.pitches[previous] ?? 0;
    const to = this.pitches[current] ?? 0;
    const cost = this.intervalCost(Math.abs(to - from));
    if (!guide || guide.step === undefined) return cost;
    return cost + guide.weight * Math.abs(current - previous - guide.step);
  }

  private intervalCost(semitones: number): number {
    if (semitones === 0) return REPEAT_COST;
    if (semitones <= STEP) return 0;
    if (semitones <= THIRD) return THIRD_COST;
    if (semitones <= FIFTH) return FOURTH_FIFTH_COST;
    if (semitones <= SIXTH) return SIXTH_COST;
    if (semitones === OCTAVE) return OCTAVE_COST;
    return WIDE_LEAP_COST;
  }

  /** After a leap, the next interval should be a step in the opposite direction. */
  private leapCost(first: number, middle: number, last: number): number {
    const a = this.pitches[first] ?? 0;
    const b = this.pitches[middle] ?? 0;
    const c = this.pitches[last] ?? 0;
    const leap = b - a;
    if (Math.abs(leap) < LEAP) return 0;
    const recovery = c - b;
    return Math.sign(recovery) === -Math.sign(leap) && Math.abs(recovery) <= STEP ? 0 : UNRECOVERED_LEAP_COST;
  }
}
