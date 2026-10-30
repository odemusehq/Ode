import assert from "node:assert/strict";
import { test } from "node:test";
import { ChordVocabulary } from "../music/harmony/chord-vocabulary";
import { Harmonizer } from "../music/harmony/harmonizer";
import { ChordFamily } from "../music/harmony/harmony-style";
import { MusicalKey } from "../music/harmony/musical-key";
import { Contour, Register } from "../music/melody/melody-plan";
import type { Note } from "../shared/live";
import type { ToolContext } from "../tools/define";
import { melodyWriteTool } from "../tools/music/melody-write";
import { notesCheckTool } from "../tools/music/notes-check";

const signature = { numerator: 4, denominator: 4 as const };
const ctx = { song: { read: async () => ({}) }, prefs: { effective: async () => ({ pronunciation: "uk", genre: null, vocalRange: null }) },
  snapshots: { latest: { song: { tempo: 120, scaleMode: false }, signature } } } as unknown as ToolContext;
const named = [
  ["Whole Tone", [0, 2, 4, 6, 8, 10]],
  ["Harmonic Minor", [0, 2, 3, 5, 7, 8, 11]],
  ["Major Pentatonic", [0, 2, 4, 7, 9]],
  ["Minor Pentatonic", [0, 3, 5, 7, 10]],
] as const;

test("named nonmodal scales reach melody drafting and note checks without parent substitution", async () => {
  for (const [scale, intervals] of named) {
    const key = { root: 0, scale };
    const drafted = await melodyWriteTool.run({ bars: 8, contour: Contour.Arch, register: Register.Mid,
      density: 2, key, range: { low: 60, high: 84 }, timeSignature: signature, seed: 3 }, ctx) as { notes: Note[]; key: { name: string } };
    assert.ok(drafted.notes.length > 0);
    assert.ok(drafted.notes.every((note) => (intervals as readonly number[]).includes(note.pitch % 12)), scale);
    assert.equal(drafted.key.name.toLowerCase(), `c ${scale.toLowerCase()}`);
    const chromatic = Array.from({ length: 12 }, (_, pitch) => ({ pitch: pitch + 60, start: pitch, duration: 0.5, probability: 0.7 }));
    const before = structuredClone(chromatic);
    const check = await notesCheckTool.run({ notes: chromatic, key }, ctx) as { key: { key: string; outOfKey: { midi: number }[] }; passed: boolean };
    assert.equal(check.key.key.toLowerCase(), `c ${scale.toLowerCase()}`);
    assert.deepEqual(check.key.outOfKey.map((note) => note.midi), chromatic.filter((note) => !(intervals as readonly number[]).includes(note.pitch % 12)).map((note) => note.pitch));
    assert.equal(check.passed, false, "A reported chromatic note is a finding, not an instruction to rewrite it.");
    assert.deepEqual(chromatic, before);
  }
  await assert.rejects(melodyWriteTool.run({ bars: 1, contour: Contour.Static, register: Register.Mid, density: 1,
    key: { root: 0, scale: "Definitely Not A Scale" }, timeSignature: signature }, ctx), /scale|unsupported|recogn/i);
  await assert.rejects(notesCheckTool.run({ notes: [{ pitch: 60, start: 0, duration: 1 }], key: { root: 0, scale: "Definitely Not A Scale" } }, ctx), /scale|unsupported|recogn/i);
});

test("explicit custom pitch sets are authoritative, detached and honestly labelled", () => {
  const intervals = [0, 2, 4, 6, 8, 10];
  const key = MusicalKey.from({ root: 2, scale: "Artist collection", intervals });
  const originalSpec = key.spec;
  assert.deepEqual(key.scale, [2, 4, 6, 8, 10, 0]);
  assert.equal(key.label.toLowerCase(), "d artist collection");
  intervals[1] = 1;
  assert.deepEqual(key.spec, originalSpec);
  const returned = key.spec;
  returned.intervals![0] = 11;
  assert.deepEqual(key.spec, originalSpec);
  assert.deepEqual(MusicalKey.from(originalSpec).scale, key.scale);
  for (const invalid of [[], [0, 0, 7], [0, NaN], [0, 1.5], [-1, 0], [0, 12]]) {
    assert.throws(() => MusicalKey.from({ root: 0, scale: "Major", intervals: invalid }), /interval|scale|pitch/i);
  }
  assert.deepEqual(MusicalKey.from({ root: 0, scale: "Tonic omitted", intervals: [2, 4, 7] }).scale, [2, 4, 7]);
  const unordered = [7, 0, 11, 4, 2, 9, 5];
  const ordered = MusicalKey.from({ root: 0, scale: "Unordered declaration", intervals: unordered });
  assert.deepEqual(ordered.scale, [0, 2, 4, 5, 7, 9, 11]);
  assert.equal(ordered.degreeOf(4), 2);
  assert.deepEqual(ordered.spec.intervals, unordered);
  assert.deepEqual(MusicalKey.from({ root: 0, scale: "Natural Minor" }).scale, MusicalKey.ofMinor(0).scale);
  assert.deepEqual(MusicalKey.from({ root: 0, scale: "Ionian" }).scale, MusicalKey.ofMajor(0).scale);
});

test("functional harmony uses actual modal pitches and preserves deliberate borrowed colours", () => {
  for (const [scale] of named) {
    const key = MusicalKey.from({ root: 0, scale });
    assert.throws(() => key.triads(), /mode|modal|harmon|support/i);
    assert.throws(() => key.sevenths(), /mode|modal|harmon|support/i);
    assert.throws(() => new Harmonizer(key), /mode|modal|harmon|support/i);
  }
  const major = MusicalKey.from({ root: 0, scale: "An artist's minor label", intervals: [0, 2, 4, 5, 7, 9, 11] });
  assert.equal(major.mode, "ionian");
  assert.equal(major.minor, false);
  assert.deepEqual(major.triads(), ["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);
  const candidates = new ChordVocabulary(major).build();
  assert.ok(candidates.some((entry) => entry.family === ChordFamily.Borrowed && entry.symbol === "Ab"));
  assert.ok(candidates.some((entry) => entry.family === ChordFamily.SecondaryDominant));
  const minor = MusicalKey.ofMinor(0);
  assert.ok(new ChordVocabulary(minor).build().some((entry) => entry.symbol === "G7"));
  const lead = [{ pitch: 60, start: 0, duration: 4 }, { pitch: 67, start: 4, duration: 4 }];
  assert.ok(new Harmonizer(major).progressions(lead).length > 0);
  assert.ok(new Harmonizer(minor).progressions(lead).length > 0);
});
