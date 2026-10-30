import assert from "node:assert/strict";
import { test } from "node:test";
import { MusicalKey } from "../music/harmony/musical-key";
import { MelodyVariation } from "../music/melody/melody-plan";
import { varyMelody, varyMelodyWithSelection } from "../music/melody/melody-varier";
import type { Note } from "../shared/live";

const source: Note[] = [
  { pitch: 72, start: 0.06, duration: 0.93, velocity: 103, probability: 0.7, velocityDeviation: 4, releaseVelocity: 66 },
  { pitch: 60, start: 0.06, duration: 0.75, velocity: 65, probability: 0.4, releaseVelocity: 39 },
  { pitch: 76, start: 1.11, duration: 0.7, velocity: 91, muted: true, probability: 0.3, velocityDeviation: -5, releaseVelocity: 47 },
  { pitch: 74, start: 2.93, duration: 0.8, velocity: 88, probability: 0.8, releaseVelocity: 60 },
];

test("melody variation refuses a lossy co-onset reduction unless the intended line is selected", () => {
  assert.throws(() => varyMelody(source, MelodyVariation.Rhythm, 1), /select|simultaneous|ambiguous|onset/i);
  assert.throws(() => varyMelody([source[0]!, { ...source[3]!, start: 0.0605 }], MelodyVariation.Rhythm, 1), /select|simultaneous|ambiguous|onset/i);
  assert.throws(() => varyMelody([{ pitch: 0, start: 0, duration: 1 }, { pitch: 4, start: 1, duration: 1 }],
    MelodyVariation.Contour, 1, undefined, MusicalKey.ofMajor(0)), /MIDI.*0.*127/i);
});

test("explicit melody selection returns complete material with muted and unselected notes unchanged", () => {
  const before = structuredClone(source);
  const result = varyMelodyWithSelection(source, MelodyVariation.Contour, 1, undefined, MusicalKey.ofMajor(0), [0, 3]);
  assert.deepEqual(result.selectedSourceIndices, [0, 3]);
  assert.deepEqual(result.preservedSourceIndices, [1, 2]);
  assert.equal(result.notes.length, source.length);
  assert.deepEqual(result.notes.find((note) => note.pitch === 60), source[1]);
  assert.deepEqual(result.notes.find((note) => note.muted), source[2]);
  assert.notEqual(result.notes.find((note) => note.start === source[3]!.start)!.pitch, source[3]!.pitch);
  assert.deepEqual(source, before);
  assert.deepEqual(varyMelody(source, MelodyVariation.Contour, 1, undefined, MusicalKey.ofMajor(0), [0, 3]), result.notes);
});

test("legato timing remains valid and source selections reject invalid or muted indices", () => {
  const legato = [{ ...source[0]!, duration: 1.5 }, { ...source[3]!, start: 1.11 }, source[2]!];
  const result = varyMelodyWithSelection(legato, MelodyVariation.Contour, 1, undefined, MusicalKey.ofMajor(0));
  assert.deepEqual(result.selectedSourceIndices, [0, 1]);
  assert.deepEqual(result.preservedSourceIndices, [2]);
  for (const original of legato) {
    const note = result.notes.find((value) => value.start === original.start && Boolean(value.muted) === Boolean(original.muted))!;
    assert.equal(note.start, original.start);
    assert.equal(note.duration, original.duration);
  }
  for (const indices of [[0, 0], [-1], [0.5], [4], [2]]) {
    assert.throws(() => varyMelodyWithSelection(source, MelodyVariation.Contour, 1, undefined, MusicalKey.ofMajor(0), indices), /index|indices|muted/i);
  }
});
