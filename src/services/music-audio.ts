import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AudioFileDecoder } from "../music/audio/decode";
import { audioExcerpt, type AudioTimeRange } from "../music/audio/excerpt";
export type { AudioTimeRange } from "../music/audio/excerpt";
import { loudness } from "../music/audio/loudness";
import type { AudioData } from "../music/audio/types";
import { encodeWav, WavBitDepth } from "../music/audio/wav";

export interface FrozenMusicAudio {
  readonly bytes: Uint8Array;
  readonly source: ReturnType<AudioFileDecoder["inspect"]> & { sha256: string; bytes: number; capturedAt: string };
}
export type MusicAudioSource = string | FrozenMusicAudio;
export type AudioListeningSource = FrozenMusicAudio["source"] & { selection: ReturnType<typeof audioExcerpt>["range"] };
export interface ListeningPayload {
  sha256: string;
  bytes: number;
  representation: { encoding: "PCM24 WAV"; channels: number; sampleRate: number; frames: number; gainDb: number };
}

export function audioHash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }

/** Music listening keeps source channels and rate; exact source bytes and encoded payloads are bound before dispatch. */
export class MusicAudio {
  static async freeze(path: string): Promise<FrozenMusicAudio> {
    const bytes = await readFile(path);
    const decoder = new AudioFileDecoder();
    return { bytes, source: { ...decoder.inspect(bytes, path), sha256: audioHash(bytes), bytes: bytes.length, capturedAt: new Date().toISOString() } };
  }

  /** Copy once for this operation, validate content identity and derive samples/metadata from those same bytes. */
  static decode(frozen: FrozenMusicAudio): { audio: AudioData; source: FrozenMusicAudio["source"] } {
    const { bytes, source } = MusicAudio.capturedBytes(frozen);
    const audio = new AudioFileDecoder().decode(bytes, "captured audio", { rejectNonfinite: true });
    return { audio, source };
  }

  static inspect(frozen: FrozenMusicAudio): FrozenMusicAudio["source"] { return MusicAudio.capturedBytes(frozen).source; }

  private static capturedBytes(frozen: FrozenMusicAudio) {
    const bytes = Uint8Array.from(frozen.bytes);
    const sha256 = audioHash(bytes);
    if (sha256 !== frozen.source.sha256 || bytes.length !== frozen.source.bytes) throw new Error("The captured audio bytes changed; capture the source again before listening.");
    const decoder = new AudioFileDecoder();
    return { bytes, source: { ...decoder.inspect(bytes, "captured audio"), sha256, bytes: bytes.length, capturedAt: frozen.source.capturedAt } };
  }

  async wav(source: MusicAudioSource): Promise<Uint8Array<ArrayBuffer>> {
    return (await this.prepare(source)).bytes;
  }

  async prepare(source: MusicAudioSource, range?: AudioTimeRange) {
    const frozen = typeof source === "string" ? await MusicAudio.freeze(source) : source;
    const captured = MusicAudio.decode(frozen);
    MusicAudio.requireSamples(captured.audio);
    const excerpt = audioExcerpt(captured.audio, range?.fromSeconds, range?.toSeconds);
    const bytes = MusicAudio.encode(excerpt.audio);
    return { bytes, sources: [{ ...captured.source, selection: excerpt.range }], payload: MusicAudio.payload(bytes, excerpt.audio) };
  }

