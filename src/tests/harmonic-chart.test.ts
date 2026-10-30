import assert from "node:assert/strict";
import { test } from "node:test";
import { ChordSymbol } from "../music/harmony/chord-symbol";
import { ChordTimeline, parseChordEvents } from "../music/harmony/chord-timeline";
import { ChordVoicer } from "../music/harmony/chord-voicer";
import { KeyFinder } from "../music/harmony/key-finder";
import { MusicalKey } from "../music/harmony/musical-key";
import { Contour, Register } from "../music/melody/melody-plan";
import { writeMelody } from "../music/melody/melody-writer";
import { writeLyricPhrases } from "../music/melody/lyric-phrases";
import { analyzeLine } from "../music/phonetics/line-analyzer";
import { PartChecker } from "../music/parts/part-checker";
import { Meter } from "../music/prosody/meter";
import { bassline, BassStyle } from "../music/rhythm/bassline-writer";
import { harmonyLines } from "../music/vocals/harmony-lines";
import type { Note } from "../shared/live";
import { LeadSheetSchema } from "../shared/song";
import { melodyWriteTool } from "../tools/music/melody-write";
import type { ToolContext } from "../tools/define";

const meter = new Meter(4, 4);
const plan = { bars: 3, signature: { numerator: 4, denominator: 4 as const }, contour: Contour.Static,
  register: Register.Mid, density: 1, seed: 1, key: { root: 0, scale: "Major" } };

test("chord parsing preserves supported aliases and computational charts refuse unsupported material", () => {
  for (const [alias, canonical] of [["Cm(maj7)", "CmMaj7"], ["Cmajor7", "Cmaj7"], ["Cminor7", "Cm7"], ["G7(b9,#11)", "G7b9#11"]] as const) {
    const parsed = ChordSymbol.parse(alias!);
    assert.ok(parsed, alias);
    assert.deepEqual(parsed.pitchClasses, ChordSymbol.parse(canonical!)?.pitchClasses, alias);
  }
  for (const symbol of ["Cgarbage", "Cno3", "H7", "C7(no3)", "C/Egarbage", "C/E/G"]) assert.equal(ChordSymbol.parse(symbol), null, symbol);
  for (const symbol of ["NC", "N.C.", " nc ", "n.c."]) assert.equal(ChordSymbol.isNoChord(symbol), true, symbol);
  for (const symbol of ["-", "/", "%", "", "rest", "C7(b9", "C7b9)"]) {
    assert.equal(ChordSymbol.isNoChord(symbol), false, symbol);
    assert.throws(() => parseChordEvents([{ beat: 0, lengthBeats: 4, symbol }]));
  }
  const chart = [{ beat: 0, lengthBeats: 4, symbol: "C" }, { beat: 4, lengthBeats: 4, symbol: "H7" }, { beat: 8, lengthBeats: 4, symbol: "F" }];
  const before = structuredClone(chart);
  const lead = [{ pitch: 61, start: 4, duration: 1 }];
  const consumers = [
    () => new ChordTimeline(chart), () => new ChordVoicer().voice(chart),
    () => bassline(chart, [], BassStyle.Root), () => new KeyFinder().find(chart),
    () => new PartChecker(meter).check(lead, { chords: chart }),
    () => writeMelody(plan, chart, { low: 60, high: 72 }),
    () => harmonyLines(lead, chart, 1, { low: 55, high: 79 }, meter, MusicalKey.ofMajor(0)),
    () => writeLyricPhrases(plan, chart, { low: 60, high: 72 }, [{ text: "hello", analysis: analyzeLine("hello", "uk") }],
      [{ line: 1, startBeat: 0, lengthBeats: 4, hookId: "chosen" }],
      [{ id: "chosen", lengthBeats: 4, notes: [{ pitch: 60, start: 0, duration: 1 }, { pitch: 62, start: 1, duration: 3 }] }]),
  ];
  for (const consume of consumers) assert.throws(consume, (error: unknown) => error instanceof Error && /H7/.test(error.message) && /\b4\b/.test(error.message));
  assert.deepEqual(chart, before);
  for (const bad of [
    [{ beat: NaN, lengthBeats: 4, symbol: "C" }], [{ beat: -1, lengthBeats: 4, symbol: "C" }],
    [{ beat: 0, lengthBeats: 0, symbol: "C" }], [{ beat: 0, lengthBeats: 8, symbol: "C" }, { beat: 4, lengthBeats: 4, symbol: "NC" }],
  ]) assert.throws(() => parseChordEvents(bad));
});

