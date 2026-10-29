import { amplitudeToDb } from "./units";
import { kaiser, sinc } from "./window";
import type { AudioData } from "./types";

/** ITU-R BS.1770-4 Annex 2: true peak is read from the signal oversampled four times. */
const OVERSAMPLING = 4;
/**
 * Taps per polyphase branch of the windowed-sinc interpolation filter. Annex 2 uses 12; 16 keeps
 * the passband flat to about 0.4 × the sample rate.
 */
const TAPS_PER_PHASE = 16;
/** Kaiser window shape for the interpolation filter: about 54 dB of image rejection. */
const KAISER_BETA = 5;
/** Samples per block when skipping blocks too quiet to raise the peak. */
const BLOCK_LENGTH = 1024;
/** Branch tap j multiplies the input sample LEAD − j positions after the current one. */
const LEAD = TAPS_PER_PHASE / 2;

/**
 * True-peak meter (ITU-R BS.1770-4 Annex 2): four-times oversampling with a polyphase
 * windowed-sinc interpolator, reading the highest absolute value of the oversampled signal.
 */
export class TruePeakMeter {
  /** Branches for the oversampled points between input samples (the first point is the sample itself). */
  private readonly branches: Float64Array[];
  /** Largest gain any branch can apply, which bounds every interpolated value. */
  private readonly maxBranchGain: number;

  constructor() {
    this.branches = [];
    for (let phase = 1; phase < OVERSAMPLING; phase++) this.branches.push(designBranch(phase));
    this.maxBranchGain = Math.max(...this.branches.map((taps) => taps.reduce((sum, tap) => sum + Math.abs(tap), 0)));
  }

  /** True peak over all channels, dBTP; −Infinity for silence. */
  measure(audio: AudioData): number {
    let peak = 0;
    for (const samples of audio.channels) peak = Math.max(peak, this.channelPeak(samples));
    return amplitudeToDb(peak);
  }

  /** Highest absolute value of one oversampled channel, linear. */
  channelPeak(samples: Float32Array): number {
    const length = samples.length;
    let peak = absoluteMax(samples, 0, length);
    for (let blockStart = 0; blockStart < length; blockStart += BLOCK_LENGTH) {
      const blockEnd = Math.min(length, blockStart + BLOCK_LENGTH);
      const reach = absoluteMax(samples, Math.max(0, blockStart - LEAD + 1), Math.min(length, blockEnd + LEAD));
      if (reach * this.maxBranchGain <= peak) continue;
      for (let index = blockStart; index < blockEnd; index++) {
        for (const taps of this.branches) {
          const value = Math.abs(interpolate(samples, index, taps));
          if (value > peak) peak = value;
        }
      }
    }
    return peak;
  }
}

/**
 * Taps of one polyphase branch: the windowed sinc h[i] = sinc(i / 4) · w(i) sampled at
 * i = phase + 4 · (j − LEAD), normalised to unity gain at DC.
 */
function designBranch(phase: number): Float64Array {
  const halfLength = (OVERSAMPLING * TAPS_PER_PHASE) / 2;
  const taps = new Float64Array(TAPS_PER_PHASE);
  let sum = 0;
  for (let j = 0; j < TAPS_PER_PHASE; j++) {
    const offset = phase + OVERSAMPLING * (j - LEAD);
    const tap = sinc(offset / OVERSAMPLING) * kaiser(offset, halfLength, KAISER_BETA);
    taps[j] = tap;
    sum += tap;
  }
  for (let j = 0; j < TAPS_PER_PHASE; j++) taps[j] = taps[j]! / sum;
  return taps;
}

/** Interpolated value between samples[index] and samples[index + 1] for one branch; samples outside the signal count as zero. */
function interpolate(samples: Float32Array, index: number, taps: Float64Array): number {
  const first = index + LEAD;
  let sum = 0;
  if (first < samples.length && first - (TAPS_PER_PHASE - 1) >= 0) {
    for (let j = 0; j < TAPS_PER_PHASE; j++) sum += taps[j]! * samples[first - j]!;
    return sum;
  }
  for (let j = 0; j < TAPS_PER_PHASE; j++) {
    const position = first - j;
    if (position >= 0 && position < samples.length) sum += taps[j]! * samples[position]!;
  }
  return sum;
}

function absoluteMax(samples: Float32Array, start: number, end: number): number {
  let peak = 0;
  for (let i = start; i < end; i++) {
    const value = Math.abs(samples[i]!);
    if (value > peak) peak = value;
  }
  return peak;
}


/** Highest absolute sample value over all channels, dBFS. */
export function samplePeak(audio: AudioData): number {
  let peak = 0;
  for (const samples of audio.channels) peak = Math.max(peak, absoluteMax(samples, 0, samples.length));
  return amplitudeToDb(peak);
}
