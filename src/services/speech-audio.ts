import { readFile } from "node:fs/promises";
import decode from "audio-decode";

/** Converts any audio file Live or a provider produces into the mono 16-bit WAV speech services expect. */
export class SpeechAudio {
  /** Lanczos kernel half-width, in input samples at the lower of the two rates. */
  private static readonly KERNEL_LOBES = 8;

  constructor(private readonly sampleRate: number) {}

  async wav(path: string): Promise<Uint8Array> {
    const audio = await decode(await readFile(path));
    const mono = SpeechAudio.mix(audio.channelData);
    return SpeechAudio.encodePcm16(this.resample(mono, audio.sampleRate), this.sampleRate);
  }

  async base64Wav(path: string): Promise<string> {
    return Buffer.from(await this.wav(path)).toString("base64");
  }

  private resample(input: Float32Array, from: number): Float32Array {
    const to = this.sampleRate;
    if (from === to) return input;
    const ratio = to / from;
    const cutoff = Math.min(1, ratio);
    const reach = SpeechAudio.KERNEL_LOBES / cutoff;
    const output = new Float32Array(Math.floor(input.length * ratio));
    for (let i = 0; i < output.length; i++) {
      const centre = i / ratio;
      let sum = 0;
      let weight = 0;
      for (let j = Math.ceil(centre - reach); j <= Math.floor(centre + reach); j++) {
        if (j < 0 || j >= input.length) continue;
        const w = SpeechAudio.lanczos((j - centre) * cutoff);
        sum += input[j]! * w;
        weight += w;
      }
      output[i] = weight === 0 ? 0 : sum / weight;
    }
    return output;
  }

  private static lanczos(x: number): number {
    if (x === 0) return 1;
    if (Math.abs(x) >= SpeechAudio.KERNEL_LOBES) return 0;
    const px = Math.PI * x;
    return (SpeechAudio.KERNEL_LOBES * Math.sin(px) * Math.sin(px / SpeechAudio.KERNEL_LOBES)) / (px * px);
  }

  private static mix(channels: Float32Array[]): Float32Array {
    const first = channels[0] ?? new Float32Array(0);
    if (channels.length === 1) return first;
    const mono = new Float32Array(first.length);
    for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i]! += (channel[i] ?? 0) / channels.length;
    return mono;
  }

  private static encodePcm16(samples: Float32Array, sampleRate: number): Uint8Array {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 0x7fff), true));
    return bytes;
  }
}