test("explicit no-chord spans retain silence and report only actual chord-check coverage", () => {
  const first = { beat: 0, lengthBeats: 4, symbol: "C" }, last = { beat: 8, lengthBeats: 4, symbol: "F#" };
  const chart = [first, { beat: 4, lengthBeats: 4, symbol: "N.C." }, last];
  const before = structuredClone(chart);
  const timeline = new ChordTimeline(chart);
  assert.equal(timeline.at(5), null);
  assert.equal(timeline.entries().length, 3);
  const voiced = new ChordVoicer().voice(chart);
  assert.deepEqual(voiced.voicings.find((entry) => entry.beat === 4), { symbol: "N.C.", beat: 4, lengthBeats: 4, bass: null, pitches: [] });
  assert.ok(voiced.notes.every((note) => note.start >= 8 || note.start + note.duration <= 4));
  for (const style of [BassStyle.Walking, BassStyle.Syncopated]) {
    const alone = bassline([first], [], style);
    for (const withStop of [chart, [first, last]]) {
      const written = bassline(withStop, [], style);
      assert.deepEqual(written.filter((note) => note.start < 4), alone, "A later chord across NC or a gap cannot become the preceding chord's approach/anticipation target.");
      assert.ok(written.every((note) => note.start >= 8 || note.start + note.duration <= 4));
    }
  }
  const check = new PartChecker(meter).check([{ pitch: 60, start: 0, duration: 1 }, { pitch: 61, start: 4, duration: 1 },
    { pitch: 66, start: 8, duration: 1 }, { pitch: 66, start: 3.5, duration: 5 }], { chords: chart });
  assert.equal(check.chordTones?.strongBeatNotes, 2);
  assert.equal(check.chordTones?.heldAtChanges, 1);
  const noChord = [{ beat: 0, lengthBeats: 4, symbol: "NC" }];
  assert.ok(writeMelody({ ...plan, bars: 1 }, noChord, { low: 60, high: 72 }).length > 0, "No chord is not an instruction to silence an explicitly keyed lead.");
  for (const [events, notes] of [[[], []], [noChord, []], [[], [{ pitch: 60, start: 0, duration: 1, muted: true }]],
    [[], [{ pitch: 60, start: 0, duration: 1, probability: 0 }]]] as [typeof noChord, Note[]][]) {
    assert.throws(() => new KeyFinder().find(events, notes), /key|pitched|evidence/i);
  }
  assert.deepEqual(chart, before);
});

test("a later saved-section clip keeps original key context and projects only its own chord spans", async () => {
  const sheet = LeadSheetSchema.parse({ lyrics: "hello", lyricsRevision: 1,
    sections: [{ id: "verse", kind: "verse", name: "Verse", startBeat: 8, lengthBeats: 16,
      chords: [{ beat: 0, lengthBeats: 12, symbol: "C" }, { beat: 12, lengthBeats: 4, symbol: "F" }] }],
    composition: { phrases: [{ id: "entry", sectionId: "verse", lyricsRevision: 1, line: 1, text: "hello", startBeat: 12, lengthBeats: 4 }], hooks: [], parts: [] } });
  const before = structuredClone(sheet);
  const ctx = { song: { read: async () => sheet }, prefs: { effective: async () => ({ pronunciation: "uk", genre: null, vocalRange: null }) },
    snapshots: { latest: { song: { tempo: 120, scaleMode: false }, signature: plan.signature } } } as unknown as ToolContext;
  const result = await melodyWriteTool.run({ sectionId: "verse", clipStartBeat: 20, contour: plan.contour, register: plan.register,
    density: 1, seed: 1, range: { low: 60, high: 72 }, timeSignature: plan.signature }, ctx) as { notes: Note[]; lengthBeats: number; key: { root: number; scale: string } };
  assert.equal(result.lengthBeats, 4);
  assert.ok(result.notes.length > 0 && result.notes.every((note) => note.start >= 0 && note.start + note.duration <= 4));
  const sourceKey = new KeyFinder().find(sheet.sections[0]!.chords).spec;
  assert.deepEqual({ root: result.key.root, scale: result.key.scale }, { root: sourceKey.root, scale: sourceKey.scale });
  assert.deepEqual(sheet, before);
});
