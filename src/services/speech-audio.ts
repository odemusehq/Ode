import { decode } from "../music/audio/decode";

/** Converts any audio file Live or a provider produces into the mono 16-bit WAV speech services expect. */
export class SpeechAudio {
  /** Lanczos kernel half-width, in input samples at the lower of the two rates. */
  private static readonly KERNEL_LOBES = 8;

  constructor(private readonly sampleRate: number) {}

  async wav(path: string): Promise<Uint8Array<ArrayBuffer>> {
    const audio = await decode(path);
    const mono = SpeechAudio.mix(audio.channels);
    return SpeechAudio.encodePcm16(this.resample(mono, audio.sampleRate), this.sampleRate);
  }

  async base64Wav(path: string): Promise<string> {
    return Buffer.from(await this.wav(path)).toString("base64");
  }

  /**
   * Lanczos resampling. Output sample i sits at input position c = i · from / to; the fraction of c repeats every
   * to / gcd(from, to) samples, so the weights of each repeating position are worked out once and reused.
   */
  private resample(input: Float32Array, sourceRate: number): Float32Array {
    const from = Math.round(sourceRate);
    const to = this.sampleRate;
    if (from === to) return input;
    const cutoff = Math.min(1, to / from);
    const reach = SpeechAudio.KERNEL_LOBES / cutoff;
    const tables = Array.from({ length: to / SpeechAudio.gcd(from, to) }, (_, phase) => SpeechAudio.weights(((phase * from) % to) / to, reach, cutoff));
    const output = new Float32Array(Math.floor((input.length * to) / from));
    for (let i = 0; i < output.length; i++) {
      const table = tables[i % tables.length]!;
      const start = Math.floor((i * from) / to) + table.first;
      const inside = start >= 0 && start + table.weights.length <= input.length;
      let sum = 0;
      let weight = inside ? table.total : 0;
      for (let k = 0; k < table.weights.length; k++) {
        const j = start + k;
        if (!inside && (j < 0 || j >= input.length)) continue;
        sum += input[j]! * table.weights[k]!;
        if (!inside) weight += table.weights[k]!;
      }
      output[i] = weight === 0 ? 0 : sum / weight;
    }
    return output;
  }

  /** The weights of the input samples around a position whose fraction is `fraction`, from the first sample's offset on. */
  private static weights(fraction: number, reach: number, cutoff: number): { first: number; weights: Float64Array; total: number } {
    const first = Math.ceil(fraction - reach);
    const last = Math.floor(fraction + reach);
    const weights = new Float64Array(last - first + 1);
    for (let k = first; k <= last; k++) weights[k - first] = SpeechAudio.lanczos((k - fraction) * cutoff);
    return { first, weights, total: weights.reduce((sum, value) => sum + value, 0) };
  }

  private static gcd(a: number, b: number): number {
    return b === 0 ? a : SpeechAudio.gcd(b, a % b);
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

  private static encodePcm16(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
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
