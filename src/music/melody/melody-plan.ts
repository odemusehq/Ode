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
  /** Quarter-note beats per bar (4 in 4/4, 3 in 3/4). */
  beatsPerBar: number;
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
