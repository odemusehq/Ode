import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildLibraryProfile } from "../music/audio/library-profile";
import { encodeWav, WavBitDepth } from "../music/audio/wav";

test("library profiles bind exact whole-file metadata and retain unrounded measured values only on request", () => {
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
  const full = buildLibraryProfile(bytes, "full");
  assert.equal(full.sha256, metadata.sha256);
  assert.equal(full.sampleValues, "validated-finite");
  assert.equal(full.measurements?.samplePeakDbfs, 20 * Math.log10(0.25));
  assert.ok(Number.isFinite(full.measurements?.integratedLufs));
  assert.equal(full.report?.samplePeakDbfs, -12);
});

test("full profiles reject damaged samples and retain silence or unsupported-layout coverage", () => {
  const bytes = encodeWav({ sampleRate: 8_000, channels: [new Float32Array(4_000)] }, WavBitDepth.Float32);
  const dataOffset = Buffer.from(bytes).indexOf("data") + 8;
  new DataView(bytes.buffer).setFloat32(dataOffset, Number.NaN, true);
  assert.equal(buildLibraryProfile(bytes).sampleValues, "unexamined");
  assert.throws(() => buildLibraryProfile(bytes, "full"), /nonfinite/);
  const silence = buildLibraryProfile(encodeWav({ sampleRate: 8_000, channels: [new Float32Array(4_000)] }, WavBitDepth.Int16), "full");
  assert.equal(silence.measurements?.integratedLufs, null);
  assert.equal(silence.measurements?.samplePeakDbfs, null);
  assert.equal(silence.measurements?.loudnessStatus, "below loudness gates");
  const samples = Float32Array.from({ length: 4_000 }, (_, index) => Math.sin(index / 10) * 0.25);
  const surround = buildLibraryProfile(encodeWav({ sampleRate: 8_000, channels: [samples, samples, samples] }, WavBitDepth.Int16), "full");
  assert.equal(surround.measurements?.integratedLufs, null);
  assert.match(surround.measurements?.loudnessStatus ?? "", /unsupported/);
  assert.match(surround.measurements?.coverage ?? "", /channel roles are unknown/);
});
