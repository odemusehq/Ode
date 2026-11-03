import { LyricsDocument, WordCheckSchema } from "../shared/lyrics-document";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LyricsStore } from "../mneme/lyrics-store";
import { SongStore } from "../mneme/song-store";
import { PreferencesStore } from "../mneme/preferences";
import { userPaths } from "../mneme/paths";
import type { LyricsCheck, LyricsState, LineCheck } from "../shared/lyrics";
import { VersionAuthor } from "../shared/versions";
import { createHash } from "node:crypto";
import { lyricMelodyTools } from "../tools/lyrics/melody";
import { lyricTextTools } from "../tools/lyrics/text";
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

test("automatic analysis keeps linked divisions; explicit division changes retain notes and flag alignment", async () => {
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const before = await lyrics.read();
  await lyrics.bind(song.songId, before.revision, before.notation!.revision, { id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 1 }], bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }] });
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", { lines: [{ ...check.lines[0]!, words: [{ text: "Fire", syllables: ["Fi", "re"], stress: [1, 0] }] }] });
  const after = await lyrics.read();
  assert.equal(after.notation!.clips[0]!.bindings[0]!.stale, undefined);
  assert.equal(after.notation!.clips[0]!.notes[0]!.pitch, 60);
  assert.deepEqual(after.check!.lines[0]!.words[0]!.syllables, ["Fire"]);
  assert.ok(after.check!.lines[0]!.review?.length);
  const changed = await lyrics.choose({ songId: song.songId, baseRevision: after.revision, notationRevision: after.notation!.revision,
    line: 2, word: 0, value: { text: "Fire", syllables: ["Fi", "re"], stress: [1, 0] } });
  assert.equal(changed.notation!.clips[0]!.bindings[0]!.stale, true);
  assert.deepEqual(changed.notation!.clips[0]!.notes, after.notation!.clips[0]!.notes);
  await assert.rejects(lyrics.choose({ songId: song.songId, baseRevision: changed.revision, notationRevision: changed.notation!.revision,
    line: 2, word: 0, pronunciation: false, value: check.lines[0]!.words[0]! }), /annotations changed/i);
});

test("lexical stress and sung emphasis stay separate, including a saved musician override", async () => {
  const word = { text: "Fire", syllables: ["Fire"], stress: [0], wordStress: [1], ipa: ["faɪə"] };
  assert.deepEqual(WordCheckSchema.parse(word), word);
  assert.equal(WordCheckSchema.safeParse({ ...word, wordStress: [1, 0] }).success, false);
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const before = await lyrics.read();
  await lyrics.choose({ songId: song.songId, baseRevision: before.revision, notationRevision: before.notation!.revision, line: 2, word: 0, pronunciation: false, value: { ...word, wordStress: [2] } });
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", { lines: [{ ...check.lines[0]!, words: [{ ...word, stress: [1] }] }] });
  const saved = await lyrics.read();
  assert.deepEqual(saved.check!.lines[0]!.words[0], word);
  assert.deepEqual(saved.notation!.choices[0]!.default?.syllables, ["Fire"]);
});

test("draft edits keep untouched line annotations and all notes while the changed line awaits analysis", () => {
  const text = "[Verse]\nFire\nRain";
  const rain = { ...check.lines[0]!, words: [{ text: "Rain", syllables: ["Rain"], stress: [1] }] };
  const notation = { ...LyricsDocument.empty(), analysis: { text, accent: "uk" as const, check: { lines: [check.lines[0]!, rain] } },
    clips: [{ id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 1 }], bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }, { line: 3, text: "Rain", word: 0, syllable: 0, notes: [0] }] }] };
  const draft = "[Verse]\nLight\nRain";
  const next = LyricsDocument.reconcile(notation, text, draft);
  const marks = LyricsDocument.check(next, draft)!;
  assert.deepEqual(marks.lines[0]!.words, []);
  assert.deepEqual(marks.lines[1]!.words, rain.words);
  assert.deepEqual(next.clips[0]!.notes, notation.clips[0]!.notes);
  assert.equal(next.clips[0]!.bindings[0]!.stale, true);
  assert.equal(next.clips[0]!.bindings[1]!.stale, undefined);
});

