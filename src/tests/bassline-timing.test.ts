import assert from "node:assert/strict";
import { test } from "node:test";
import { bassline, BassStyle } from "../music/rhythm/bassline-writer";
import { basslineWriteTool } from "../tools/music/bassline-write";
import type { Note } from "../shared/live";

const chords = [{ beat: 0, lengthBeats: 4, symbol: "Cm7" }];
const kick = (start: number, extra: Partial<Note> = {}): Note => ({ pitch: 36, start, duration: 0.1, ...extra });

test("kick-locked bass retains exact active onsets and uses an explicit mapped kick pitch", async () => {
  const source = [kick(0.06), kick(0.06), kick(1.11, { probability: 0.5 }), kick(2.93),
    kick(1.5, { muted: true }), kick(2, { probability: 0 }), kick(0.8, { pitch: 38 })];
  const original = structuredClone(source);
  for (const style of [BassStyle.Root, BassStyle.EightOhEight, BassStyle.Syncopated]) {
    const starts = bassline(chords, source, style).map((note) => note.start);
    for (const start of [0.06, 1.11, 2.93]) assert.equal(starts.filter((value) => value === start).length, 1);
    for (const start of [1.5, 2, 0.8]) assert.ok(!starts.includes(start));
  }
  assert.deepEqual(source, original);
  const mapped = [kick(1.12, { pitch: 40 }), kick(2.12, { pitch: 38 })];
  const selected = await basslineWriteTool.run({ chords, kick: mapped, style: BassStyle.Root, kickPitch: 40 }, {} as never) as { notes: Note[]; kickPitch: number };
  assert.deepEqual(selected.notes.map((note) => note.start), [0, 1.12]);
  assert.equal(selected.kickPitch, 40);
  const noKick = await basslineWriteTool.run({ chords, kick: mapped, style: BassStyle.Root }, {} as never) as { notes: Note[] };
  assert.deepEqual(noKick.notes.map((note) => note.start), [0]);
});

test("a late off-grid kick stays inside its chord when a syncopated anticipation is added", () => {
  const notes = bassline([...chords, { beat: 4, lengthBeats: 4, symbol: "F7" }], [kick(3.7), kick(3.9)], BassStyle.Syncopated);
  assert.ok(notes.some((note) => note.start === 3.7));
  assert.ok(notes.some((note) => note.start === 3.9));
  assert.ok(notes.some((note) => note.start === 3.75));
  assert.ok(notes.filter((note) => note.start < 4).every((note) => note.duration > 0 && note.start + note.duration <= 4));
});
