/**
 * Metrical weight of a position in the bar, following the usual accent hierarchy: in 4/4, beat 1 = 1.0,
 * beat 3 = 0.75, beats 2 and 4 = 0.5, eighth-note off-beats = 0.25, sixteenths = 0.1. Compound meters
 * (6/8, 9/8, 12/8) use dotted-quarter beats divided in three.
 */
export const METRICAL_WEIGHT = {
  downbeat: 1,
  middleBeat: 0.75,
  beat: 0.5,
  division: 0.25,
  subdivision: 0.1,
  finer: 0.05,
} as const;

/** 4/4, the default time signature. */
export const COMMON_TIME = { numerator: 4, denominator: 4 } as const;
/** Live measures time in quarter-note beats. */
const QUARTERS_PER_WHOLE = 4;
/** Compound meters have an eighth-note beat unit (6/8, 9/8, 12/8). */
const EIGHTH_NOTE_UNIT = 8;
const COMPOUND_DIVISION = 3;
const SIMPLE_DIVISION = 2;
const POSITION_TOLERANCE = 1e-3;
const SMALLEST_BAR_WITH_MIDDLE_BEAT = 4;

function isMultipleOf(value: number, unit: number): boolean {
  const ratio = value / unit;
  return Math.abs(ratio - Math.round(ratio)) < POSITION_TOLERANCE * 10;
}

export class Meter {
  /** Bar length in quarter-note beats. */
  readonly barLength: number;
  /** Felt beats per bar (2 in 6/8, 4 in 12/8). */
  readonly beatsInBar: number;
  /** Length of one felt beat in quarter-note beats. */
  readonly beatLength: number;
  readonly compound: boolean;

  constructor(
    readonly numerator: number = COMMON_TIME.numerator,
    readonly denominator: number = COMMON_TIME.denominator,
  ) {
    this.compound = denominator === EIGHTH_NOTE_UNIT && numerator > COMPOUND_DIVISION && numerator % COMPOUND_DIVISION === 0;
    this.barLength = (numerator * QUARTERS_PER_WHOLE) / denominator;
    this.beatsInBar = this.compound ? numerator / COMPOUND_DIVISION : numerator;
    this.beatLength = this.barLength / this.beatsInBar;
  }

  /** Weight of a position given in quarter-note beats from the start of a bar line. */
  weightAt(position: number): number {
    const inBar = ((position % this.barLength) + this.barLength) % this.barLength;
    const beat = Math.floor((inBar + POSITION_TOLERANCE) / this.beatLength);
    const offset = inBar - beat * this.beatLength;
    if (Math.abs(offset) < POSITION_TOLERANCE) return this.beatWeight(beat % this.beatsInBar);
    const fraction = offset / this.beatLength;
    const division = this.compound ? COMPOUND_DIVISION : SIMPLE_DIVISION;
    if (isMultipleOf(fraction, 1 / division)) return METRICAL_WEIGHT.division;
    if (isMultipleOf(fraction, 1 / (division * 2))) return METRICAL_WEIGHT.subdivision;
    return METRICAL_WEIGHT.finer;
  }

  beatWeight(beat: number): number {
    if (beat === 0) return METRICAL_WEIGHT.downbeat;
    const even = this.beatsInBar % 2 === 0 && this.beatsInBar >= SMALLEST_BAR_WITH_MIDDLE_BEAT;
    return even && beat === this.beatsInBar / 2 ? METRICAL_WEIGHT.middleBeat : METRICAL_WEIGHT.beat;
  }

  /** Whether a position falls on a beat. */
  isOnBeat(position: number): boolean {
    return this.weightAt(position) >= METRICAL_WEIGHT.beat;
  }
}
