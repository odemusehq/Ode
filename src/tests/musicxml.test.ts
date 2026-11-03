import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { SongFile } from "../mneme/song-file";
import { MusicXml } from "../mneme/musicxml";
import { LyricsDocument } from "../shared/lyrics-document";
import { emptyLeadSheet } from "../shared/song";

test("MusicXML keeps unfinished text, analysis and deliberate syllables without inventing notes", () => {
  const text = '[Verse]\n  Fire & rain — "again"!\n\n[Chorus]\nStay <here>\n';
  const notation = LyricsDocument.empty();
  const sheet = { ...emptyLeadSheet(), title: "Fire & rain", lyrics: text, notation };
  const xml = MusicXml.write(sheet);
  assert.match(xml, /<score-partwise version="4.0">/);
  assert.equal(new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("note").length, 0);
  assert.deepEqual(MusicXml.read(xml), sheet);
});

test("assigned syllables use native MusicXML lyrics and IPA, and native pitch edits are read back", () => {
  const sheet = emptyLeadSheet();
  sheet.lyrics = "[Chorus]\nMusic sets us free";
  sheet.notation = LyricsDocument.empty();
  sheet.notation.analysis = { text: sheet.lyrics, accent: "uk", check: { lines: [{ words: [
    { text: "Music", syllables: ["Mu", "sic"], stress: [1, 0], ipa: ["ˈmjuː", "zɪk"] },
    { text: "sets", syllables: ["sets"], stress: [1] }, { text: "us", syllables: ["us"], stress: [0] },
    { text: "free", syllables: ["free"], stress: [1], ipa: ["friː"] },
  ], rhyme: { letter: "", quality: "none", sound: "", part: "" } }] } };
  sheet.notation.clips = [{ id: "guide", clip: { tag: "vocal" }, notes: [
    { pitch: 72, start: 0, duration: 1.5, velocity: 83, probability: 0.9 },
    { pitch: 71, start: 1.5, duration: 0.5, velocity: 78, muted: false },
  ], bindings: [{ line: 2, text: "Music sets us free", word: 3, syllable: 0, notes: [0, 1] }] }];
  const xml = MusicXml.write(sheet);
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  assert.equal(dom.getElementsByTagName("syllabic")[0]?.textContent, "single");
  assert.equal(dom.getElementsByTagName("ipa")[0]?.textContent, "friː");
  assert.equal(dom.getElementsByTagName("extend").length, 2);
  assert.deepEqual(MusicXml.read(xml), sheet);
  dom.getElementsByTagName("step")[0]!.textContent = "D";
  const edited = MusicXml.read(new XMLSerializer().serializeToString(dom));
  assert.equal(edited.notation!.clips[0]!.notes[0]!.pitch, 74);
  assert.equal(edited.notation!.clips[0]!.notes[0]!.probability, 0.9);
  assert.equal(edited.lyrics, sheet.lyrics);
});

test("a changed line keeps its music for reconciliation and cannot reuse stale syllable assignments", () => {
  const notation = LyricsDocument.empty();
  notation.clips = [{ id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 1 }],
    bindings: [{ line: 2, text: "Stay here", word: 0, syllable: 0, notes: [0] }] }];
  const moved = LyricsDocument.reconcile(notation, "[Chorus]\nStay here", "[Intro]\n\n[Chorus]\nStay here");
  assert.equal(moved.clips[0]!.bindings[0]!.line, 4);
  const changed = LyricsDocument.reconcile(moved, "[Intro]\n\n[Chorus]\nStay here", "[Intro]\n\n[Chorus]\nCome home");
  assert.equal(changed.clips[0]!.bindings[0]!.stale, true);
  assert.deepEqual(changed.clips[0]!.notes, notation.clips[0]!.notes);
});

test("legacy songs migrate to one authoritative MusicXML file without deleting the source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-musicxml-"));
  const sheet = { ...emptyLeadSheet(), title: "Existing song", lyrics: "[Verse]\nKeep every word" };
  await writeFile(join(dir, "song.json"), JSON.stringify(sheet));
  const file = new SongFile(dir);
  assert.equal((await file.read()).lyrics, sheet.lyrics);
  await file.update(current => ({ ...current, title: "Revised" }));
  assert.match(await readFile(join(dir, "song.musicxml"), "utf8"), /score-partwise/);
  assert.equal(JSON.parse(await readFile(join(dir, "song.json"), "utf8")).title, "Existing song");
  assert.equal((await new SongFile(dir).read()).title, "Revised");
  await writeFile(join(dir, "song.musicxml"), "<damaged>");
  await assert.rejects(new SongFile(dir).read());
  assert.equal(JSON.parse(await readFile(join(dir, "song.json"), "utf8")).lyrics, sheet.lyrics);
});
