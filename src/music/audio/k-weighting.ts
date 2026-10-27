import { Biquad } from "./biquad";
import type { BiquadCoefficients } from "./biquad";

/**
 * Analog prototype of the BS.1770 pre-filter (a high shelf modelling the head). These values,
 * bilinear-transformed at 48 kHz, reproduce the coefficients printed in ITU-R BS.1770-4 (as in libebur128),
 * so the same filter can be built for any sample rate.
 */
const SHELF = {
  frequency: 1681.974450955533,
  gainDb: 3.999843853973347,
  q: 0.7071752369554196,
  /** Exponent giving the gain at the shelf's midpoint from its high-frequency gain. */
  midGainExponent: 0.4996667741545416,
};

/** Analog prototype of the BS.1770 RLB weighting (a second-order high-pass). */
const HIGH_PASS = {
  frequency: 38.13547087602444,
  q: 0.5003270373238773,
};

/** BS.1770 stage 1: high-shelf pre-filter, for the given sample rate. */
export function shelfCoefficients(sampleRate: number): BiquadCoefficients {
  const k = Math.tan((Math.PI * SHELF.frequency) / sampleRate);
  const highGain = 10 ** (SHELF.gainDb / 20);
  const midGain = highGain ** SHELF.midGainExponent;
  const a0 = 1 + k / SHELF.q + k * k;
  return {
    b0: (highGain + (midGain * k) / SHELF.q + k * k) / a0,
    b1: (2 * (k * k - highGain)) / a0,
    b2: (highGain - (midGain * k) / SHELF.q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / SHELF.q + k * k) / a0,
  };
}

/** BS.1770 stage 2: RLB high-pass (numerator 1, −2, 1 as in the standard), for the given sample rate. */
export function highPassCoefficients(sampleRate: number): BiquadCoefficients {
  const k = Math.tan((Math.PI * HIGH_PASS.frequency) / sampleRate);
  const a0 = 1 + k / HIGH_PASS.q + k * k;
  return {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / HIGH_PASS.q + k * k) / a0,
  };
}

/** K-weighting for one channel (ITU-R BS.1770-4): the pre-filter followed by the RLB high-pass. */
export class KWeightingFilter {
  private readonly shelf: Biquad;
  private readonly highPass: Biquad;

  constructor(sampleRate: number) {
    this.shelf = new Biquad(shelfCoefficients(sampleRate));
    this.highPass = new Biquad(highPassCoefficients(sampleRate));
  }

  /** Sum of the squared K-weighted samples in [start, end); the filter state carries over between calls. */
  sumOfSquares(samples: Float32Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) {
      const weighted = this.highPass.process(this.shelf.process(samples[i]!));
      sum += weighted * weighted;
    }
    return sum;
  }
}
