import assert from "node:assert/strict";
import { test } from "node:test";
import { ChordSymbol } from "../music/harmony/chord-symbol";
import { ChordVoicer } from "../music/harmony/chord-voicer";
import { MusicalKey } from "../music/harmony/musical-key";
import { writeMelody } from "../music/melody/melody-writer";
import { Contour, Register } from "../music/melody/melody-plan";
import { PartChecker } from "../music/parts/part-checker";
import { Meter } from "../music/prosody/meter";
import { bassline } from "../music/rhythm/bassline-writer";
import { harmonyLines } from "../music/vocals/harmony-lines";

test("melody respects a narrow singer range and rejects inverted bounds", () => {
  const plan = { bars: 2, signature: { numerator: 4, denominator: 4 }, contour: Contour.Rising, register: Register.High, density: 1, key: { root: 0, scale: "Major" }, seed: 1 };
  const chords = [{ beat: 0, lengthBeats: 8, symbol: "C" }];
  assert.ok(writeMelody(plan, chords, { low: 60, high: 62 }).every((note) => note.pitch >= 60 && note.pitch <= 62));
  assert.throws(() => writeMelody(plan, chords, { low: 62, high: 60 }), /range/i);
});

test("infeasible voicing and upper harmony stay visible instead of escaping bounds", () => {
  const chords = [{ beat: 0, lengthBeats: 4, symbol: "C" }];
  assert.throws(() => new ChordVoicer({ low: 60, high: 64 }, { bass: false }).voice(chords), /range|register/i);
  assert.throws(() => harmonyLines([{ pitch: 72, start: 0, duration: 1 }], chords, 1, { low: 69, high: 72 }, new Meter(), MusicalKey.from({ root: 0, scale: "Major" })), /harmony|range/i);
});

test("root-fifth follows the chord quality and walking bass stops at each event", () => {
  for (const symbol of ["Bdim", "C/E", "Caug", "F#7"]) {
    const chord = ChordSymbol.parse(symbol)!;
    assert.ok(bassline([{ beat: 0, lengthBeats: 4, symbol }], [], "root-fifth").every((note) => chord.contains(note.pitch)), symbol);
  }
  const notes = bassline([{ beat: 0, lengthBeats: 0.5, symbol: "C" }, { beat: 0.5, lengthBeats: 0.5, symbol: "F" }], [], "walking");
  assert.ok(notes.every((note) => note.start + note.duration <= (note.start < 0.5 ? 0.5 : 1)));
});

test("chord inspection surfaces a weak-onset note held into a new chord", () => {
  const result = new PartChecker(new Meter()).check([{ pitch: 64, start: 0.5, duration: 2 }], { chords: [{ beat: 0, lengthBeats: 1, symbol: "C" }, { beat: 1, lengthBeats: 3, symbol: "Fm" }] });
  assert.ok(result.chordTones?.offChord.some((note) => note.chord === "Fm"));
});
