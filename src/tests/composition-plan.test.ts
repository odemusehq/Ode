import assert from "node:assert/strict";
import { test } from "node:test";
import * as song from "../shared/song";
import type { ToolContext } from "../tools/define";
import { mnemeTools as songTools } from "../tools/mneme";
import { hookRetainTool } from "../tools/mneme/hooks";

const signature = { numerator: 4, denominator: 4 } as const;
const ctx = {
  song: { read: async () => song.emptyLeadSheet() },
  prefs: { effective: async () => ({ pronunciation: "uk", genre: null, vocalRange: null }) },
  snapshots: { latest: { song: { tempo: 100, scaleMode: false }, signature } },
} as unknown as ToolContext;
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
  actualNotes = actualNotes.map((note) => ({ ...note, pitch: note.pitch + 1 }));
  assert.deepEqual(saved.hook.notes, hook.notes, "Retained source data stays detached from later Live edits.");
});
