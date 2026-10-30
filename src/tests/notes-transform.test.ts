import assert from "node:assert/strict";
import { test } from "node:test";
import { transformNotes } from "../music/parts/note-transformer";
import type { Note } from "../shared/live";

const source: Note[] = [
  { pitch: 64, start: 2.93, duration: 0.7, velocity: 101, muted: true, probability: 0.7, velocityDeviation: 4, releaseVelocity: 56 },
  { pitch: 60, start: 0.06, duration: 1.13, velocity: 87, probability: 0, releaseVelocity: 32 },
  { pitch: 67, start: 1.11, duration: 0.29, velocity: 95 },
];

test("whole-part transforms preserve order, performance fields and exact explicit timing", () => {
  const before = structuredClone(source);
  const transformed = transformNotes(source, { transposeSemitones: -12, timeScale: 1.5, timeOffsetBeats: 0.125 });
  assert.deepEqual(transformed.transformation, { transposeSemitones: -12, timeScale: 1.5, timeOffsetBeats: 0.125, anchorBeat: 0 });
  assert.deepEqual(transformed.notes, source.map((note) => ({ ...note, pitch: note.pitch - 12,
    start: note.start * 1.5 + 0.125, duration: note.duration * 1.5 })));
  assert.equal(transformed.noteEndBeats, Math.max(...transformed.notes.map((note) => note.start + note.duration)));
  assert.deepEqual(source, before);
  assert.equal(Object.hasOwn(transformed.notes[2]!, "releaseVelocity"), false);
  transformed.notes[0]!.velocity = 1;
  assert.deepEqual(source, before);
  assert.deepEqual(transformNotes(source, { timeOffsetBeats: -0.03 }).notes, source.map((note) => ({ ...note, start: note.start - 0.03 })));
});

test("invalid or unchanged whole-part transforms refuse without partial material", () => {
  const before = structuredClone(source);
  for (const transform of [{}, { transposeSemitones: 0, timeScale: 1, timeOffsetBeats: 0 },
    { transposeSemitones: -65 }, { transposeSemitones: 68 }, { transposeSemitones: 0.5 },
    { timeScale: 0 }, { timeScale: -1 }, { timeScale: Infinity }, { timeScale: NaN },
    { timeScale: Number.MIN_VALUE }, { timeScale: Number.MAX_VALUE },
    { timeOffsetBeats: -0.061 }, { timeOffsetBeats: Infinity }, { timeOffsetBeats: NaN },
    { timeOffsetBeats: 0.01, unknown: true }]) {
    assert.throws(() => transformNotes(source, transform as never));
    assert.deepEqual(source, before);
  }
  assert.throws(() => transformNotes([], { transposeSemitones: 1 }));
  assert.throws(() => transformNotes([{ ...source[0]!, duration: NaN }], { transposeSemitones: 1 }));
  assert.throws(() => transformNotes([{ pitch: 60, start: 1, duration: 1 }], { timeScale: 1e308 }),
    "Finite fields whose combined note end overflows cannot provide a usable clip extent.");
  assert.throws(() => transformNotes([{ pitch: 60, start: 1e20, duration: 1 }], { timeOffsetBeats: 0.01 }),
    "A transform rounded away by numeric precision does not justify a rewrite.");
});
