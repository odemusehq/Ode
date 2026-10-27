import { frameCentres, median, rmsLevels, toMono } from "./signal";
import { YinEstimator } from "./yin";
import type { AudioData } from "./types";

export interface PitchFrame {
  /** Centre of the frame, seconds from the start of the audio. */
  time: number;
  /** Fundamental frequency in Hz, or null when the frame is unvoiced. */
  freq: number | null;
  /** Probability that the frame is voiced, 0…1. */
  confidence: number;
}

export interface PitchTrackerOptions {
  /** Time between frames, ms. */
  hopMs: number;
  /** Integration window, ms. */
  windowMs: number;
  /** Lowest and highest fundamental searched, Hz. */
  minFrequency: number;
  maxFrequency: number;
  /** YIN absolute threshold on the cumulative mean normalised difference. */
  threshold: number;
  /** Frames in the median filter applied to voicing and pitch. */
  medianFrames: number;
  /** Frames quieter than this are unvoiced, dBFS. */
  silenceDbfs: number;
  /** Frames this far below the loudest frame are unvoiced, dB. */
  dynamicRangeDb: number;
}

export const DEFAULT_PITCH_TRACKER_OPTIONS: Readonly<PitchTrackerOptions> = {
  hopMs: 10,
  windowMs: 25,
  minFrequency: 60,
  maxFrequency: 1200,
  threshold: 0.15,
  medianFrames: 5,
  silenceDbfs: -60,
  dynamicRangeDb: 40,
};

/** A frame counts as voiced when its voicing probability reaches one half. */
const VOICED_PROBABILITY = 0.5;
const MS_PER_SECOND = 1000;

/**
 * Monophonic pitch tracker for voice: YIN per frame, a voicing probability per frame, a level gate,
 * then median smoothing of voicing and pitch.
 *
 * Voicing probability is the chance that the frame's aperiodicity lies under a YIN threshold drawn
 * uniformly between 0 and twice the configured threshold, so it is exactly one half at the threshold.
 */
export class PitchTracker {
  readonly options: PitchTrackerOptions;
  /** Samples between frame centres (may be fractional). */
  readonly hop: number;
  /** Integration window, samples. */
  readonly windowLength: number;
  private readonly yin: YinEstimator;

  constructor(
    private readonly sampleRate: number,
    options: Partial<PitchTrackerOptions> = {},
  ) {
    this.options = { ...DEFAULT_PITCH_TRACKER_OPTIONS, ...options };
    this.hop = (sampleRate * this.options.hopMs) / MS_PER_SECOND;
    this.windowLength = Math.max(1, Math.round((sampleRate * this.options.windowMs) / MS_PER_SECOND));
    const minLag = Math.max(2, Math.floor(sampleRate / this.options.maxFrequency));
    const maxLag = Math.max(minLag + 1, Math.ceil(sampleRate / this.options.minFrequency));
    this.yin = new YinEstimator(this.windowLength, minLag, maxLag, this.options.threshold);
  }

  track(audio: AudioData): PitchFrame[] {
    return this.trackSamples(toMono(audio));
  }

  /** RMS level of each frame of a mono signal, dBFS. */
  frameLevels(samples: Float32Array): Float64Array {
    return rmsLevels(samples, frameCentres(samples.length, this.hop), this.windowLength);
  }

  /** Level under which frames count as silence: the silence level or the dynamic range below the loudest frame, whichever is higher. */
  levelGate(levels: Float64Array): number {
    let loudest = -Infinity;
    for (const level of levels) loudest = Math.max(loudest, level);
    return Math.max(this.options.silenceDbfs, loudest - this.options.dynamicRangeDb);
  }

  /** Pitch frames for a mono signal, one every hop samples. */
  trackSamples(samples: Float32Array): PitchFrame[] {
    const centres = frameCentres(samples.length, this.hop);
    const levels = rmsLevels(samples, centres, this.windowLength);
    const gate = this.levelGate(levels);

    const halfWindow = Math.floor(this.windowLength / 2);
    const padded = new Float32Array(halfWindow + samples.length + this.yin.span);
    padded.set(samples, halfWindow);

    const probabilities = centres.map(() => 0);
    const frequencies = centres.map(() => Number.NaN);
    centres.forEach((centre, k) => {
      if (!(levels[k]! >= gate)) return;
      const estimate = this.yin.estimate(padded, centre);
      probabilities[k] = Math.max(0, Math.min(1, 1 - estimate.aperiodicity / (2 * this.options.threshold)));
      frequencies[k] = this.sampleRate / estimate.period;
    });
    return this.smooth(centres, frequencies, probabilities);
  }

  /** Median-filters the voicing probability and, over voiced frames, the frequency. */
  private smooth(centres: readonly number[], frequencies: readonly number[], probabilities: readonly number[]): PitchFrame[] {
    const reach = Math.floor(this.options.medianFrames / 2);
    return centres.map((centre, k) => {
      const first = Math.max(0, k - reach);
      const last = Math.min(centres.length - 1, k + reach);
      const nearby: number[] = [];
      const voicedNearby: number[] = [];
      for (let j = first; j <= last; j++) {
        const probability = probabilities[j]!;
        nearby.push(probability);
        const frequency = frequencies[j]!;
        if (probability >= VOICED_PROBABILITY && Number.isFinite(frequency)) voicedNearby.push(frequency);
      }
      const confidence = median(nearby);
      const voiced = confidence >= VOICED_PROBABILITY && voicedNearby.length > 0;
      return { time: centre / this.sampleRate, freq: voiced ? median(voicedNearby) : null, confidence };
    });
  }
}

/** Pitch of a monophonic recording (voice, a hummed or sung line), one frame every hopMs milliseconds. */
export function pitchTrack(audio: AudioData, hopMs: number = DEFAULT_PITCH_TRACKER_OPTIONS.hopMs): PitchFrame[] {
  return new PitchTracker(audio.sampleRate, { hopMs }).track(audio);
}
