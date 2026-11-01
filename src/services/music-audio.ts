import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AudioFileDecoder } from "../audio/decode";
import { audioExcerpt, type AudioTimeRange } from "../audio/excerpt";
export type { AudioTimeRange } from "../audio/excerpt";
import type { AudioData } from "../audio/types";
import { encodeWav, WavBitDepth } from "../audio/wav";
import type { AudioContent } from "./capabilities";

export interface FrozenMusicAudio {
  readonly bytes: Uint8Array;
  readonly source: ReturnType<AudioFileDecoder["inspect"]> & { sha256: string; bytes: number; capturedAt: string };
}
export type MusicAudioSource = string | FrozenMusicAudio;
export type AudioListeningSource = FrozenMusicAudio["source"] & { selection: ReturnType<typeof audioExcerpt>["range"] };
export interface ListeningPayload {
  sha256: string;
  bytes: number;
  representation: { encoding: "Float32 WAV" | "PCM24 WAV" | "PCM16 WAV"; channels: number; sampleRate: number; frames: number; gainDb: number };
}

export function audioHash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }

/** Music listening keeps source channels and rate; exact source bytes and encoded payloads are bound before dispatch. */
export class MusicAudio {
  private static readonly CONTEXT_BYTES = 50_000_000;
  /** Read media into the calling agent's context. No model call or listening assessment happens here. */
  async read(path: string, range?: AudioTimeRange) {
    if (/\.mp3$/i.test(path)) {
      if (range?.fromSeconds !== undefined || range?.toSeconds !== undefined) throw new Error("Select MP3 excerpts in Live before opening them; this tool attaches the original full MP3 without a local decoder.");
      const bytes = await readFile(path);
      if (bytes.length > MusicAudio.CONTEXT_BYTES) throw new Error("The audio attachment is over 50 MB. Prepare a shorter excerpt in Live.");
      if (bytes.length < 10 || !(bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))) throw new Error("The file has no recognised MP3 header.");
      const source = { format: "MP3", bytes: bytes.length, sha256: audioHash(bytes), capturedAt: new Date().toISOString(), selection: null };
      const content: AudioContent = { type: "audio", data: Uint8Array.from(bytes), format: "mp3", durationSeconds: null };
      return { content, source, payload: { sha256: source.sha256, bytes: bytes.length, representation: { encoding: "MP3", durationSeconds: null } } };
    }
    const frozen = await MusicAudio.freeze(path);
    if (frozen.source.channels > 2) throw new Error("Audio context supports known mono/stereo layouts only; prepare a native stereo mix in Live.");
    const prepared = await this.prepare(frozen, range);
    // A whole WAV can travel unchanged, including its native sample format and headroom.
    const original = frozen.source.format === "WAV" && frozen.bytes.length <= MusicAudio.CONTEXT_BYTES && range?.fromSeconds === undefined && range?.toSeconds === undefined;
    const data = original ? Uint8Array.from(frozen.bytes) : prepared.bytes;
    if (data.length > MusicAudio.CONTEXT_BYTES) throw new Error("The audio attachment is over 50 MB. Read a shorter file range or capture a shorter passage in Live.");
    const content: AudioContent = { type: "audio", data, format: "wav", durationSeconds: prepared.payload.representation.frames / prepared.payload.representation.sampleRate };
    return { content, source: prepared.sources[0]!, payload: { ...prepared.payload, sha256: audioHash(data), bytes: data.length,
      representation: original ? { ...prepared.payload.representation, encoding: `${frozen.source.bitDepth}-bit ${frozen.source.encoding} WAV` } : prepared.payload.representation } };
  }

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
    const capturedBytes = MusicAudio.capturedBytes(frozen);
    const captured = { source: capturedBytes.source, audio: await new AudioFileDecoder().decodeAsync(capturedBytes.bytes, "captured audio", { rejectNonfinite: true }) };
    MusicAudio.requireSamples(captured.audio);
    const excerpt = audioExcerpt(captured.audio, range?.fromSeconds, range?.toSeconds);
    const bitDepth = MusicAudio.bitDepth(excerpt.audio);
    const bytes = encodeWav(excerpt.audio, bitDepth);
    return { bytes, sources: [{ ...captured.source, selection: excerpt.range }], payload: MusicAudio.payload(bytes, excerpt.audio, bitDepth) };
  }

  private static requireSamples(audio: AudioData): void {
    if (audio.channels.length === 0 || !audio.channels[0]?.length) throw new Error("Audio listening needs a nonempty recording; this file has zero sample frames.");
    const frames = audio.channels[0].length;
    if (!Number.isInteger(audio.sampleRate) || audio.sampleRate <= 0 || audio.sampleRate * audio.channels.length * 4 > 0xffffffff) throw new Error("Audio listening needs an integer sample rate representable in Float32 WAV. Export or resample explicitly; Ode will not silently alter the source rate.");
    for (const channel of audio.channels) {
      if (channel.length !== frames) throw new Error("Audio listening needs the same sample frame length in every channel.");
    }
  }

  private static payload(bytes: Uint8Array, audio: AudioData, bitDepth: WavBitDepth): ListeningPayload {
    return { sha256: audioHash(bytes), bytes: bytes.length, representation: { encoding: bitDepth === WavBitDepth.Float32 ? "Float32 WAV" : bitDepth === WavBitDepth.Int24 ? "PCM24 WAV" : "PCM16 WAV", channels: audio.channels.length, sampleRate: audio.sampleRate,
      frames: audio.channels[0]?.length ?? 0, gainDb: 0 } };
  }

  /** Change only the transport sample format when needed; never clip float headroom, mix, resample or normalise. */
  private static bitDepth(audio: AudioData): WavBitDepth {
    const samples = audio.channels.length * audio.channels[0]!.length;
    if (58 + samples * 4 <= MusicAudio.CONTEXT_BYTES) return WavBitDepth.Float32;
    const bitDepth = 44 + samples * 3 <= MusicAudio.CONTEXT_BYTES ? WavBitDepth.Int24 : WavBitDepth.Int16;
    if (44 + samples * (bitDepth / 8) > MusicAudio.CONTEXT_BYTES) throw new Error("The audio attachment exceeds 50 MB even in PCM16. Read a shorter range; channels and sample rate were kept.");
    for (const channel of audio.channels) for (const sample of channel) {
      if (sample < -1 || sample > 1) throw new Error("This float recording exceeds integer PCM headroom. Read a shorter range to preserve it; Ode will not clip or normalise it to fit the upload.");
    }
    return bitDepth;
  }
}
