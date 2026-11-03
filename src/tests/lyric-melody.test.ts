import { pendingObservationFile } from "../mneme/pending-observation";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SongStore } from "../mneme/song-store";
import { LyricsStore } from "../mneme/lyrics-store";
import { PreferencesStore } from "../mneme/preferences";
import { userPaths } from "../mneme/paths";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";
import { LyricMelody } from "../server/lyric-melody";
import type { SessionManager } from "../harness/session-manager";
import type { VersionRecorder } from "../server/version-recorder";

async function open() {
  const paths = userPaths(await mkdtemp(join(tmpdir(), "ode-melody-edit-")));
  const song = new SongStore(paths, () => undefined); await song.create("Fire");
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  await lyrics.replace("[Verse]\nFire");
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", { lines: [{ words: [{ text: "Fire", syllables: ["Fire"], stress: [1] }], rhyme: { letter: "", quality: "none", part: "", sound: "" } }] });
  const set = TestSets.small();
  const clip = set.tracks[1]!.arrangementClips[0]!;
  clip.tag = "vocal"; clip.notes = [{ pitch: 64, start: 0, duration: 0.5, velocity: 83, probability: 0.8 }, { pitch: 67, start: 0, duration: 1, velocity: 77 }];
  const live = new FakeSetLive(set);
  const current = await lyrics.read();
  await lyrics.bind(song.songId, current.revision, current.notation!.revision, { id: "guide", clip: { tag: "vocal" }, notes: clip.notes, bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0, 1] }], measures: [{ number: "12", start: 0, length: 3, meter: { beats: "3", beatType: 4 } }] });
  let recorded = 0;
  const sessions = { current: { exclusive: async (work: (signal: AbortSignal) => Promise<unknown>) => work(new AbortController().signal) } } as unknown as SessionManager;
  const recorder = { recoverPending: async () => undefined, handEdits: async () => { recorded++; } } as unknown as VersionRecorder;
  const editor = new LyricMelody({ song, lyrics, live, sessions, recorder });
  const state = await lyrics.read();
  const request = { songId: state.songId, baseRevision: state.revision, notationRevision: state.notation!.revision, clipId: "guide", note: 0, pitch: 72 };
  return { song, lyrics, live, editor, request, recorded: () => recorded };
}

test("the editor changes native MIDI and shared MusicXML while retaining syllables and remapping Live's note order", async () => {
  const { editor, request, live, lyrics, recorded } = await open();
  const result = await editor.edit(request);
  const write = live.calls.find(call => call.op === "midi_clip_set_notes")!;
  assert.ok((write.args as { expected?: unknown }).expected);
  assert.equal(result.lyrics.text, "[Verse]\nFire");
  assert.deepEqual(result.lyrics.check!.lines[0]!.words[0]!.syllables, ["Fire"]);
  assert.deepEqual(result.lyrics.check!.lines[0]!.words[0]!.stress, [1]);
  const clip = result.lyrics.notation!.clips[0]!;
  assert.equal(clip.notes.find(note => note.pitch === 72)!.probability, 0.8);
  assert.equal(clip.measures![0]!.number, "12");
  assert.equal(clip.bindings[0]!.stale, undefined);
  assert.deepEqual(clip.bindings[0]!.notes.map(index => clip.notes[index]!.pitch), [72, 67]);
  assert.deepEqual((await lyrics.read()).notation!.clips[0]!.notes, clip.notes);
  assert.equal(recorded(), 2);
});

test("stale lyric revisions and later native edits refuse a write instead of replacing them", async () => {
  const { editor, request, live, lyrics } = await open();
  await assert.rejects(editor.edit({ ...request, notationRevision: request.notationRevision - 1 }));
  assert.equal(live.calls.some(call => call.op === "midi_clip_set_notes"), false);
  live.edit(set => { set.tracks[1]!.arrangementClips[0]!.notes![0]!.pitch = 60; });
  await assert.rejects(editor.edit(request), /changed/i);
  assert.equal(live.calls.some(call => call.op === "midi_clip_set_notes"), false);
  assert.equal((await lyrics.read()).notation!.clips[0]!.notes[0]!.pitch, 60);
});

test("editing a linked note preserves unrelated stale associations awaiting reconciliation", async () => {
  const { song, editor, request, lyrics } = await open();
  await song.updateNotation(sheet => {
    const notation = structuredClone(sheet.notation!);
    notation.clips[0]!.bindings.push({ line: 2, text: "Fire", word: 0, syllable: 0, notes: [9], stale: true });
    notation.revision++; return notation;
  });
  const current = await lyrics.read();
  const result = await editor.edit({ ...request, notationRevision: current.notation!.revision, pitch: undefined, duration: 1 / 3 });
  assert.equal(result.lyrics.notation!.clips[0]!.notes[0]!.duration, 1 / 3);
  assert.deepEqual(result.lyrics.notation!.clips[0]!.bindings[1]!.notes, [9]);
  assert.equal(result.lyrics.notation!.clips[0]!.bindings[1]!.stale, true);
});

test("unrepresentable score changes are rejected before any native write", async () => {
  const { song, editor, request, lyrics, live } = await open();
  await song.updateNotation(sheet => {
    const notation = structuredClone(sheet.notation!);
    notation.clips[0]!.measures![0]!.number = "12a";
    notation.revision++; return notation;
  });
  const current = await lyrics.read();
  await assert.rejects(editor.edit({ ...request, pitch: undefined, duration: 4, notationRevision: current.notation!.revision }), /extend|measure/i);
  assert.equal(live.calls.some(call => call.op === "midi_clip_set_notes"), false);
  assert.equal((await lyrics.read()).notation!.clips[0]!.notes[0]!.duration, 0.5);
});

test("a lost native write reply leaves the actual notes visible and its recovery observation pending", async () => {
  const { song, editor, request, lyrics, live } = await open();
  const call = live.extension.call.bind(live.extension);
  live.extension.call = async (op, args) => {
    const result = await call(op, args);
    if (op === "midi_clip_set_notes") throw new Error("Lost native reply");
    return result as never;
  };
  await assert.rejects(editor.edit(request), /Lost native reply/);
  assert.ok((await lyrics.read()).notation!.clips[0]!.notes.some(note => note.pitch === 72));
  assert.notEqual(await pendingObservationFile(song.dataDir).read(), null);
});
