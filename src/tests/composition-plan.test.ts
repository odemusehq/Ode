import assert from "node:assert/strict";
import { test } from "node:test";
import * as song from "../shared/song";
import { Contour, Register } from "../music/melody/melody-plan";
import type { ToolContext } from "../tools/define";
import { melodyWriteTool } from "../tools/music/melody-write";
import { lyricsFitMelodyTool } from "../tools/music/lyrics-fit-melody";
import { songTools } from "../tools/song";
import { hookRetainTool } from "../tools/song/hooks";

const signature = { numerator: 4, denominator: 4 } as const;
const ctx = {
  song: { read: async () => song.emptyLeadSheet() },
  prefs: { effective: async () => ({ pronunciation: "uk", genre: null, vocalRange: null }) },
  snapshots: { latest: { song: { tempo: 100, scaleMode: false }, signature } },
} as unknown as ToolContext;
const plan = { bars: 2, contour: Contour.Rising, register: Register.Mid, density: 1, seed: 2,
  key: { root: 0, scale: "Major" }, range: { low: 60, high: 72 }, timeSignature: signature };
const hook = { id: "stay", lengthBeats: 2, notes: [
  { pitch: 64, start: 0, duration: 0.5, velocity: 71, probability: 0.8 },
  { pitch: 67, start: 0.5, duration: 1.5, velocity: 94, releaseVelocity: 45 },
] };

test("composition survives song parsing and reports stale lyric bindings without losing the plan", () => {
  const sheet = song.LeadSheetSchema.parse({ lyrics: "[Chorus]\nStay here", lyricsRevision: 2,
    sections: [{ id: "chorus", kind: "chorus", name: "Chorus", startBeat: 4, lengthBeats: 8 }],
    composition: { hooks: [hook], phrases: [{ id: "line1", sectionId: "chorus", lyricsRevision: 2,
      line: 2, text: "Stay here", startBeat: -0.5, lengthBeats: 2, hookId: "stay" }], parts: [] } });
  assert.ok(sheet.composition);
  const status = (song as unknown as { compositionStatus(sheet: unknown): { stale: boolean; issues: string[] } }).compositionStatus;
  assert.equal(status(sheet).stale, false);
  const edited = song.LeadSheetSchema.parse({ ...sheet, lyrics: "[Chorus]\nCome home", lyricsRevision: 3 });
  assert.equal(status(edited).stale, true);
  assert.equal(edited.composition?.phrases[0]?.text, "Stay here");
});

test("explicit short and unequal phrases retain clip positions and syllable-note alignment", async () => {
  const result = await melodyWriteTool.run({ ...plan, lyrics: ["Stay", "Come back to me"],
    phrases: [{ line: 1, startBeat: 0.5, lengthBeats: 0.25 }, { line: 2, startBeat: 2, lengthBeats: 5.5 }] } as never, ctx) as any;
  assert.equal(result.phrases.length, 2);
  assert.ok(result.phrases[0].notes.every((note: any) => note.start >= 0.5 && note.start + note.duration <= 0.75));
  assert.ok(result.phrases[1].notes.every((note: any) => note.start >= 2 && note.start + note.duration <= 7.5));
  for (const phrase of result.phrases) {
    assert.ok(phrase.alignment.length > 0);
    assert.ok(phrase.alignment.every((pair: any) => result.notes[pair.note] && phrase.syllables[pair.syllable]));
  }
});

test("retained hooks repeat exactly and never silently split notes to fit different lyrics", async () => {
  const result = await melodyWriteTool.run({ ...plan, lyrics: ["Stay here", "Come home"], retainedHooks: [hook],
    phrases: [{ line: 1, startBeat: 0.5, lengthBeats: 2, hookId: "stay" }, { line: 2, startBeat: 4, lengthBeats: 2, hookId: "stay" }] } as never, ctx) as any;
  assert.deepEqual(result.phrases[0].notes, hook.notes.map((note) => ({ ...note, start: note.start + 0.5 })));
  assert.deepEqual(result.phrases[1].notes, hook.notes.map((note) => ({ ...note, start: note.start + 4 })));
  await assert.rejects(melodyWriteTool.run({ ...plan, lyrics: ["I will follow you home"], retainedHooks: [hook],
    phrases: [{ line: 1, startBeat: 0, lengthBeats: 2, hookId: "stay" }] } as never, ctx), /hook|syllable|split/i);
});

test("explicit shared motifs recur across different lines without being redrafted", async () => {
  const result = await melodyWriteTool.run({ ...plan, lyrics: ["Stay here", "Come home"],
    phrases: [{ line: 1, startBeat: 0.5, lengthBeats: 2, motifId: "call" }, { line: 2, startBeat: 4, lengthBeats: 3, motifId: "call" }] } as never, ctx) as any;
  assert.deepEqual(result.phrases[0].notes.map((note: any) => note.pitch), result.phrases[1].notes.map((note: any) => note.pitch));
  assert.equal(result.phrases[1].motifId, "call");
});

