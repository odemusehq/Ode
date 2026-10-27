import assert from "node:assert/strict";
import { test } from "node:test";
import { loudness } from "../music/audio/loudness";

const SAMPLE_RATE = 48_000;
const TOLERANCE_LU = 0.3;

/** A sine with the given RMS level (peak = RMS × √2). */
function sine(frequency: number, rms: number, seconds: number): Float32Array {
  const amplitude = rms * Math.SQRT2;
  return Float32Array.from({ length: SAMPLE_RATE * seconds }, (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE));
}

test("a 1 kHz sine with RMS 0.1 reads −20 LUFS in mono", () => {
  const reading = loudness({ sampleRate: SAMPLE_RATE, channels: [sine(1000, 0.1, 5)] });
  assert.ok(Math.abs(reading.integrated + 20) <= TOLERANCE_LU, `${reading.integrated} LUFS`);
});

test("the same sine on both stereo channels reads about −17 LUFS (EBU Tech 3341)", () => {
  const channel = sine(1000, 0.1, 5);
  const reading = loudness({ sampleRate: SAMPLE_RATE, channels: [channel, channel] });
  assert.ok(Math.abs(reading.integrated + 16.99) <= TOLERANCE_LU, `${reading.integrated} LUFS`);
});
