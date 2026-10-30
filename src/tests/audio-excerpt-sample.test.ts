import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LocalAudioFiles } from "../live/local-audio-files";
import { AudioFileDecoder } from "../music/audio/decode";
import { extractAudio } from "../music/audio/extract";

function wav(format: 1 | 3, bits: 32 | 64, frames: number[][]) {
  const channels = frames[0]?.length ?? 2, width = bits / 8;
  const dataBytes = frames.length * channels * width;
  const fmtBytes = format === 3 ? 18 : 16;
  const dataHeader = 20 + fmtBytes + (format === 3 ? 12 : 0), firstSample = dataHeader + 8;
  const bytes = Buffer.alloc(firstSample + dataBytes + 12);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(fmtBytes, 16); bytes.writeUInt16LE(format, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(8_000, 24); bytes.writeUInt32LE(8_000 * channels * width, 28);
  bytes.writeUInt16LE(channels * width, 32); bytes.writeUInt16LE(bits, 34);
  if (format === 3) { bytes.write("fact", 20 + fmtBytes); bytes.writeUInt32LE(4, 24 + fmtBytes); bytes.writeUInt32LE(frames.length, 28 + fmtBytes); }
  bytes.write("data", dataHeader); bytes.writeUInt32LE(dataBytes, dataHeader + 4);
  frames.flat().forEach((sample, index) => {
    const offset = firstSample + index * width;
    if (format === 1) bytes.writeInt32LE(sample, offset);
    else if (bits === 64) bytes.writeDoubleLE(sample, offset);
    else bytes.writeFloatLE(sample, offset);
  });
  bytes.write("JUNK", firstSample + dataBytes); bytes.writeUInt32LE(4, firstSample + dataBytes + 4); bytes.write("cue!", firstSample + dataBytes + 8);
  return bytes;
}

function chunks(bytes: Uint8Array, littleEndian = true) {
  const buffer = Buffer.from(bytes), found = new Map<string, Buffer>();
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const size = littleEndian ? buffer.readUInt32LE(offset + 4) : buffer.readUInt32BE(offset + 4);
    found.set(buffer.toString("ascii", offset, offset + 4), buffer.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size + size % 2;
  }
  return found;
}

test("local excerpts preserve exact PCM32/Float64/AIFF frames and omit stale ancillary metadata", () => {
  const fixtures = [
    wav(1, 32, [[0, 0], [2147483647, -2147483648], [2147483646, -2147483647], [17, -19], [0, 0]]),
    wav(3, 64, [[0, 0], [Math.PI, -1.25], [1 + Number.EPSILON, -2], [0.25, 0.75], [0, 0]]),
  ];
  for (const source of fixtures) {
    const before = Buffer.from(source), sourceChunks = chunks(source);
    const selected = extractAudio(source, 1, 4);
    const outputChunks = chunks(selected.bytes);
    const blockAlign = source.readUInt16LE(32);
    assert.ok(outputChunks.get("data")!.equals(sourceChunks.get("data")!.subarray(blockAlign, 4 * blockAlign)), "Selected interleaved frame bytes must survive without a Float32 or listening-encoder roundtrip.");
    assert.ok(source.equals(before), "The uploaded source must remain untouched.");
    assert.equal(outputChunks.has("JUNK"), false);
    assert.equal(selected.output.frames, 3);
    assert.equal(selected.output.bitDepth, source.readUInt16LE(34));
    assert.equal(selected.output.sampleRate, 8_000);
    assert.equal(selected.output.channels, 2);
    if (outputChunks.has("fact")) assert.equal(outputChunks.get("fact")!.readUInt32LE(0), 3);
    assert.deepEqual(selected.selection, { firstFrame: 1, endFrame: 4 });
    assert.equal(Buffer.from(selected.bytes).readUInt32LE(4) + 8, selected.bytes.length);
    assert.equal(new AudioFileDecoder().inspect(selected.bytes, "excerpt.wav").frames, 3);
  }

  const aiff = Buffer.alloc(88);
  aiff.write("FORM"); aiff.writeUInt32BE(80, 4); aiff.write("AIFFCOMM", 8); aiff.writeUInt32BE(18, 16);
  aiff.writeUInt16BE(2, 20); aiff.writeUInt32BE(5, 22); aiff.writeUInt16BE(16, 26);
  aiff.set([0x40, 0x0b, 0xfa, 0x04, 0, 0, 0, 0, 0, 0], 28); // 8000.5 Hz, preserved as extended80.
  aiff.write("SSND", 38); aiff.writeUInt32BE(30, 42); aiff.writeUInt32BE(2, 46);
  [0, 0, 32767, -32768, 32766, -32767, 17, -19, 0, 0].forEach((value, index) => aiff.writeInt16BE(value, 56 + index * 2));
  aiff.write("JUNK", 76); aiff.writeUInt32BE(4, 80); aiff.write("cue!", 84);
  const before = Buffer.from(aiff), selected = extractAudio(aiff, 1, 4), output = chunks(selected.bytes, false);
  assert.ok(output.get("SSND")!.subarray(8).equals(aiff.subarray(60, 72)));
  assert.equal(output.get("COMM")!.readUInt32BE(2), 3);
  assert.equal(output.get("SSND")!.readBigUInt64BE(0), 0n, "New SSND offset and block size must be reset.");
  assert.equal(selected.output.sampleRate, 8000.5);
  assert.equal(selected.container, "AIFF");
  assert.equal(output.has("JUNK"), false);
  assert.ok(aiff.equals(before));
});

test("local excerpts reject empty, noninteger, out-of-range and nonfinite material", () => {
  const source = wav(3, 32, [[0, 0], [1.5, -1.25], [0, 0]]);
  for (const [start, end] of [[1, 1], [-1, 1], [0, 4], [0.5, 2], [0, Infinity]]) {
    assert.throws(() => extractAudio(source, start!, end!));
  }
  assert.throws(() => extractAudio(wav(3, 32, [[0, 0], [NaN, 0]]), 1, 2), /nonfinite|finite/i);
  assert.throws(() => extractAudio(wav(1, 32, []), 0, 1));
  assert.throws(() => extractAudio(Buffer.from("ID3unsupported"), 0, 1));
});

test("managed excerpts round explicit seconds to source frames and retain their own derivation", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-sample-excerpt-"));
  try {
    const audio = new LocalAudioFiles(root, join(root, "work"));
    const bytes = wav(1, 32, [[0, 0], [2147483647, -2147483648], [2147483646, -2147483647], [17, -19], [0, 0]]);
    const source = await audio.add({ name: "Take.wav", bytes, purpose: "library", source: "Musician's recording", range: { start: 16, end: 32 } });
    const exchangeId = randomUUID();
    const excerpt = await audio.excerpt({ audioId: source.id, name: "Chosen hit.wav", selection: { unit: "seconds", from: 1.49 / 8_000, to: 3.51 / 8_000 }, exchangeId }, extractAudio);
    assert.equal(excerpt.provenance, "local-excerpt");
    assert.equal(excerpt.range, undefined, "Original declared Arrangement beats are not selected source-file seconds.");
    assert.equal(excerpt.derivation?.sourceSha256, source.sha256);
    assert.equal(excerpt.derivation?.sourceAudioId, source.id);
    assert.equal(excerpt.derivation?.exchangeId, exchangeId);
    assert.deepEqual([excerpt.derivation?.firstFrame, excerpt.derivation?.endFrame, excerpt.derivation?.output.frames], [1, 4, 3]);
    const saved = await audio.readVerified(excerpt.id);
    assert.ok(chunks(saved.bytes).get("data")!.equals(chunks(bytes).get("data")!.subarray(8, 32)));
    assert.ok(Buffer.from((await audio.readVerified(source.id)).bytes).equals(bytes));
  } finally { await rm(root, { recursive: true, force: true }); }
});
