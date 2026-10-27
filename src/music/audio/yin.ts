import FFT from "fft.js";

export interface YinEstimate {
  /** Period in samples, refined between lags by parabolic interpolation. */
  period: number;
  /** Cumulative mean normalised difference at the chosen lag: 0 for a perfectly periodic frame. */
  aperiodicity: number;
  /** True when the chosen dip fell below the threshold. */
  belowThreshold: boolean;
}

/**
 * YIN period estimator (de Cheveigné and Kawahara, 2002) for one frame at a time: difference function
 * (computed through FFT cross-correlation), cumulative mean normalisation, absolute threshold with
 * descent to the local minimum, and parabolic interpolation.
 */
export class YinEstimator {
  private readonly fft: FFT;
  private readonly size: number;
  private readonly frame: Float64Array;
  private readonly extended: Float64Array;
  private readonly frameSpectrum: number[];
  private readonly extendedSpectrum: number[];
  private readonly product: number[];
  private readonly correlation: number[];
  private readonly normalised: Float64Array;

  /**
   * @param windowLength integration window, samples
   * @param minLag shortest period searched, samples (at least 2)
   * @param maxLag longest period searched, samples
   * @param threshold absolute threshold on the cumulative mean normalised difference
   */
  constructor(
    private readonly windowLength: number,
    private readonly minLag: number,
    private readonly maxLag: number,
    private readonly threshold: number,
  ) {
    this.size = 2 ** Math.ceil(Math.log2(this.span));
    this.fft = new FFT(this.size);
    this.frame = new Float64Array(this.size);
    this.extended = new Float64Array(this.size);
    this.frameSpectrum = this.fft.createComplexArray();
    this.extendedSpectrum = this.fft.createComplexArray();
    this.product = this.fft.createComplexArray();
    this.correlation = this.fft.createComplexArray();
    this.normalised = new Float64Array(maxLag + 2);
  }

  /** Samples a frame reads from its start: the window plus the longest lag and one more for interpolation. */
  get span(): number {
    return this.windowLength + this.maxLag + 1;
  }

  /** Estimates the period of signal[start … start + span); the caller keeps that range inside the signal. */
  estimate(signal: Float32Array, start: number): YinEstimate {
    this.normalisedDifference(signal, start);
    const curve = this.normalised;

    let lag = -1;
    for (let candidate = this.minLag; candidate <= this.maxLag; candidate++) {
      if (curve[candidate]! < this.threshold) {
        while (candidate + 1 <= this.maxLag && curve[candidate + 1]! < curve[candidate]!) candidate++;
        lag = candidate;
        break;
      }
    }
    const belowThreshold = lag >= 0;
    if (!belowThreshold) {
      lag = this.minLag;
      for (let candidate = this.minLag + 1; candidate <= this.maxLag; candidate++) {
        if (curve[candidate]! < curve[lag]!) lag = candidate;
      }
    }
    const offset = parabolicOffset(curve[lag - 1]!, curve[lag]!, curve[lag + 1]!);
    return { period: lag + offset, aperiodicity: curve[lag]!, belowThreshold };
  }

  /** Fills the cumulative mean normalised difference d'(τ) for τ = 0 … maxLag + 1. */
  private normalisedDifference(signal: Float32Array, start: number): void {
    const window = this.windowLength;
    const lags = this.maxLag + 1;
    this.frame.fill(0);
    this.extended.fill(0);
    for (let j = 0; j < window; j++) this.frame[j] = signal[start + j]!;
    for (let j = 0; j < window + lags; j++) this.extended[j] = signal[start + j]!;

    this.fft.realTransform(this.frameSpectrum, this.frame);
    this.fft.realTransform(this.extendedSpectrum, this.extended);
    const a = this.frameSpectrum;
    const b = this.extendedSpectrum;
    for (let k = 0; k <= this.size / 2; k++) {
      const ar = a[2 * k] as number;
      const ai = a[2 * k + 1] as number;
      const br = b[2 * k] as number;
      const bi = b[2 * k + 1] as number;
      this.product[2 * k] = ar * br + ai * bi;
      this.product[2 * k + 1] = ar * bi - ai * br;
    }
    this.fft.completeSpectrum(this.product);
    this.fft.inverseTransform(this.correlation, this.product);

    let frameEnergy = 0;
    for (let j = 0; j < window; j++) frameEnergy += this.frame[j]! * this.frame[j]!;
    let shiftedEnergy = frameEnergy;
    let runningSum = 0;
    this.normalised[0] = 1;
    for (let lag = 1; lag <= lags; lag++) {
      const leaving = this.extended[lag - 1]!;
      const entering = this.extended[lag + window - 1]!;
      shiftedEnergy += entering * entering - leaving * leaving;
      const difference = Math.max(0, frameEnergy + shiftedEnergy - 2 * (this.correlation[2 * lag] as number));
      runningSum += difference;
      this.normalised[lag] = runningSum > 0 ? (difference * lag) / runningSum : 1;
    }
  }
}

/** Offset of the vertex of the parabola through three equally spaced points, from the middle one (within ±0.5). */
function parabolicOffset(before: number, middle: number, after: number): number {
  const curvature = before - 2 * middle + after;
  if (curvature <= 0) return 0;
  return Math.max(-0.5, Math.min(0.5, (0.5 * (before - after)) / curvature));
}
