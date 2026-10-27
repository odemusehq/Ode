import { powerToDb } from "./units";
import { frameCount } from "./types";
import type { AudioData } from "./types";

/** Average of all channels. */
export function toMono(audio: AudioData): Float32Array {
  const length = frameCount(audio);
  const mono = new Float32Array(length);
  const channelCount = audio.channels.length;
  if (channelCount === 0) return mono;
  for (const samples of audio.channels) {
    for (let i = 0; i < length; i++) mono[i] = mono[i]! + samples[i]! / channelCount;
  }
  return mono;
}

/**
 * Sample positions of analysis frames spaced hop samples apart (hop may be fractional),
 * frame k centred on sample round(k · hop), covering the whole signal.
 */
export function frameCentres(length: number, hop: number): number[] {
  const count = length > 0 ? Math.floor((length - 1) / hop) + 1 : 0;
  return Array.from({ length: count }, (_, k) => Math.round(k * hop));
}

/** RMS level in dBFS of a window centred on each given sample; −Infinity where the window is silent. */
export function rmsLevels(samples: Float32Array, centres: readonly number[], windowLength: number): Float64Array {
  const half = Math.floor(windowLength / 2);
  const levels = new Float64Array(centres.length);
  centres.forEach((centre, k) => {
    const start = Math.max(0, centre - half);
    const end = Math.min(samples.length, centre + half);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i]! * samples[i]!;
    levels[k] = end > start ? powerToDb(sum / (end - start)) : -Infinity;
  });
  return levels;
}

/** Median of a list of numbers (NaN for an empty list). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
