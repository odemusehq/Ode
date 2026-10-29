const CENTS_PER_SEMITONE = 100;
/** Half-width of the circular smoothing applied to the cents histogram, cents. */
const SMOOTHING_CENTS = 10;

export interface WeightedPitch {
  /** Fractional MIDI note number. */
  midi: number;
  weight: number;
}

/**
 * Global tuning offset in cents (−50…50): how far a singer's pitch sits from equal temperament at
 * A4 = 440 Hz. Each pitch's distance from its nearest semitone goes into a one-cent circular histogram,
 * which is smoothed; the offset is the peak, refined by parabolic interpolation. Subtract offset / 100
 * from MIDI numbers to correct them.
 */
export function tuningOffset(pitches: readonly WeightedPitch[]): number {
  const histogram = new Float64Array(CENTS_PER_SEMITONE);
  for (const { midi, weight } of pitches) {
    if (!Number.isFinite(midi) || !(weight > 0)) continue;
    const cents = Math.round((midi - Math.round(midi)) * CENTS_PER_SEMITONE);
    histogram[wrap(cents)] = histogram[wrap(cents)]! + weight;
  }

  const smoothed = new Float64Array(CENTS_PER_SEMITONE);
  for (let bin = 0; bin < CENTS_PER_SEMITONE; bin++) {
    let sum = 0;
    for (let offset = -SMOOTHING_CENTS; offset <= SMOOTHING_CENTS; offset++) sum += histogram[wrap(bin + offset)]! * (SMOOTHING_CENTS + 1 - Math.abs(offset));
    smoothed[bin] = sum;
  }

  let peak = 0;
  for (let bin = 1; bin < CENTS_PER_SEMITONE; bin++) if (smoothed[bin]! > smoothed[peak]!) peak = bin;
  if (smoothed[peak]! <= 0) return 0;

  const before = smoothed[wrap(peak - 1)]!;
  const middle = smoothed[peak]!;
  const after = smoothed[wrap(peak + 1)]!;
  const curvature = before - 2 * middle + after;
  const refinement = curvature < 0 ? (0.5 * (before - after)) / curvature : 0;
  const cents = peak + refinement;
  return cents >= CENTS_PER_SEMITONE / 2 ? cents - CENTS_PER_SEMITONE : cents;
}

/** Histogram bin of a cents value, wrapping around the semitone. */
function wrap(cents: number): number {
  return ((cents % CENTS_PER_SEMITONE) + CENTS_PER_SEMITONE) % CENTS_PER_SEMITONE;
}
