import type { TimeSignature } from "../../shared/live-ops";
import type { KeySpec } from "../harmony/musical-key";

export enum Contour {
  Rising = "rising",
  Falling = "falling",
  Arch = "arch",
  Valley = "valley",
  Wave = "wave",
  Static = "static",
}

export enum Register {
  Low = "low",
  Mid = "mid",
  High = "high",
}

export enum MelodyVariation {
  Rhythm = "rhythm",
  Contour = "contour",
  Ending = "ending",
  Ornament = "ornament",
}

/** What the model describes in words; the code writes the notes. */
export interface MelodyPlan {
  bars: number;
  /** Explicit length permits unequal and sub-bar lyric phrases. */
  lengthBeats?: number;
  /** Where local beat zero falls in the meter (e.g. 3.5 for a pickup before beat 4). */
  beatOffset?: number;
  /** The meter, so 6/8 keeps its two dotted-quarter beats (3/4 has three quarter-note beats). */
  signature: TimeSignature;
  contour: Contour;
  /** Where in the singer's range the melody sits; a chorus usually sits higher than its verse. */
  register: Register;
  /** Notes per beat, 0.5–4. */
  density: number;
  /** Length of the motif that is repeated and varied, in bars. */
  motifBars?: number;
  /** Same seed, same melody. */
  seed?: number;
  /** The song's key; found from the chords when missing. */
  key?: KeySpec;
}

export const MIN_DENSITY = 0.5;
export const MAX_DENSITY = 4;
export const DEFAULT_SEED = 1;
