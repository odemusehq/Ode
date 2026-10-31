import assert from "node:assert/strict";
import { test } from "node:test";
import { audioExcerpt } from "../audio/excerpt";

test("provider excerpts keep exact selected source frames and reject empty or extended ranges", () => {
  const left = Float32Array.of(0.1, 0.2, 0.3, 0.4);
  const source = { sampleRate: 4, channels: [left, left.map((sample) => -sample)] };
  const selected = audioExcerpt(source, 0.25, 0.75);
  assert.deepEqual(selected.audio.channels[0], left.subarray(1, 3));
  assert.deepEqual(selected.audio.channels[1], source.channels[1]!.subarray(1, 3));
  assert.equal(selected.range.firstFrame, 1);
  assert.equal(selected.range.endFrame, 3);
  assert.equal(selected.range.sourceFrames, 4);
  assert.throws(() => audioExcerpt(source, 0, 0.01), /no sample frames/);
  assert.throws(() => audioExcerpt(source, 0, 2), /within this recording/);
});
