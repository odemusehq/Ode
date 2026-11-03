import { LyricsDocument } from "../shared/lyrics-document";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LyricsStore } from "../mneme/lyrics-store";
import { SongStore } from "../mneme/song-store";
import { PreferencesStore } from "../mneme/preferences";
import { userPaths } from "../mneme/paths";
import type { LyricsCheck } from "../shared/lyrics";
import { VersionAuthor } from "../shared/versions";
import { createHash } from "node:crypto";
import { lyricMelodyTools } from "../tools/lyrics/melody";
import type { ToolContext } from "../tools/define";

const check: LyricsCheck = { lines: [{ words: [{ text: "Fire", syllables: ["Fire"], stress: [1], ipa: ["faɪə"] }], rhyme: { letter: "", quality: "none", part: "", sound: "" } }] };
async function open() {
  const root = await mkdtemp(join(tmpdir(), "ode-lyric-document-"));
  const paths = userPaths(root);
  const song = new SongStore(paths, () => undefined);
  await song.create("Fire");
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  await lyrics.replace("[Verse]\nFire");
  return { song, lyrics };
}

test("model analysis is shared with the main agent and musician choices survive another model answer", async () => {
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const current = await lyrics.read();
  assert.deepEqual(current.check, check);
  const chosen = await lyrics.choose({ songId: song.songId, baseRevision: current.revision, notationRevision: current.notation!.revision,
    line: 2, word: 0, value: { text: "Fire", syllables: ["Fi", "re"], stress: [1, 0], ipa: ["faɪ", "ə"] } });
  assert.deepEqual(chosen.check!.lines[0]!.words[0]!.syllables, ["Fi", "re"]);
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  assert.deepEqual((await lyrics.read()).check!.lines[0]!.words[0]!.syllables, ["Fi", "re"]);
  await assert.rejects(lyrics.choose({ songId: song.songId, baseRevision: current.revision, notationRevision: current.notation!.revision,
    line: 2, word: 0, value: check.lines[0]!.words[0]! }));
});

test("late linguistic answers cannot annotate changed text or a different open song", async () => {
  const { song, lyrics } = await open();
  const before = await lyrics.read();
  await lyrics.write("[Verse]\nRain", before.revision, VersionAuthor.Musician);
  assert.equal(await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check), false);
  assert.equal((await lyrics.read()).check, undefined);
  assert.equal(LyricsDocument.needsAnalysis((await lyrics.read()).notation, (await lyrics.read()).text), true);
  const first = song.songId;
  await song.create("Another");
  assert.equal(await lyrics.saveCheck(first, "[Verse]\nFire", "uk", check), false);
  assert.equal((await lyrics.read()).text, "");
});

test("melody bindings use current SDK notes and reject a changed source before storing an association", async () => {
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const current = await lyrics.read();
  let notes = [{ pitch: 64, start: 0, duration: 1.5, velocity: 82 }];
  const hash = createHash("sha256").update(JSON.stringify(notes)).digest("hex");
  const tool = lyricMelodyTools.find(tool => tool.name === "lyrics_bind_melody")!;
  const ctx = { song, lyrics, live: { extension: { call: async () => ({ notes }) } } } as unknown as ToolContext;
  const input = { clip: { tag: "vocal" }, expectedNotesHash: hash, baseRevision: current.revision, notationRevision: current.notation!.revision,
    bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }], meter: { beats: "3", beatType: 4 } };
  notes = [{ pitch: 65, start: 0, duration: 1.5, velocity: 82 }];
  await assert.rejects(tool.run(input, ctx), /changed/i);
  assert.equal((await lyrics.read()).notation!.clips.length, 0);
  notes = [{ pitch: 64, start: 0, duration: 1.5, velocity: 82 }];
  await tool.run(input, ctx);
  assert.deepEqual((await lyrics.read()).notation!.clips[0]!.notes, notes);
  assert.deepEqual((await lyrics.read()).notation!.clips[0]!.measures?.[0]?.meter, input.meter);
  const rebound = await lyrics.read();
  await tool.run({ ...input, meter: undefined, baseRevision: rebound.revision, notationRevision: rebound.notation!.revision }, ctx);
  assert.deepEqual((await lyrics.read()).notation!.clips[0]!.measures?.[0]?.meter, input.meter);
  const changed = [{ pitch: 67, start: 0, duration: 2, velocity: 82 }];
  const refreshed = await lyrics.refreshMelody(async () => changed);
  assert.equal(refreshed.verified, true);
  assert.deepEqual(refreshed.lyrics.notation!.clips[0]!.measures?.[0]?.meter, input.meter);
  assert.deepEqual(refreshed.lyrics.notation!.clips[0]!.notes, changed);
  assert.equal(refreshed.lyrics.notation!.clips[0]!.bindings[0]!.stale, true);
  assert.deepEqual(refreshed.lyrics.check!.lines[0]!.words[0]!.syllables, ["Fire"]);
});

test("a new model split retains notes but invalidates their old syllable meaning", async () => {
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const before = await lyrics.read();
  await lyrics.bind(song.songId, before.revision, before.notation!.revision, { id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 1 }], bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }] });
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", { lines: [{ ...check.lines[0]!, words: [{ text: "Fire", syllables: ["Fi", "re"], stress: [1, 0] }] }] });
  const after = await lyrics.read();
  assert.equal(after.notation!.clips[0]!.bindings[0]!.stale, true);
  assert.equal(after.notation!.clips[0]!.notes[0]!.pitch, 60);
});
