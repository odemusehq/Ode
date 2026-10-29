import assert from "node:assert/strict";
import { test } from "node:test";
import { loudness } from "../music/audio/loudness";
import { tuningOffset } from "../music/audio/tuning";
import { AudioFileDecoder } from "../music/audio/decode";
import { AudioMeasurement } from "../music/audio/measurement";
import { encodeWav, WavBitDepth } from "../music/audio/wav";

test("tuning estimates centred offsets rather than the first smoothing-bin edge", () => {
  for (const cents of [-49, -20, 0, 20, 49]) assert.ok(Math.abs(tuningOffset([{ midi: 60 + cents / 100, weight: 1 }]) - cents) < 0.6, String(cents));
});

test("finite-file loudness includes a sound in the final partial step", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(Math.round(sampleRate * 2.049));
  for (let i = sampleRate * 2; i < samples.length; i++) samples[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / sampleRate);
  const reading = loudness({ sampleRate, channels: [samples] });
  assert.ok(Number.isFinite(reading.integrated));
  assert.ok(Number.isFinite(reading.momentaryMax));
});

test("stereo diagnostics distinguish mono cancellation and exact file metadata rejects truncation", () => {
  const left = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10) * 0.25);
  const audio = { sampleRate: 48_000, channels: [left, left.map((value) => -value)] };
  const measurement = new AudioMeasurement(audio);
  assert.equal(measurement.stereo?.correlation, -1);
  assert.equal(measurement.stereo?.monoPowerRatioDb, -Infinity);
  const bytes = encodeWav(audio, WavBitDepth.Int24);
  const decoder = new AudioFileDecoder();
  assert.deepEqual(decoder.inspect(bytes, "master.wav"), { format: "WAV", sampleRate: 48_000, channels: 2, channelLayout: "stereo", frames: 480, bitDepth: 24, encoding: "signed int" });
  assert.throws(() => decoder.decode(bytes.subarray(0, bytes.length - 1), "broken.wav"), /truncated/i);
});
