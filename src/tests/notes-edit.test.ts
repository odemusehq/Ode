import assert from "node:assert/strict";
import { test } from "node:test";
import { editNotes } from "../music/parts/note-editor";
import type { Note } from "../shared/live";

const source: Note[] = [
  { pitch: 64, start: 2.93, duration: 0.7, velocity: 101, muted: true, probability: 0.7, velocityDeviation: 4, releaseVelocity: 56 },
  { pitch: 60, start: 0.06, duration: 1.13, velocity: 87, probability: 0, releaseVelocity: 32 },
  { pitch: 67, start: 1.11, duration: 0.29, velocity: 95 },
  { pitch: 72, start: 4, duration: 0.8, velocity: 102, probability: 0.3, velocityDeviation: -2 },
];

test("precise edits use original indices and preserve unselected fields, order and wire absence", () => {
  const before = structuredClone(source), added = { pitch: 58, start: 0.03, duration: 0.25, velocity: 70 };
  const result = editNotes(source, { updates: [{ index: 3, set: { velocity: 88 } },
    { index: 1, set: { pitch: 61, start: 0.11, duration: 0.31, velocity: 72 }, clear: ["releaseVelocity"] }], remove: [2], add: [added] });
  assert.deepEqual(result.sourceToOutput, [0, 1, null, 2]);
  assert.deepEqual(result.updatedSourceIndices, [1, 3]);
  assert.deepEqual(result.removedSourceIndices, [2]);
  assert.deepEqual(result.addedOutputIndices, [3]);
  assert.deepEqual(result.notes[0], source[0]);
  assert.deepEqual(result.notes[1], { pitch: 61, start: 0.11, duration: 0.31, velocity: 72, probability: 0 });
  assert.equal(Object.hasOwn(result.notes[1]!, "releaseVelocity"), false);
  assert.deepEqual(result.notes[2], { ...source[3], velocity: 88 });
  assert.deepEqual(result.notes[3], added);
  assert.deepEqual(source, before);
  result.notes[0]!.velocity = 1;
  assert.deepEqual(source, before, "Returned rows must not alias the original notes.");
  assert.deepEqual(editNotes(source, { remove: [0, 1, 2, 3] }).notes, []);
});

test("ambiguous, invalid and empty precise edits refuse atomically", () => {
  const before = structuredClone(source);
  const invalid = [
    {}, { updates: [{ index: 0, set: {} }] }, { updates: [{ index: 0, set: { velocity: undefined } }] },
    { updates: [{ index: 0, set: { velocity: 101 } }] },
    { updates: [{ index: 0, set: { pitch: 60 } }, { index: 0, set: { pitch: 61 } }] },
    { remove: [0, 0] }, { remove: [4] }, { updates: [{ index: -1, set: { velocity: 70 } }] },
    { updates: [{ index: 0.5, set: { velocity: 70 } }] },
    { updates: [{ index: 0, set: { velocity: 70 } }], remove: [0] },
    { updates: [{ index: 0, clear: ["pitch"] }] }, { updates: [{ index: 0, clear: ["velocity", "velocity"] }] },
    { updates: [{ index: 0, set: { velocity: 70 }, clear: ["velocity"] }] },
    { updates: [{ index: 0, set: { duration: 0 } }] }, { updates: [{ index: 0, set: { start: -0.1 } }] },
    { updates: [{ index: 0, set: { velocity: NaN } }] }, { updates: [{ index: 0, set: { pitch: 128 } }] },
    { updates: [{ index: 0, set: { tuning: 5 } }] }, { add: [{ pitch: 60, start: 0, duration: 1, probability: 2 }] },
  ];
  for (const edit of invalid) {
    assert.throws(() => editNotes(source, edit as never));
    assert.deepEqual(source, before);
  }
});
