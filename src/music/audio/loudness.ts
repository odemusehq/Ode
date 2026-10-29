import { KWeightingFilter } from "./k-weighting";
import { loudnessRange } from "./loudness-range";
import type { AudioData } from "./types";

/** ITU-R BS.1770-4: offset so that a 0 dBFS 1 kHz sine in one front channel reads −3.01 LUFS. */
const LOUDNESS_OFFSET_DB = -0.691;
/** ITU-R BS.1770-4 absolute gate, LUFS. */
const ABSOLUTE_GATE_LUFS = -70;
/** ITU-R BS.1770-4 relative gate, LU below the absolute-gated loudness. */
const RELATIVE_GATE_LU = -10;
/** Gating block and momentary loudness window (BS.1770-4, EBU Tech 3341), seconds. */
const MOMENTARY_SECONDS = 0.4;
/** Short-term loudness window (EBU Tech 3341), seconds. */
const SHORT_TERM_SECONDS = 3;
/** Step between blocks: 75 % overlap of the 400 ms gating blocks, seconds. */
const STEP_SECONDS = 0.1;
/** BS.1770-4 channel weight for the left and right surround channels. */
const SURROUND_WEIGHT = 1.41;

const MOMENTARY_STEPS = Math.round(MOMENTARY_SECONDS / STEP_SECONDS);
const SHORT_TERM_STEPS = Math.round(SHORT_TERM_SECONDS / STEP_SECONDS);

export interface LoudnessReading {
  /** Integrated loudness, LUFS; −Infinity when the gates remove every block. */
  integrated: number;
  /** Highest momentary loudness (400 ms window), LUFS. */
  momentaryMax: number;
  /** Highest short-term loudness (3 s window), LUFS. */
  shortTermMax: number;
  /** Loudness range (EBU Tech 3342), LU. */
  range: number;
}

/** Loudness in LUFS of a channel-weighted mean square. */
function toLufs(meanSquare: number): number {
  return LOUDNESS_OFFSET_DB + 10 * Math.log10(meanSquare);
}

/**
 * BS.1770-4 channel weights by channel count: mono and stereo channels weigh 1 (mono stays at 1, without a +3 dB lift);
 * four channels are L, R, Ls, Rs; five are L, R, C, Ls, Rs; six are L, R, C, LFE (left out), Ls, Rs.
 */
function channelWeights(channelCount: number): number[] {
  if (channelCount === 4) return [1, 1, SURROUND_WEIGHT, SURROUND_WEIGHT];
  if (channelCount === 5) return [1, 1, 1, SURROUND_WEIGHT, SURROUND_WEIGHT];
  if (channelCount >= 6) {
    return Array.from({ length: channelCount }, (_, index) =>
      index === 3 || index > 5 ? 0 : index > 3 ? SURROUND_WEIGHT : 1,
    );
  }
  return Array.from({ length: channelCount }, () => 1);
}

/**
 * Loudness meter per ITU-R BS.1770-4 and EBU R128: K-weighting, 400 ms blocks every 100 ms,
 * absolute and relative gating for integrated loudness, momentary and short-term maxima, and loudness range.
 * Feed it audio with push(), as often as needed, then read the results.
 */
export class LoudnessMeter {
  private readonly filters: KWeightingFilter[];
  private readonly weights: number[];
  private readonly stepLength: number;
  /** Channel-weighted sum of squared K-weighted samples for each complete 100 ms step. */
  private readonly stepEnergies: number[] = [];
  private pendingEnergy = 0;
  private pendingLength = 0;

  constructor(sampleRate: number, channelCount: number) {
    this.stepLength = Math.max(1, Math.round(sampleRate * STEP_SECONDS));
    this.weights = channelWeights(channelCount);
    this.filters = this.weights.map(() => new KWeightingFilter(sampleRate));
  }

  /** Adds the next run of samples; every channel holds the same number of samples. */
  push(channels: readonly Float32Array[]): void {
    const length = channels[0]?.length ?? 0;
    let position = 0;
    while (position < length) {
      const take = Math.min(this.stepLength - this.pendingLength, length - position);
      for (let channel = 0; channel < channels.length; channel++) {
        const samples = channels[channel];
        const filter = this.filters[channel];
        const weight = this.weights[channel] ?? 0;
        if (samples && filter && weight > 0) this.pendingEnergy += weight * filter.sumOfSquares(samples, position, position + take);
      }
      this.pendingLength += take;
      position += take;
      if (this.pendingLength === this.stepLength) {
        this.stepEnergies.push(this.pendingEnergy);
        this.pendingEnergy = 0;
        this.pendingLength = 0;
      }
    }
  }

  reading(): LoudnessReading {
    const momentary = this.windowMeanSquares(MOMENTARY_STEPS);
    const shortTerm = this.windowMeanSquares(SHORT_TERM_STEPS);
    const completeShortTerm = Array.from(shortTerm.subarray(SHORT_TERM_STEPS - 1), toLufs);
    return {
      integrated: this.integrated(momentary.subarray(MOMENTARY_STEPS - 1)),
      momentaryMax: toLufs(maximum(momentary)),
      shortTermMax: toLufs(maximum(shortTerm)),
      range: loudnessRange(completeShortTerm),
    };
  }

  /**
   * Mean square of the window ending at each 100 ms step. Windows that would start before the audio
   * count the missing time as silence, as a meter does when playback starts; entries from index
   * steps − 1 on are complete windows.
   */
  private windowMeanSquares(steps: number): Float64Array {
    const energies = this.stepEnergies;
    const result = new Float64Array(energies.length);
    const windowLength = steps * this.stepLength;
    for (let k = 0; k < energies.length; k++) {
      let sum = 0;
      for (let j = Math.max(0, k - steps + 1); j <= k; j++) sum += energies[j]!;
      result[k] = sum / windowLength;
    }
    return result;
  }

  /** Gated integrated loudness from the mean squares of complete 400 ms blocks. */
  private integrated(blocks: Float64Array): number {
    let sum = 0;
    let count = 0;
    for (const meanSquare of blocks) {
      if (toLufs(meanSquare) > ABSOLUTE_GATE_LUFS) {
        sum += meanSquare;
        count++;
      }
    }
    if (count === 0) return -Infinity;

    const relativeGate = toLufs(sum / count) + RELATIVE_GATE_LU;
    let gatedSum = 0;
    let gatedCount = 0;
    for (const meanSquare of blocks) {
      const loudness = toLufs(meanSquare);
      if (loudness > ABSOLUTE_GATE_LUFS && loudness > relativeGate) {
        gatedSum += meanSquare;
        gatedCount++;
      }
    }
    return gatedCount === 0 ? -Infinity : toLufs(gatedSum / gatedCount);
  }
}

function maximum(values: Float64Array): number {
  let result = 0;
  for (const value of values) if (value > result) result = value;
  return result;
}

/** Integrated, momentary maximum, short-term maximum and range of a whole recording. */
export function loudness(audio: AudioData): LoudnessReading {
  const meter = new LoudnessMeter(audio.sampleRate, audio.channels.length);
  meter.push(audio.channels);
  return meter.reading();
}
