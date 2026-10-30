import assert from "node:assert/strict";
import { test } from "node:test";
import { OdeConfig } from "../shared/config";
import type { Note } from "../shared/live";
import type { ToolContext } from "../tools/define";
import { setLyricsToMelodyTool } from "../tools/music/set-lyrics-to-melody";

const source: Note[] = [
  { pitch: 60, start: 0.06, duration: 0.93, velocity: 66, probability: 0.4, releaseVelocity: 32 },
  { pitch: 72, start: 0.06, duration: 1.13, velocity: 103, probability: 0.8, velocityDeviation: 4 },
  { pitch: 76, start: 1.11, duration: 0.7, velocity: 91, muted: true, probability: 0.3, releaseVelocity: 47 },
  { pitch: 74, start: 2.93, duration: 0.8, velocity: 88 },
];

function context(maxChars = 60_000): ToolContext {
  const config = new OdeConfig("unused", "unused");
  config.limits.toolResultMaxChars = maxChars;
  return { config } as ToolContext;
}

const input = { line: "hello", notes: source, accent: "uk" as const, timeSignature: { numerator: 4, denominator: 4 as const }, tempo: 120 };
interface Setting {
  notes: Note[];
  alignment: { syllable: number; note: number }[];
  melody: { notes: Note[]; alignment: { syllable: number; note: number }[] };
  selectedSourceIndices: number[];
  preservedSourceIndices: number[];
}

test("editable lyric setting refuses an inferred voice and preserves every other source note", async () => {
  await assert.rejects(setLyricsToMelodyTool.run(input, context()), /select|simultaneous|onset/i);
  await assert.rejects(setLyricsToMelodyTool.run({ ...input, notes: [source[0]!, { ...source[1]!, start: 0.0605 }] }, context()), /select|simultaneous|onset/i);
  const before = structuredClone(source);
  const result = await setLyricsToMelodyTool.run({ ...input, sourceIndices: [1] }, context()) as Setting;
  assert.deepEqual(result.selectedSourceIndices, [1]);
  assert.deepEqual(result.preservedSourceIndices, [0, 2, 3]);
  assert.equal(result.notes.length, 5);
  for (const index of [0, 2, 3]) assert.deepEqual(result.notes.find((note) => note.pitch === source[index]!.pitch), source[index]);
  assert.deepEqual(result.alignment, [{ syllable: 0, note: 1 }, { syllable: 1, note: 2 }]);
  assert.deepEqual(result.melody.alignment, [{ syllable: 0, note: 0 }, { syllable: 1, note: 1 }]);
  assert.equal(result.melody.notes.length, 2);
  assert.ok(result.melody.notes.every((note) => note.pitch === 72 && note.velocity === 103 && note.probability === 0.8 && note.velocityDeviation === 4));
  assert.equal(result.melody.notes[0]!.start, 0.06);
  assert.ok(Math.abs(result.melody.notes[1]!.start + result.melody.notes[1]!.duration - 1.19) < 1e-9);
  assert.deepEqual(result.alignment.map((pair) => result.notes[pair.note]), result.melody.notes);
  assert.deepEqual(source, before);
});

test("editable lyric selection keeps legato and rejects invalid selections or an incomplete output window", async () => {
  await assert.rejects(setLyricsToMelodyTool.run({ ...input, notes: [source[2]!] }, context()), /unmuted|select/i);
  const legato = [{ ...source[1]!, duration: 1.5 }, { ...source[3]!, start: 1.11 }, source[2]!];
  const result = await setLyricsToMelodyTool.run({ ...input, notes: legato }, context()) as Setting;
  assert.deepEqual(result.selectedSourceIndices, [0, 1]);
  assert.deepEqual(result.preservedSourceIndices, [2]);
  assert.equal(result.melody.notes[0]!.duration, 1.5);
  assert.equal(result.melody.notes[1]!.start, 1.11);
  for (const sourceIndices of [[0, 0], [-1], [0.5], [4], [2], []]) {
    await assert.rejects(setLyricsToMelodyTool.run({ ...input, sourceIndices }, context()), /index|indices|muted|select/i);
  }
  await assert.rejects(setLyricsToMelodyTool.run({ ...input, sourceIndices: [1] }, context(100)), /window|too large|smaller/i);
});