  async comparison(a: MusicAudioSource, b: MusicAudioSource, levelMatch: boolean, ranges?: { a?: AudioTimeRange; b?: AudioTimeRange }) {
    const [firstSource, secondSource] = await Promise.all([typeof a === "string" ? MusicAudio.freeze(a) : a, typeof b === "string" ? MusicAudio.freeze(b) : b]);
    const firstCaptured = MusicAudio.decode(firstSource), secondCaptured = MusicAudio.decode(secondSource);
    MusicAudio.requireSamples(firstCaptured.audio);
    MusicAudio.requireSamples(secondCaptured.audio);
    const aExcerpt = audioExcerpt(firstCaptured.audio, ranges?.a?.fromSeconds, ranges?.a?.toSeconds);
    const bExcerpt = audioExcerpt(secondCaptured.audio, ranges?.b?.fromSeconds, ranges?.b?.toSeconds);
    const first = aExcerpt.audio, second = bExcerpt.audio;
    if (first.channels.length > 2 || second.channels.length > 2) throw new Error("Audio comparison supports established mono/stereo layouts only; multichannel layout and channel roles are unknown.");
    if (first.sampleRate !== second.sampleRate || first.channels.length !== second.channels.length) throw new Error("Audio comparison needs matching sample rates and channel layouts; prepare matching files explicitly.");
    const levels = [loudness(first).integrated, loudness(second).integrated];
    if (levelMatch && levels.some((level) => !Number.isFinite(level))) throw new Error("Loudness matching needs at least 0.4 seconds and measurable audio in both excerpts. Set levelMatch false for an unmatched audition.");
    const target = Math.min(...levels);
    const gains = levels.map((level) => levelMatch ? 10 ** ((target - level) / 20) : 1);
    const aFrames = first.channels[0]!.length, bFrames = second.channels[0]!.length;
    const gap = Math.round(first.sampleRate * 0.5);
    const channels = first.channels.map((channel, index) => {
      const joined = new Float32Array(aFrames + gap + bFrames);
      joined.set(channel.map((sample) => sample * gains[0]!), 0);
      joined.set(second.channels[index]!.map((sample) => sample * gains[1]!), aFrames + gap);
      return joined;
    });
    const joinedAudio = { sampleRate: first.sampleRate, channels };
    const bytes = MusicAudio.encode(joinedAudio);
    return { bytes, sources: [{ ...firstCaptured.source, selection: aExcerpt.range }, { ...secondCaptured.source, selection: bExcerpt.range }], payload: MusicAudio.payload(bytes, joinedAudio), comparison: {
      method: "Selected excerpts A then B in one WAV, separated by 0.5 seconds of silence; playback times differ from source-file selection times", sampleRate: first.sampleRate, channels: channels.length,
      levelMatched: levelMatch, gainDb: gains.map((gain) => 20 * Math.log10(gain)), commonConversionGainDb: -20 * Math.log10(MusicAudio.peak(joinedAudio)),
      a: { startSeconds: 0, endSeconds: aFrames / first.sampleRate },
      b: { startSeconds: (aFrames + gap) / first.sampleRate, endSeconds: (aFrames + gap + bFrames) / first.sampleRate },
    } };
  }

  private static requireSamples(audio: AudioData): void {
    if (audio.channels.length === 0 || !audio.channels[0]?.length) throw new Error("Audio listening needs a nonempty recording; this file has zero sample frames.");
    const frames = audio.channels[0].length;
    if (!Number.isInteger(audio.sampleRate) || audio.sampleRate <= 0 || audio.sampleRate * audio.channels.length * 3 > 0xffffffff) throw new Error("Audio listening needs an integer sample rate representable in PCM WAV. Export or resample explicitly; Ode will not silently alter the source rate.");
    for (const channel of audio.channels) {
      if (channel.length !== frames) throw new Error("Audio listening needs the same sample frame length in every channel.");
      for (const sample of channel) if (!Number.isFinite(sample)) throw new Error("Audio listening contains a nonfinite sample; the provider was not called.");
    }
  }

  private static payload(bytes: Uint8Array, audio: AudioData): ListeningPayload {
    return { sha256: audioHash(bytes), bytes: bytes.length, representation: { encoding: "PCM24 WAV", channels: audio.channels.length, sampleRate: audio.sampleRate,
      frames: audio.channels[0]?.length ?? 0, gainDb: -20 * Math.log10(MusicAudio.peak(audio)) } };
  }

  /** Uniform attenuation prevents integer clipping; relative stereo levels and full bandwidth remain. */
  private static encode(audio: AudioData): Uint8Array<ArrayBuffer> {
    const peak = MusicAudio.peak(audio);
    const channels = peak > 1 ? audio.channels.map((channel) => channel.map((sample) => sample / peak)) : audio.channels;
    return encodeWav({ sampleRate: audio.sampleRate, channels }, WavBitDepth.Int24);
  }

  private static peak(audio: AudioData): number {
    let peak = 1;
    for (const channel of audio.channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    return peak;
  }
}
