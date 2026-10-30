import assert from "node:assert/strict";
import { test } from "node:test";
import { ChordSymbol } from "../music/harmony/chord-symbol";
import { analyzeLine } from "../music/phonetics/line-analyzer";
import { prosodyCheck } from "../music/prosody/prosody-checker";
import { compareRhyme } from "../music/rhyme/rhyme-comparer";
import { RhymeKind } from "../music/rhyme/rhyme-kind";
import { rhymeScheme } from "../music/rhyme/rhyme-scheme";
import type { Note } from "../shared/live";

function note(start: number, duration: number): Note {
  return { pitch: 60, start, duration, velocity: 100 };
}

test('"every" can be sung with two or three syllables', () => {
  const every = analyzeLine("every time I fire", "us").words[0];
  const counts = every?.options.map((option) => option.syllables.length) ?? [];
  assert.ok(counts.includes(2) && counts.includes(3), `syllable counts of "every": ${counts.join(", ")}`);
});

test("bath and path rhyme in both accents; bath and math only in US English", () => {
  assert.equal(compareRhyme("bath", "path", "uk").kind, RhymeKind.Perfect);
  assert.equal(compareRhyme("bath", "path", "us").kind, RhymeKind.Perfect);
  assert.notEqual(compareRhyme("bath", "math", "uk").kind, RhymeKind.Perfect);
  assert.equal(compareRhyme("bath", "math", "us").kind, RhymeKind.Perfect);
});

test("light and night are a perfect rhyme", () => {
  assert.equal(compareRhyme("light", "night", "us").kind, RhymeKind.Perfect);
});

test("alternating rhymes give the scheme ABAB", () => {
  const lines = ["I saw the city lights", "and heard the river flow", "we danced away the nights", "and never let it go"];
  assert.deepEqual(rhymeScheme(lines, "us"), ["A", "B", "A", "B"]);
});

test("a stressed syllable on an off-beat after an unstressed downbeat is flagged", () => {
  const line = analyzeLine("guitar", "us");
  const inverted = prosodyCheck(line, [note(0, 1), note(1.5, 0.5)]);
  const natural = prosodyCheck(line, [note(0.5, 0.5), note(1, 1)]);
  assert.ok(inverted.issues.length > 0, "the inverted setting has an issue");
  assert.ok(inverted.score < natural.score, `inverted ${inverted.score}, natural ${natural.score}`);
});

test("half-diminished, diminished and minus chord signs give their own notes", () => {
  const names = (symbol: string) => ChordSymbol.parse(symbol)?.tones.map((tone) => tone.name).join(" ");
  assert.equal(names("Bø7"), "B D F A");
  assert.equal(names("C°7"), names("Cdim7"));
  assert.equal(names("C-7"), "C Eb G Bb");
});

test("delta chord names keep the requested upper extensions", () => {
  for (const extension of [7, 9, 13]) {
    const expected = ChordSymbol.parse(`Cmaj${extension}`)!;
    assert.deepEqual(ChordSymbol.parse(`CΔ${extension}`)?.tones, expected.tones);
  }
});

test("a year is sung in pairs first: 1975 as nineteen seventy-five", () => {
  const year = analyzeLine("back in 1975", "us").words[2];
  assert.equal(year?.options[0]?.syllables.length, 6);
  assert.equal(year?.certain, false);
});
