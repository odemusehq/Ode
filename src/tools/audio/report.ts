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
    frames: measurement.frames,
    stereo: measurement.stereo && { ...measurement.stereo, monoPowerRatioDb: measurement.stereo.monoPowerRatioDb === -Infinity ? "complete cancellation" : measurement.stereo.monoPowerRatioDb },
    loudness: {
      integratedLufs: rounded(loudness.integrated),
      momentaryMaxLufs: rounded(loudness.momentaryMax),
      shortTermMaxLufs: rounded(loudness.shortTermMax),
      rangeLu: measurement.duration < 3 ? null : rounded(loudness.range),
      integratedStatus: !measurement.loudnessSupported ? "unsupported: multichannel layout is unknown; peaks and spectrum retain all channels" : measurement.duration < 0.4 ? "insufficient duration" : Number.isFinite(loudness.integrated) ? "measured" : "below loudness gates",
      coverage: measurement.loudnessSupported ? "Final partial 100 ms step is zero-padded; short-clip range is not evidence of flat dynamics. Meter compliance is not independently certified." : "Loudness was not measured because channel roles are unknown; peak and spectrum measurements include every source channel.",
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
