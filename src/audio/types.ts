/** Decoded audio: one array of samples (nominally −1…1) per channel, all of the same length. */
export interface AudioData {
  sampleRate: number;
  channels: Float32Array[];
}

/** A key as Live reports it: root pitch class (0 = C … 11 = B) and the scale's intervals in semitones from the root. */
export interface MusicalKey {
  root: number;
  intervals: number[];
}

export function frameCount(audio: AudioData): number {
  return audio.channels[0]?.length ?? 0;
}

export function durationSeconds(audio: AudioData): number {
  return audio.sampleRate > 0 ? frameCount(audio) / audio.sampleRate : 0;
}
