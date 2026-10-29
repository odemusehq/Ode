import type { AudioMeasurement } from "../../music/audio";

/** Decimal places in readings returned to the agent. */
const READING_DIGITS = 1;

/** A reading rounded for a tool result; null for silence (an infinite reading). */
export function rounded(value: number, digits: number = READING_DIGITS): number | null {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Plain JSON readings of a measurement: duration, loudness, peaks and a short spectrum summary. */
export function measurementReport(measurement: AudioMeasurement) {
  const { loudness } = measurement;
  const summary = measurement.tone.summary();
  return {
    durationSeconds: rounded(measurement.duration, 2),
    sampleRate: measurement.sampleRate,
    channels: measurement.channelCount,
    loudness: {
      integratedLufs: rounded(loudness.integrated),
      momentaryMaxLufs: rounded(loudness.momentaryMax),
      shortTermMaxLufs: rounded(loudness.shortTermMax),
      rangeLu: rounded(loudness.range),
    },
    truePeakDbtp: rounded(measurement.truePeak),
    samplePeakDbfs: rounded(measurement.samplePeak),
    spectrum: measurement.tone.silent
      ? null
      : {
          tiltDbPerOctave: rounded(summary.tilt),
          strongestBand: summary.strongestBand,
          regions: summary.regions.map((region) => ({ region: region.region, range: region.range, levelDb: rounded(region.level) })),
        },
  };
}
