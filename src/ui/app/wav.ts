/** Writes audio as a mono 16-bit PCM WAV file, the format the server's speech services take. */
export class WavEncoder {
  private static readonly MIME_TYPE = "audio/wav";
  /** RIFF header, "fmt " chunk and "data" chunk header. */
  private static readonly HEADER_BYTES = 44;
  /** The "RIFF" id and the size field, which the RIFF size leaves out. */
  private static readonly RIFF_PREAMBLE_BYTES = 8;
  private static readonly FMT_CHUNK_BYTES = 16;
  private static readonly PCM_FORMAT = 1;
  private static readonly CHANNELS = 1;
  private static readonly BITS_PER_SAMPLE = 16;
  private static readonly BYTES_PER_SAMPLE = 2;
  private static readonly INT16_POSITIVE = 0x7fff;
  private static readonly INT16_NEGATIVE = 0x8000;

  /** Mixes every channel down to one and writes it as 16-bit PCM at the buffer's sample rate. */
  static monoWav(buffer: AudioBuffer): Blob {
    const samples = WavEncoder.mixDown(buffer);
    return new Blob([WavEncoder.encode(samples, buffer.sampleRate)], { type: WavEncoder.MIME_TYPE });
  }

  private static mixDown(buffer: AudioBuffer): Float32Array {
    const mono = new Float32Array(buffer.length);
    const channels = buffer.numberOfChannels;
    for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < mono.length; index += 1) {
        mono[index] = (mono[index] ?? 0) + (data[index] ?? 0) / channels;
      }
    }
    return mono;
  }

  private static encode(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const blockAlign = WavEncoder.CHANNELS * WavEncoder.BYTES_PER_SAMPLE;
    const dataBytes = samples.length * blockAlign;
    const bytes = new ArrayBuffer(WavEncoder.HEADER_BYTES + dataBytes);
    const view = new DataView(bytes);
    WavEncoder.writeText(view, 0, "RIFF");
    view.setUint32(4, WavEncoder.HEADER_BYTES - WavEncoder.RIFF_PREAMBLE_BYTES + dataBytes, true);
    WavEncoder.writeText(view, 8, "WAVE");
    WavEncoder.writeText(view, 12, "fmt ");
    view.setUint32(16, WavEncoder.FMT_CHUNK_BYTES, true);
    view.setUint16(20, WavEncoder.PCM_FORMAT, true);
    view.setUint16(22, WavEncoder.CHANNELS, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, WavEncoder.BITS_PER_SAMPLE, true);
    WavEncoder.writeText(view, 36, "data");
    view.setUint32(40, dataBytes, true);
    samples.forEach((sample, index) => {
      const clamped = Math.max(-1, Math.min(1, sample));
      const scale = clamped < 0 ? WavEncoder.INT16_NEGATIVE : WavEncoder.INT16_POSITIVE;
      view.setInt16(WavEncoder.HEADER_BYTES + index * blockAlign, Math.round(clamped * scale), true);
    });
    return bytes;
  }

  private static writeText(view: DataView, offset: number, text: string): void {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  }
}
