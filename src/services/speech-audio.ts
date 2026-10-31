import { MusicAudio, audioHash, type MusicAudioSource } from "./music-audio";

export interface SpeechPayload {
  sha256: string;
  bytes: number;
  representation: {
    encoding: "PCM16 WAV";
    channels: 1;
    sampleRate: number;
    frames: number;
    sourceChannels: 1;
    sourceSampleRate: number;
    mixing: "none";
    resampling: "none";
    gainDb: 0;
  };
}

/** Pass through provider-ready speech. Recording/format preparation belongs to native audio backends. */
export class SpeechAudio {
  async prepare(source: MusicAudioSource) {
    const frozen = typeof source === "string" ? await MusicAudio.freeze(source) : source;
    const bytes = Uint8Array.from(frozen.bytes);
    const info = MusicAudio.inspect({ bytes, source: frozen.source });
    if (info.frames === 0) throw new Error("Transcription needs a nonempty recording; this file has zero sample frames.");
    if (info.format !== "WAV" || info.encoding !== "signed int" || info.bitDepth !== 16 || info.channels !== 1 ||
      ![16_000, 24_000].includes(info.sampleRate)) {
      throw new Error("Transcription needs mono PCM16 WAV at 16 or 24 kHz. Prepare it with the native recorder, Ableton or a supported plug-in; Ode does not downmix or resample audio.");
    }
    const payload: SpeechPayload = { sha256: audioHash(bytes), bytes: bytes.length, representation: {
      encoding: "PCM16 WAV", channels: 1, sampleRate: info.sampleRate, frames: info.frames,
      sourceChannels: 1, sourceSampleRate: info.sampleRate, mixing: "none", resampling: "none", gainDb: 0,
    } };
    return { bytes, source: info, payload };
  }

  async wav(path: string): Promise<Uint8Array<ArrayBuffer>> {
    return (await this.prepare(path)).bytes;
  }

  async base64Wav(path: string): Promise<string> {
    return Buffer.from(await this.wav(path)).toString("base64");
  }
}
