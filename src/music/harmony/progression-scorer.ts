import { ChordFunction, type ChordCandidate } from "./chord-vocabulary";
import type { StyleProfile } from "./harmony-style";

/** A melody pitch class sounding during a chord slot, weighted by length and metrical position. */
export interface SlotNote {
  pitchClass: number;
  weight: number;
}

const PITCH_CLASSES = 12;
/** Melody fit: chord tones are free; tensions cost by style; a half step above a chord tone clashes. */
const NON_CHORD_TONE_COST = 0.7;
const CLASH_COST = 1;
const MELODY_FIT_WEIGHT = 2;
/** Intervals above the root heard as tensions: 9th and 13th; 11th only over minor chords. */
const NINTH = 2;
const ELEVENTH = 5;
const THIRTEENTH = 9;
const FAVOURED_BONUS = 0.3;

const REPEAT_COST = 0.4;
/** Root movement in semitones up, and its cost: down a fifth (up a fourth) is the strongest progression. */
const ROOT_MOTION_COST: ReadonlyMap<number, number> = new Map([
  [5, -0.3],
  [7, 0.05],
  [2, 0],
  [10, 0.05],
  [9, 0],
  [8, 0.05],
  [3, 0.1],
  [4, 0.1],
  [1, 0.3],
  [11, 0.2],
  [6, 0.5],
]);
const SECONDARY_RESOLVES = -0.4;
const SECONDARY_UNRESOLVED = 0.8;
const FUNCTION_STAYS = 0.1;
const TONIC_TO_DOMINANT = 0.1;
const PLAGAL_RETURN = 0.15;
const DOMINANT_RESOLVES = -0.2;

const START_ON_TONIC = -0.2;
const FINAL_TONIC = -0.5;
const FINAL_NOT_TONIC = 1;
const AUTHENTIC_CADENCE = -0.3;
const PLAGAL_CADENCE = -0.15;
const HALF_CADENCE = -0.2;

function modulo(value: number): number {
  return ((value % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

/**
 * Scores chords for a progression (lower is better): fit with the melody, normal chord movement,
 * cadences at phrase ends, variety, the style's chord families and the artist's favoured chords.
 */
export class ProgressionScorer {
  constructor(
    private readonly profile: StyleProfile,
    private readonly favoured: ReadonlySet<string>,
  ) {}

  emission(candidate: ChordCandidate, notes: SlotNote[]): number {
    let cost = 0;
    let weight = 0;
    for (const note of notes) {
      weight += note.weight;
      cost += note.weight * this.noteCost(candidate, note.pitchClass);
    }
    const fit = weight > 0 ? cost / weight : 0;
    const favoured = this.favoured.has(candidate.roman) || this.favoured.has(candidate.symbol) ? FAVOURED_BONUS : 0;
    return MELODY_FIT_WEIGHT * fit + this.profile.familyCost[candidate.family] - favoured;
  }

  transition(previous: ChordCandidate, next: ChordCandidate): number {
    if (previous.symbol === next.symbol) return REPEAT_COST;
    let cost = ROOT_MOTION_COST.get(modulo(next.chord.root - previous.chord.root)) ?? 0;
    cost += this.functionCost(previous.function, next.function);
    if (previous.resolvesTo !== null) cost += next.chord.root === previous.resolvesTo ? SECONDARY_RESOLVES : SECONDARY_UNRESOLVED;
    return cost;
  }

  start(candidate: ChordCandidate): number {
    return candidate.function === ChordFunction.Tonic ? START_ON_TONIC : 0;
  }

  /** Cadence at the end of a phrase; the final phrase should close on the tonic. */
  cadence(previous: ChordCandidate | null, candidate: ChordCandidate, final: boolean): number {
    const fromDominant = previous?.function === ChordFunction.Dominant && previous.resolvesTo === null;
    if (final) {
      if (!candidate.tonic) return FINAL_NOT_TONIC;
      if (fromDominant) return FINAL_TONIC + AUTHENTIC_CADENCE;
      return previous?.function === ChordFunction.Predominant ? FINAL_TONIC + PLAGAL_CADENCE : FINAL_TONIC;
    }
    if (candidate.function === ChordFunction.Dominant && candidate.resolvesTo === null) return HALF_CADENCE;
    return candidate.tonic && fromDominant ? AUTHENTIC_CADENCE / 2 : 0;
  }

  private noteCost(candidate: ChordCandidate, pitchClass: number): number {
    if (candidate.chord.contains(pitchClass)) return 0;
    if (candidate.chord.contains(pitchClass - 1)) return CLASH_COST;
    const interval = candidate.chord.intervalFromRoot(pitchClass);
    const tension = interval === NINTH || interval === THIRTEENTH || (interval === ELEVENTH && candidate.chord.minor);
    return tension ? this.profile.tensionCost : NON_CHORD_TONE_COST;
  }

  private functionCost(from: ChordFunction, to: ChordFunction): number {
    if (from === to) return FUNCTION_STAYS;
    if (from === ChordFunction.Dominant) return to === ChordFunction.Tonic ? DOMINANT_RESOLVES : this.profile.retrogressionCost;
    if (from === ChordFunction.Tonic) return to === ChordFunction.Dominant ? TONIC_TO_DOMINANT : 0;
    return to === ChordFunction.Tonic ? PLAGAL_RETURN : 0;
  }
}
