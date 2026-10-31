import type { AudioData } from "./types";

export interface AudioTimeRange { fromSeconds?: number; toSeconds?: number }

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
