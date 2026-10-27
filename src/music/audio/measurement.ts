import { FrequencyBands } from "./bands";
import { LoudnessMeter } from "./loudness";
import { SpectrumAnalyzer } from "./spectrum";
import { ToneProfile } from "./tone";
import { TruePeakMeter, samplePeak } from "./true-peak";
import { durationSeconds } from "./types";
import type { TrackLevel } from "./levels";
import type { LoudnessReading } from "./loudness";
import type { MasterMeasure } from "./master";
import type { TrackSpectrum } from "./masking";
import type { AudioData } from "./types";

/** What Ode measures about a recording: duration, loudness, peaks and third-octave spectrum. */
export class AudioMeasurement {
  /** Seconds. */
  readonly duration: number;
  readonly sampleRate: number;
  readonly channelCount: number;
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
    this.loudness = meter.reading();
    this.truePeak = new TruePeakMeter().measure(audio);
    this.samplePeak = samplePeak(audio);
    this.spectrum = new SpectrumAnalyzer(audio.sampleRate, bands).analyze(audio);
    this.tone = new ToneProfile(this.spectrum, bands);
  }

  /** The readings masterCheck needs. */
  toMasterMeasure(): MasterMeasure {
    return {
      integrated: this.loudness.integrated,
      truePeak: this.truePeak,
      shortTermMax: this.loudness.shortTermMax,
      range: this.loudness.range,
      spectrum: this.spectrum,
    };
  }

  /** The readings levelCheck needs for a track of this name. */
  toTrackLevel(name: string): TrackLevel {
    return { name, peak: this.truePeak, loudness: this.loudness.integrated };
  }

  /** The readings maskingCheck needs for a track of this name. */
  toTrackSpectrum(name: string): TrackSpectrum {
    return { name, spectrum: this.spectrum };
  }
}