test("explicit fitting uses the declared phrases rather than guessing from rests", async () => {
  const notes = [{ pitch: 64, start: 0.5, duration: 0.5 }, { pitch: 67, start: 4, duration: 0.5 }];
  const result = await lyricsFitMelodyTool.run({ lines: ["Stay", "Home"], notes, lengthBeats: 8, timeSignature: signature,
    phrases: [{ line: 1, startBeat: 0.5, lengthBeats: 1 }, { line: 2, startBeat: 4, lengthBeats: 2 }] } as never, ctx) as any;
  assert.equal(result.lines[0].startBeat, 0.5);
  assert.deepEqual(result.lines[0].phrase, [notes[0]]);
  assert.equal(result.lines[1].startBeat, 4);
  assert.ok(result.lines[0].alignment.length > 0);
});

test("muted notes outside a sung phrase remain unassigned rather than preventing its check", async () => {
  const muted = { pitch: 60, start: 0.25, duration: 7, muted: true };
  const result = await lyricsFitMelodyTool.run({ lines: ["Stay"], notes: [{ pitch: 64, start: 0, duration: 0.5 }, muted],
    lengthBeats: 8, timeSignature: signature, phrases: [{ line: 1, startBeat: 0, lengthBeats: 1 }] }, ctx) as any;
  assert.deepEqual(result.unassignedNotes, [muted]);
  assert.equal(result.lines[0].phrase.length, 1);
});

test("the chosen hook can be retained from actual MIDI without inventing a hash", async () => {
  const retain = songTools.find((tool) => tool.name === "hook_retain");
  assert.ok(retain, "Ode needs a concrete tool for retaining the current played hook");
  let sheet = song.LeadSheetSchema.parse({ composition: { notes: ["Keep the late entrance"] } });
  let actualNotes = hook.notes.map((note) => ({ ...note }));
  const snapshot = { tracks: [{ clipSlots: [], arrangementClips: [{ tag: "chosen", kind: "midi" }], takeLanes: [] }], returnTracks: [],
    main: { clipSlots: [], arrangementClips: [], takeLanes: [] } };
  const sourceCtx = { ...ctx, song: { read: async () => sheet, updateWithReceipt: async (patch: Partial<song.LeadSheet>) => {
    sheet = song.LeadSheetSchema.parse({ ...sheet, ...patch });
    return { ...sheet, __odeReceipts: [] };
  } }, snapshots: { read: async () => snapshot, latest: (ctx.snapshots as any).latest },
  live: { extension: { call: async () => ({ notes: actualNotes }) } } } as unknown as ToolContext;
  const saved = await hookRetainTool.run({ id: "chosen-hook", clipTag: "chosen", lengthBeats: 2 }, sourceCtx) as { hook: song.RetainedHook };
  assert.deepEqual(saved.hook.notes, hook.notes);
  assert.ok(saved.hook.source);
  assert.match(saved.hook.source.noteHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(sheet.composition?.notes, ["Keep the late entrance"]);
  const input = { ...plan, lyrics: ["Stay here"], retainedHooks: [saved.hook], phrases: [{ line: 1, startBeat: 0, lengthBeats: 2, hookId: "chosen-hook" }] };
  await melodyWriteTool.run(input as never, sourceCtx);
  actualNotes = actualNotes.map((note) => ({ ...note, pitch: note.pitch + 1 }));
  await assert.rejects(melodyWriteTool.run(input as never, sourceCtx), /source notes changed/i);
});

test("saved section phrases include pickups only when the planned clip starts early enough", async () => {
  const sheet = song.LeadSheetSchema.parse({ lyrics: "[Chorus]\nStay here", lyricsRevision: 1,
    sections: [{ id: "chorus", kind: "chorus", name: "Chorus", startBeat: 8, lengthBeats: 8 }],
    composition: { hooks: [hook], phrases: [{ id: "entrance", sectionId: "chorus", lyricsRevision: 1,
      line: 2, text: "Stay here", startBeat: -0.5, lengthBeats: 2, hookId: "stay" }] } });
  const sectionCtx = { ...ctx, song: { read: async () => sheet } } as unknown as ToolContext;
  const { bars: _bars, ...brief } = plan;
  await assert.rejects(melodyWriteTool.run({ ...brief, sectionId: "chorus" }, sectionCtx), /nonnegative/i);
  const written = await melodyWriteTool.run({ ...brief, sectionId: "chorus", clipStartBeat: 7.5 }, sectionCtx) as any;
  assert.equal(written.clipStartBeat, 7.5);
  assert.equal(written.notes[0].start, 0);
  assert.equal(written.lengthBeats, 8.5);
  sheet.lyricsRevision++;
  const rechecked = await melodyWriteTool.run({ ...brief, sectionId: "chorus", clipStartBeat: 7.5 }, sectionCtx) as any;
  assert.deepEqual(rechecked.bindings.rechecked, ["entrance"]);
  sheet.lyrics = "[Chorus]\nCome home";
  await assert.rejects(melodyWriteTool.run({ ...brief, sectionId: "chorus", clipStartBeat: 7.5 }, sectionCtx), /stale/i);
});