test("phrase checks receive the bound score and a late answer cannot replace a newer emphasis choice", async () => {
  const { song, lyrics } = await open();
  await lyrics.saveCheck(song.songId, "[Verse]\nFire", "uk", check);
  const before = await lyrics.read();
  await lyrics.bind(song.songId, before.revision, before.notation!.revision, { id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 1 }], bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }] });
  let start!: () => void, finish!: (answer: unknown) => void, context: any;
  const started = new Promise<void>(resolve => { start = resolve; });
  const pending = lyrics.analyse({ check: async (_lines: unknown, _accent: unknown, _signal: unknown, supplied: unknown) => {
    context = supplied; start(); return new Promise(resolve => { finish = resolve; });
  } } as never, "uk");
  await started;
  assert.equal(context.clips[0].notes[0].pitch, 60);
  assert.deepEqual(context.annotations.lines[0].words[0].syllables, ["Fire"]);
  const current = await lyrics.read();
  await lyrics.choose({ songId: song.songId, baseRevision: current.revision, notationRevision: current.notation!.revision, line: 2, word: 0,
    value: { ...check.lines[0]!.words[0]!, stress: [0] } });
  finish({ status: "ok", check: { lines: [{ ...check.lines[0]!, review: ["Old musical reading"] }] } });
  assert.equal((await pending).status, "unreachable");
  const after = await lyrics.read();
  assert.deepEqual(after.check!.lines[0]!.words[0]!.stress, [0]);
  assert.equal(after.check!.lines[0]!.review, undefined);
  assert.deepEqual(after.notation!.clips[0]!.notes, current.notation!.clips[0]!.notes);
});

test("a newer interpretation supersedes an older accent check without reusing the older review", async () => {
  const { lyrics } = await open();
  const pending: ((value: unknown) => void)[] = [];
  const checker = { check: () => new Promise(resolve => { pending.push(resolve); }) } as never;
  const uk = lyrics.analyse(checker, "uk");
  while (pending.length < 1) await new Promise(resolve => setImmediate(resolve));
  const us = lyrics.analyse(checker, "us");
  while (pending.length < 2) await new Promise(resolve => setImmediate(resolve));
  pending[0]!({ status: "ok", check: { lines: [{ ...check.lines[0]!, review: ["UK interpretation"] }] } });
  assert.equal((await uk).status, "unreachable");
  pending[1]!({ status: "ok", check: { lines: [{ ...check.lines[0]!, review: ["US interpretation"] }] } });
  assert.equal((await us).status, "ok");
  const after = await lyrics.read();
  assert.equal(after.notation!.analysis!.accent, "us");
  assert.deepEqual(after.check!.lines[0]!.review, ["US interpretation"]);
});

test("the main agent can read an unfinished phrase and patch one syllable without dropping its neighbour", async () => {
  const { song, lyrics } = await open();
  await lyrics.replace("[Verse]\nFire burns");
  const words = [{ text: "Fire", syllables: ["Fire"], wordStress: [1], stress: [0] }, { text: "burns", syllables: ["burns"], wordStress: [1], stress: [1] }];
  await lyrics.saveCheck(song.songId, "[Verse]\nFire burns", "uk", { lines: [{ words, rhyme: check.lines[0]!.rhyme, review: ["Phrase review"] }] });
  const notes = [{ pitch: 60, start: 0, duration: 1 }, { pitch: 62, start: 1, duration: 1 }, { pitch: 64, start: 2, duration: 1 }];
  const ctx = { song, lyrics, live: { extension: { call: async () => ({ notes }) } } } as unknown as ToolContext;
  const read = lyricTextTools.find(tool => tool.name === "lyrics_read")!;
  const before = await read.run({}, ctx) as { annotations: LineCheck[]; melody: unknown[]; revision: number; notationRevision: number };
  assert.deepEqual(before.annotations[0]!.words, words);
  assert.deepEqual(before.annotations[0]!.review, ["Phrase review"]);
  assert.deepEqual(before.melody, []);
  const bind = lyricMelodyTools.find(tool => tool.name === "lyrics_bind_melody")!;
  const input = { clip: { tag: "vocal" }, expectedNotesHash: createHash("sha256").update(JSON.stringify(notes)).digest("hex"), baseRevision: before.revision, notationRevision: before.notationRevision,
    bindings: [{ line: 2, text: "Fire burns", word: 0, syllable: 0, notes: [0] }, { line: 2, text: "Fire burns", word: 1, syllable: 0, notes: [1] }] };
  const bound = await bind.run(input, ctx) as LyricsState;
  const patched = await bind.run({ ...input, baseRevision: bound.revision, notationRevision: bound.notation!.revision, mode: "patch", bindings: [{ ...input.bindings[0]!, notes: [2] }] }, ctx) as LyricsState;
  assert.equal(patched.notation!.clips[0]!.bindings.length, 2);
  assert.deepEqual(patched.notation!.clips[0]!.bindings.find(binding => binding.word === 1)!.notes, [1]);
  assert.deepEqual(patched.notation!.clips[0]!.notes, notes);
});
