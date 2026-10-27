import type { StepPattern } from "../step-pattern";

export enum FillStyle {
  Toms = "toms",
  SnareRoll = "snare roll",
  HatRoll = "hat roll",
  Percussion = "percussion",
  KickDrop = "kick drop",
}

/** A genre's drum groove at different intensities, with its feel and fill. */
export interface GrooveDefinition {
  /** Fewest elements: intros, quiet verses. */
  sparse: StepPattern;
  /** The core groove. */
  main: StepPattern;
  /** Choruses and drops. */
  full: StepPattern;
  /** Snare on beat 3: bridges. */
  halfTime: StepPattern;
  /** Added every second bar of the main and full grooves for movement. */
  turnaround?: StepPattern;
  /** 0 straight to 1 full triplet swing of the off-beat sixteenths. */
  swing: number;
  fill: FillStyle;
  /** Electronic grooves keep timing tight (less human timing variation). */
  tight: boolean;
}
