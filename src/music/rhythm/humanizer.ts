import type { SeededRandom } from "./random";
import { STEP_BEATS } from "./step-pattern";

/** Full triplet swing moves an off-beat sixteenth a third of a sixteenth later (1/12 of a beat). */
const FULL_SWING_DELAY = 1 / 12;
/** Human timing variation, in beats (about 6 ms at 120 BPM), and how much tighter electronic grooves are. */
const TIMING_VARIATION = 0.012;
const TIGHT_FACTOR = 0.3;
const VELOCITY_VARIATION = 7;
const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;
const STEP_TOLERANCE = 1e-6;

/** Swing and small, seeded variations of timing and velocity so programmed parts feel played. */
export class Humanizer {
  constructor(
    private readonly random: SeededRandom,
    private readonly swing: number,
    private readonly tight: boolean,
  ) {}

  /** Start time with swing on off-beat sixteenths and a little timing variation (never before 0). */
  time(start: number): number {
    const step = start / STEP_BEATS;
    const offBeatSixteenth = Math.abs(step - Math.round(step)) < STEP_TOLERANCE && Math.round(step) % 2 === 1;
    const swung = offBeatSixteenth ? start + this.swing * FULL_SWING_DELAY : start;
    const variation = this.random.jitter(TIMING_VARIATION * (this.tight ? TIGHT_FACTOR : 1));
    return Math.max(0, swung + variation);
  }

  velocity(base: number): number {
    const varied = base + this.random.jitter(VELOCITY_VARIATION * (this.tight ? TIGHT_FACTOR : 1));
    return Math.round(Math.min(MAX_VELOCITY, Math.max(MIN_VELOCITY, varied)));
  }
}
