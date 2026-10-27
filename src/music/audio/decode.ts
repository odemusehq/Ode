import { readFile } from "node:fs/promises";
import type { AudioData } from "./types";

enum SampleKind {
  UnsignedInt = "unsigned int",
  SignedInt = "signed int",
  Float = "float",
}

interface SampleEncoding {
  kind: SampleKind;
  bits: number;
  littleEndian: boolean;
}

interface PcmBlock {
  channels: number;
  sampleRate: number;
  encoding: SampleEncoding;
  /** Byte offset of the first frame and number of frames. */
  start: number;
  frames: number;
}

/** WAV format codes. */
const WAV_PCM = 1;
const WAV_FLOAT = 3;
const WAV_EXTENSIBLE = 0xfffe;

/**
 * Reads the audio files Ode works with: WAV (PCM, float, extensible) and AIFF / AIFF-C, which is what Live
 * renders and records. Other formats should be exported as WAV first.
 */
export class AudioFileDecoder {
  decode(bytes: Uint8Array, name: string): AudioData {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const form = AudioFileDecoder.fourCC(view, 0);
    const kind = AudioFileDecoder.fourCC(view, 8);
    let block: PcmBlock;
    if (form === "RIFF" && kind === "WAVE") block = this.wav(view, name);
    else if (form === "FORM" && (kind === "AIFF" || kind === "AIFC")) block = this.aiff(view, kind === "AIFC", name);
    else throw new Error(`${name}: Ode reads WAV and AIFF files; export the audio as WAV`);
    return { sampleRate: block.sampleRate, channels: AudioFileDecoder.samples(view, block) };
  }

  private wav(view: DataView, name: string): PcmBlock {
    let format: { code: number; channels: number; sampleRate: number; bits: number } | null = null;
    let data: { start: number; size: number } | null = null;
    for (let offset = 12; offset + 8 <= view.byteLength; ) {
      const id = AudioFileDecoder.fourCC(view, offset);
      const size = view.getUint32(offset + 4, true);
      const body = offset + 8;
      if (id === "fmt ") {
        let code = view.getUint16(body, true);
        if (code === WAV_EXTENSIBLE && size >= 26) code = view.getUint16(body + 24, true);
        format = { code, channels: view.getUint16(body + 2, true), sampleRate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true) };
      } else if (id === "data") {
        data = { start: body, size: Math.min(size, view.byteLength - body) };
      }
      offset = body + size + (size % 2);
    }
    if (!format || !data) throw new Error(`${name}: not a complete WAV file`);
    let kind: SampleKind;
    if (format.code === WAV_FLOAT) kind = SampleKind.Float;
    else if (format.code === WAV_PCM) kind = format.bits === 8 ? SampleKind.UnsignedInt : SampleKind.SignedInt;
    else throw new Error(`${name}: compressed WAV (format ${format.code}) isn't supported; export as PCM WAV`);
    const frameBytes = (format.bits / 8) * format.channels;
    return {
      channels: format.channels,
      sampleRate: format.sampleRate,
      encoding: { kind, bits: format.bits, littleEndian: true },
      start: data.start,
      frames: Math.floor(data.size / frameBytes),
    };
  }

  private aiff(view: DataView, compressed: boolean, name: string): PcmBlock {
    let common: { channels: number; frames: number; bits: number; sampleRate: number; compression: string } | null = null;
    let soundStart = -1;
    for (let offset = 12; offset + 8 <= view.byteLength; ) {
      const id = AudioFileDecoder.fourCC(view, offset);
      const size = view.getUint32(offset + 4, false);
      const body = offset + 8;
      if (id === "COMM") {
        common = {
          channels: view.getInt16(body, false),
          frames: view.getUint32(body + 2, false),
          bits: view.getInt16(body + 6, false),
          sampleRate: AudioFileDecoder.extended(view, body + 8),
          compression: compressed ? AudioFileDecoder.fourCC(view, body + 18) : "NONE",
        };
      } else if (id === "SSND") {
        soundStart = body + 8 + view.getUint32(body, false);
      }
      offset = body + size + (size % 2);
    }
    if (!common || soundStart < 0) throw new Error(`${name}: not a complete AIFF file`);
    const encodings: Record<string, SampleEncoding> = {
      NONE: { kind: SampleKind.SignedInt, bits: common.bits, littleEndian: false },
      sowt: { kind: SampleKind.SignedInt, bits: common.bits, littleEndian: true },
      fl32: { kind: SampleKind.Float, bits: 32, littleEndian: false },
      FL32: { kind: SampleKind.Float, bits: 32, littleEndian: false },
      fl64: { kind: SampleKind.Float, bits: 64, littleEndian: false },
      FL64: { kind: SampleKind.Float, bits: 64, littleEndian: false },
    };
    const encoding = encodings[common.compression];
    if (!encoding) throw new Error(`${name}: compressed AIFF ("${common.compression}") isn't supported; export as WAV`);
    return { channels: common.channels, sampleRate: common.sampleRate, encoding, start: soundStart, frames: common.frames };
  }

  private static samples(view: DataView, block: PcmBlock): Float32Array[] {
    const bytes = block.encoding.bits / 8;
    const channels = Array.from({ length: block.channels }, () => new Float32Array(block.frames));
    for (let frame = 0; frame < block.frames; frame++) {
      for (let channel = 0; channel < block.channels; channel++) {
        const offset = block.start + (frame * block.channels + channel) * bytes;
        if (offset + bytes > view.byteLength) return channels;
        channels[channel]![frame] = AudioFileDecoder.sample(view, offset, block.encoding);
      }
    }
    return channels;
  }

  private static sample(view: DataView, offset: number, { kind, bits, littleEndian }: SampleEncoding): number {
    if (kind === SampleKind.Float) return bits === 64 ? view.getFloat64(offset, littleEndian) : view.getFloat32(offset, littleEndian);
    if (kind === SampleKind.UnsignedInt) return (view.getUint8(offset) - 128) / 128;
    switch (bits) {
      case 16:
        return view.getInt16(offset, littleEndian) / 0x8000;
      case 24: {
        const [b0, b1, b2] = [view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2)];
        const value = littleEndian ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
        return (value & 0x800000 ? value - 0x1000000 : value) / 0x800000;
      }
      case 32:
        return view.getInt32(offset, littleEndian) / 0x80000000;
      case 8:
        return view.getInt8(offset) / 0x80;
      default:
        throw new Error(`${bits}-bit audio isn't supported`);
    }
  }

  /** AIFF sample rates are 80-bit IEEE extended floats. */
  private static extended(view: DataView, offset: number): number {
    const signAndExponent = view.getUint16(offset, false);
    const high = view.getUint32(offset + 2, false);
    const low = view.getUint32(offset + 6, false);
    const exponent = (signAndExponent & 0x7fff) - 16383;
    const value = (high * 2 ** 32 + low) * 2 ** (exponent - 63);
    return signAndExponent & 0x8000 ? -value : value;
  }

  private static fourCC(view: DataView, offset: number): string {
    if (offset + 4 > view.byteLength) return "";
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  }
}

const decoder = new AudioFileDecoder();

/** Decodes a WAV or AIFF file into floating-point samples per channel. */
export async function decode(path: string): Promise<AudioData> {
  const audio = decoder.decode(await readFile(path), path);
  if (audio.channels.length === 0 || !audio.sampleRate) throw new Error(`${path}: the file holds no samples`);
  return audio;
}
