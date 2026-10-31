import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildLibraryProfile } from "../audio/library-profile";
import { encodeWav, WavBitDepth } from "../audio/wav";

test("library header profiles bind exact bytes without signal measurements", () => {
  const sampleRate = 8_000;
  const samples = Float32Array.from({ length: 4_000 }, (_, index) => 0.25 * Math.sin(2 * Math.PI * 1_000 * index / sampleRate));
  const bytes = encodeWav({ sampleRate, channels: [samples] }, WavBitDepth.Int24);
  const metadata = buildLibraryProfile(bytes);
  assert.equal(metadata.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(metadata.bytes, bytes.length);
  assert.equal(metadata.frames, 4_000);
  assert.equal(metadata.durationSeconds, 0.5);
  assert.equal(metadata.sampleRate, 8_000);
  assert.equal(metadata.sampleValues, "unexamined");
  assert.equal(metadata.measurements, undefined);
  assert.throws(() => buildLibraryProfile(bytes, "full" as never), /backend|metadata/i);
});
