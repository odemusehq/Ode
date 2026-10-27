import { writeFile } from "node:fs/promises";
import { frameCount } from "./types";
import type { AudioData } from "./types";

/** Sample formats writeWav can produce. */
export enum WavBitDepth {
  Int16 = 16,
  Int24 = 24,
  Float32 = 32,
}

/** WAVE format tags (Microsoft RIFF specification). */
enum WaveFormatTag {
  Pcm = 1,
  IeeeFloat = 3,
}

const RIFF_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
/** fmt chunk size for integer PCM. */
const PCM_FMT_BYTES = 16;
/** fmt chunk size for non-PCM formats, which add a cbSize field and need a fact chunk. */
const FLOAT_FMT_BYTES = 18;
const FACT_BYTES = 4;

/** Writes little-endian RIFF fields in order. */
class RiffWriter {
  private offset = 0;
  private readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  tag(text: string): void {
    for (let i = 0; i < 4; i++) this.view.setUint8(this.offset + i, text.charCodeAt(i));
    this.offset += 4;
  }

  uint16(value: number): void {
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  uint32(value: number): void {
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  int16(value: number): void {
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  int24(value: number): void {
    this.view.setUint8(this.offset, value & 0xff);
    this.view.setUint8(this.offset + 1, (value >> 8) & 0xff);
    this.view.setUint8(this.offset + 2, (value >> 16) & 0xff);
    this.offset += 3;
  }

  float32(value: number): void {
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }
}

/**
 * Converts a sample to an integer at the given bit depth. Negative samples scale by 2^(bits−1) and positive ones by
 * 2^(bits−1) − 1, so −1…1 maps onto the whole integer range and decoding gives the same values back.
 */
function quantize(sample: number, bitDepth: WavBitDepth): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  const negativeScale = 2 ** (bitDepth - 1);
  return Math.round(clamped < 0 ? clamped * negativeScale : clamped * (negativeScale - 1));
}

/** Encodes audio as a WAV file: 16- or 24-bit integer PCM, or 32-bit float. */
export function encodeWav(audio: AudioData, bitDepth: WavBitDepth = WavBitDepth.Int24): Uint8Array {
  const channelCount = audio.channels.length;
  const frames = frameCount(audio);
  const blockAlign = channelCount * (bitDepth / 8);
  const dataBytes = frames * blockAlign;
  const isFloat = bitDepth === WavBitDepth.Float32;
  const fmtBytes = isFloat ? FLOAT_FMT_BYTES : PCM_FMT_BYTES;
  const factChunkBytes = isFloat ? CHUNK_HEADER_BYTES + FACT_BYTES : 0;
  const padding = dataBytes % 2;
  const totalBytes =
    RIFF_HEADER_BYTES + CHUNK_HEADER_BYTES + fmtBytes + factChunkBytes + CHUNK_HEADER_BYTES + dataBytes + padding;

  const writer = new RiffWriter(new Uint8Array(totalBytes));
  writer.tag("RIFF");
  writer.uint32(totalBytes - CHUNK_HEADER_BYTES);
  writer.tag("WAVE");
  writer.tag("fmt ");
  writer.uint32(fmtBytes);
  writer.uint16(isFloat ? WaveFormatTag.IeeeFloat : WaveFormatTag.Pcm);
  writer.uint16(channelCount);
  writer.uint32(audio.sampleRate);
  writer.uint32(audio.sampleRate * blockAlign);
  writer.uint16(blockAlign);
  writer.uint16(bitDepth);
  if (isFloat) {
    writer.uint16(0);
    writer.tag("fact");
    writer.uint32(FACT_BYTES);
    writer.uint32(frames);
  }
  writer.tag("data");
  writer.uint32(dataBytes);

  for (let i = 0; i < frames; i++) {
    for (const channel of audio.channels) {
      const sample = channel[i] ?? 0;
      if (bitDepth === WavBitDepth.Float32) writer.float32(sample);
      else if (bitDepth === WavBitDepth.Int24) writer.int24(quantize(sample, bitDepth));
      else writer.int16(quantize(sample, bitDepth));
    }
  }
  return writer.bytes;
}

/** Writes audio to a WAV file (24-bit integer PCM unless another bit depth is given). */
export async function writeWav(path: string, audio: AudioData, bitDepth: WavBitDepth = WavBitDepth.Int24): Promise<void> {
  await writeFile(path, encodeWav(audio, bitDepth));
}
