import FFT from "fft.js";
import { FrequencyBands, THIRD_OCTAVE_BAND_COUNT } from "./bands";
import { frameCount } from "./types";
import { powerToDb } from "./units";
import { hannWindow } from "./window";
import type { AudioData } from "./types";

/** FFT bins about this far apart, so the narrowest band (20 Hz, about 4.6 Hz wide) spans several bins. */
const TARGET_BIN_SPACING_HZ = 1.5;
/** Frames quieter than this are left out of the time average, dBFS (the level of the BS.1770 absolute gate). */
const SILENT_FRAME_DBFS = -70;
/** Band levels never read below this, dB (far under the noise floor of 24-bit audio). */
export const SPECTRUM_FLOOR_DB = -150;
/** Recordings shorter than this many samples are too short to analyse. */
const MIN_FRAME_LENGTH = 256;

interface BinWeight {
  bin: number;
  weight: number;
}

/**
 * Band levels averaged over time: Hann-windowed FFT frames with 50 % overlap, each bin's power
 * shared between the bands it overlaps, powers averaged over channels and non-silent frames.
 * A band level is the RMS level of the signal within the band in dB relative to full scale
 * (a full-scale sine reads −3 dB in its band), so the band powers add up to the whole signal's level.
 */
export class SpectrumAnalyzer {
  private readonly fftSize: number;
  private readonly fft: FFT;
  private readonly bandBins: BinWeight[][];

  constructor(
    private readonly sampleRate: number,
    readonly bands: FrequencyBands = new FrequencyBands(),
  ) {
    this.fftSize = 2 ** Math.ceil(Math.log2(sampleRate / TARGET_BIN_SPACING_HZ));
    this.fft = new FFT(this.fftSize);
    this.bandBins = bands.bands.map((band) => this.binsWithin(band.low, band.high));
  }

  /** Level of each band in dB, from the lowest band up. */
  analyze(audio: AudioData): number[] {
    const length = frameCount(audio);
    const windowLength = Math.min(this.fftSize, length);
    const floor = this.bands.bands.map(() => SPECTRUM_FLOOR_DB);
    if (windowLength < MIN_FRAME_LENGTH || audio.channels.length === 0) return floor;

    const window = hannWindow(windowLength);
    let windowPower = 0;
    for (const value of window) windowPower += value * value;
    const binScale = 1 / (this.fftSize * windowPower);

    const input = new Float64Array(this.fftSize);
    const output = this.fft.createComplexArray();
    const binPower = new Float64Array(this.fftSize / 2 + 1);
    const bandPower = new Float64Array(this.bands.count);
    let frames = 0;

    for (const start of frameStarts(length, windowLength)) {
      if (powerToDb(frameMeanSquare(audio, start, windowLength)) < SILENT_FRAME_DBFS) continue;
      frames++;
      for (const samples of audio.channels) {
        for (let n = 0; n < windowLength; n++) input[n] = samples[start + n]! * window[n]!;
        this.fft.realTransform(output, input);
        for (let k = 0; k < binPower.length; k++) {
          const re = output[2 * k] as number;
          const im = output[2 * k + 1] as number;
          const oneSided = k === 0 || k === this.fftSize / 2 ? 1 : 2;
          binPower[k] = oneSided * (re * re + im * im) * binScale;
        }
        this.bandBins.forEach((bins, band) => {
          let power = 0;
          for (const { bin, weight } of bins) power += weight * binPower[bin]!;
          bandPower[band] = bandPower[band]! + power / audio.channels.length;
        });
      }
    }
    if (frames === 0) return floor;
    return Array.from(bandPower, (power) => Math.max(SPECTRUM_FLOOR_DB, powerToDb(power / frames)));
  }

  /** FFT bins overlapping [low, high) Hz, each weighted by the share of its width inside the band. */
  private binsWithin(low: number, high: number): BinWeight[] {
    const spacing = this.sampleRate / this.fftSize;
    const lastBin = this.fftSize / 2;
    const bins: BinWeight[] = [];
    const first = Math.max(0, Math.floor(low / spacing - 0.5));
    const last = Math.min(lastBin, Math.ceil(high / spacing + 0.5));
    for (let bin = first; bin <= last; bin++) {
      const overlap = Math.min(high, (bin + 0.5) * spacing) - Math.max(low, (bin - 0.5) * spacing);
      if (overlap > 0) bins.push({ bin, weight: overlap / spacing });
    }
    return bins;
  }
}

/** Frame starts every half window, plus a final frame ending at the last sample. */
function frameStarts(length: number, windowLength: number): number[] {
  const hop = Math.max(1, Math.floor(windowLength / 2));
  const starts: number[] = [];
  for (let start = 0; start + windowLength <= length; start += hop) starts.push(start);
  const lastStart = length - windowLength;
  if (starts[starts.length - 1] !== lastStart) starts.push(lastStart);
  return starts;
}

/** Mean square of a frame, averaged over channels. */
function frameMeanSquare(audio: AudioData, start: number, windowLength: number): number {
  let sum = 0;
  for (const samples of audio.channels) {
    for (let n = start; n < start + windowLength; n++) sum += samples[n]! * samples[n]!;
  }
  return sum / (windowLength * audio.channels.length);
}

/** Band levels in dB, averaged over time; 31 bands are the third-octave bands from 20 Hz to 20 kHz. */
export function spectrum(audio: AudioData, bands: number = THIRD_OCTAVE_BAND_COUNT): number[] {
  return new SpectrumAnalyzer(audio.sampleRate, new FrequencyBands(bands)).analyze(audio);
}
