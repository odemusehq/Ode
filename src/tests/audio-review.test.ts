import assert from "node:assert/strict";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { encodeWav, WavBitDepth } from "../audio/wav";

test("exact stereo file metadata rejects truncation", () => {
  const left = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10) * 0.25);
  const audio = { sampleRate: 48_000, channels: [left, left.map((value) => -value)] };
  const bytes = encodeWav(audio, WavBitDepth.Int24);
  const decoder = new AudioFileDecoder();
  assert.deepEqual(decoder.inspect(bytes, "master.wav"), { format: "WAV", sampleRate: 48_000, channels: 2, channelLayout: "stereo", frames: 480, bitDepth: 24, encoding: "signed int" });
  assert.throws(() => decoder.decode(bytes.subarray(0, bytes.length - 1), "broken.wav"), /truncated/i);
});

test("WAV audio stays inside its declared RIFF container", () => {
  const original = encodeWav({ sampleRate: 8_000, channels: [Float32Array.of(0.25)] });
  const appended = Buffer.alloc(original.length + 12);
  appended.set(original);
  appended.write("data", original.length); appended.writeUInt32LE(3, original.length + 4);
  appended.writeIntLE(-4194304, original.length + 8, 3);
  const decoder = new AudioFileDecoder();
  assert.deepEqual(decoder.decode(appended, "appended.wav"), decoder.decode(original, "original.wav"));
  const layout = decoder.layout(appended, "appended.wav");
  assert.equal(layout.dataBytes, 3);
  layout.formatChunk[0] = 0;
  assert.equal(appended.toString("ascii", 12, 16), "fmt ", "Chunk metadata is detached from the original even for Buffer input.");
});

test("AIFF metadata after SSND cannot stand in for missing sound frames", () => {
  const bytes = Buffer.alloc(66);
  bytes.write("FORM"); bytes.writeUInt32BE(58, 4); bytes.write("AIFFCOMM", 8); bytes.writeUInt32BE(18, 16);
  bytes.writeUInt16BE(1, 20); bytes.writeUInt32BE(2, 22); bytes.writeUInt16BE(16, 26);
  bytes.set([0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0], 28);
  bytes.write("SSND", 38); bytes.writeUInt32BE(8, 42); // No sample payload.
  bytes.write("JUNK", 54); bytes.writeUInt32BE(4, 58);
  bytes.writeInt16BE(1000, 62); bytes.writeInt16BE(-1000, 64);
  const decoder = new AudioFileDecoder();
  assert.throws(() => decoder.decode(bytes, "missing.aiff"), /audio data is truncated/i);
  bytes.writeUInt32BE(1, 46);
  assert.throws(() => decoder.inspect(bytes, "offset.aiff"), /offset.*sound chunk/i);
});
