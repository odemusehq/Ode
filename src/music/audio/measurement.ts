import { FrequencyBands } from "./bands";
import { LoudnessMeter } from "./loudness";
import { SpectrumAnalyzer } from "./spectrum";
import { ToneProfile } from "./tone";
import { TruePeakMeter, samplePeak } from "./true-peak";
import { durationSeconds } from "./types";
import type { TrackLevel } from "./levels";
import type { LoudnessReading } from "./loudness";
import type { TrackSpectrum } from "./masking";
import type { AudioData } from "./types";

/** What Ode measures about a recording: duration, loudness, peaks and third-octave spectrum. */
export class AudioMeasurement {
  /** Seconds. */
  readonly duration: number;
  readonly sampleRate: number;
  readonly channelCount: number;
  readonly frames: number;
  readonly stereo: { correlation: number | null; monoPowerRatioDb: number | null; leftPowerDb: number | null; rightPowerDb: number | null } | null;
  readonly loudness: LoudnessReading;
  /** dBTP. */
  readonly truePeak: number;
  /** dBFS. */
  readonly samplePeak: number;
  /** Band levels in dB, lowest band first. */
  readonly spectrum: number[];
  readonly tone: ToneProfile;

  constructor(audio: AudioData, bands: FrequencyBands = new FrequencyBands()) {
    const meter = new LoudnessMeter(audio.sampleRate, audio.channels.length);
    meter.push(audio.channels);
    this.duration = durationSeconds(audio);
    this.sampleRate = audio.sampleRate;
    this.channelCount = audio.channels.length;
    this.frames = audio.channels[0]?.length ?? 0;
    this.stereo = AudioMeasurement.stereoReading(audio);
    this.loudness = meter.reading();
    this.truePeak = new TruePeakMeter().measure(audio);
    this.samplePeak = samplePeak(audio);
    this.spectrum = new SpectrumAnalyzer(audio.sampleRate, bands).analyze(audio);
    this.tone = new ToneProfile(this.spectrum, bands);
  }

  private static stereoReading(audio: AudioData): AudioMeasurement["stereo"] {
    if (audio.channels.length !== 2) return null;
    const [left, right] = audio.channels as [Float32Array, Float32Array];
    let l = 0, r = 0, cross = 0, mono = 0;
    for (let i = 0; i < left.length; i++) {
      l += left[i]! ** 2;
      r += right[i]! ** 2;
      cross += left[i]! * right[i]!;
      mono += ((left[i]! + right[i]!) / 2) ** 2;
    }
    const db = (power: number) => power > 0 ? 10 * Math.log10(power) : null;
    return { correlation: l > 0 && r > 0 ? Math.max(-1, Math.min(1, cross / Math.sqrt(l * r))) : null, monoPowerRatioDb: l + r > 0 ? mono > 0 ? 10 * Math.log10(mono / ((l + r) / 2)) : -Infinity : null, leftPowerDb: db(l / Math.max(1, left.length)), rightPowerDb: db(r / Math.max(1, right.length)) };
  }

  /** The readings levelCheck needs for a track of this name. */
  toTrackLevel(name: string): TrackLevel {
    return { name, peak: this.truePeak, peakUnit: "dBTP", loudness: this.loudness.integrated };
  }

  /** The readings maskingCheck needs for a track of this name. */
  toTrackSpectrum(name: string): TrackSpectrum {
    return { name, spectrum: this.spectrum };
  }
}
