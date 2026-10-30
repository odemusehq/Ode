import { amplitudeToDb } from "./units";
import type { AudioData } from "./types";

/** Nearest source-sample boundaries, with an exclusive end. Never extend a requested range with silence. */
export function audioExcerpt(source: AudioData, fromSeconds = 0, toSeconds?: number) {
  const frames = source.channels[0]?.length ?? 0;
  const duration = frames / source.sampleRate;
  const end = toSeconds ?? duration;
  if (!Number.isFinite(fromSeconds) || !Number.isFinite(end) || fromSeconds < 0 || end > duration || end <= fromSeconds) {
    throw new Error(`Choose a nonempty time range within this recording (0–${duration} seconds).`);
  }
  const firstFrame = Math.round(fromSeconds * source.sampleRate);
  const endFrame = Math.round(end * source.sampleRate);
  if (endFrame <= firstFrame) throw new Error("The selected time range contains no sample frames.");
  return {
    audio: { sampleRate: source.sampleRate, channels: source.channels.map((channel) => channel.subarray(firstFrame, endFrame)) },
    range: { firstFrame, endFrame, fromSeconds: firstFrame / source.sampleRate, toSeconds: endFrame / source.sampleRate,
      sourceFrames: frames, sourceDurationSeconds: duration, boundary: "nearest sample; end exclusive" },
  };
}

interface PeakRegion {
  channel: number;
  firstFrame: number;
  endFrame: number;
  fromSeconds: number;
  toSeconds: number;
  samplePeakDbfs: number;
}

const NEAR_FULL_SCALE_DBFS = -0.1;
const MAX_REGIONS = 32;

/** Locate sample peaks, not audible distortion or interpolated true peaks. Channels are numbered from one. */
export function samplePeakRegions(audio: AudioData, sourceFirstFrame = 0) {
  const threshold = 10 ** (NEAR_FULL_SCALE_DBFS / 20);
  let peak = 0, peakFrame = 0, peakChannel = 0, regionCount = 0, sampleCount = 0;
  const regions: PeakRegion[] = [];
  for (const [channelIndex, samples] of audio.channels.entries()) {
    let start = -1, runPeak = 0, saved = 0;
    const finish = (end: number) => {
      if (start < 0) return;
      regionCount++;
      if (saved++ < MAX_REGIONS) regions.push({ channel: channelIndex + 1, firstFrame: sourceFirstFrame + start, endFrame: sourceFirstFrame + end,
        fromSeconds: (sourceFirstFrame + start) / audio.sampleRate, toSeconds: (sourceFirstFrame + end) / audio.sampleRate, samplePeakDbfs: amplitudeToDb(runPeak) });
      start = -1; runPeak = 0;
    };
    for (let frame = 0; frame < samples.length; frame++) {
      const value = Math.abs(samples[frame]!);
      if (value > peak) { peak = value; peakFrame = sourceFirstFrame + frame; peakChannel = channelIndex + 1; }
      if (value >= threshold) {
        sampleCount++;
        if (start < 0) start = frame;
        runPeak = Math.max(runPeak, value);
      } else finish(frame);
    }
    finish(samples.length);
  }
  regions.sort((a, b) => a.firstFrame - b.firstFrame || a.channel - b.channel);
  return {
    peak: peak > 0 ? { channel: peakChannel, frame: peakFrame, seconds: peakFrame / audio.sampleRate, samplePeakDbfs: amplitudeToDb(peak) } : null,
    nearFullScale: { thresholdDbfs: NEAR_FULL_SCALE_DBFS, channelSampleCount: sampleCount, regionCount, omittedRegions: Math.max(0, regionCount - MAX_REGIONS), regions: regions.slice(0, MAX_REGIONS) },
    interpretation: "Source sample/frame positions, with exclusive region ends. Near-full-scale samples are candidates to audition, not proof of clipping or audible distortion. Interpolated true-peak positions are not measured here.",
  };
}
