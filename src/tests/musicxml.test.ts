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
    { pitch: 71, start: 1.5 + 1e-15, duration: 0.5, velocity: 78, muted: false },
  ], bindings: [{ line: 2, text: "Music sets us free", word: 3, syllable: 0, notes: [0, 1] }] }];
  const xml = MusicXml.write(sheet);
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  assert.equal(dom.getElementsByTagName("syllabic")[0]?.textContent, "single");
  assert.equal(dom.getElementsByTagName("ipa")[0]?.textContent, "friː");
  assert.equal(dom.getElementsByTagName("extend").length, 2);
  assert.equal(Array.from(dom.getElementsByTagName("duration")).some(node => /e/i.test(node.textContent ?? "")), false);
  assert.deepEqual(MusicXml.read(xml), sheet);
  dom.getElementsByTagName("step")[0]!.textContent = "D";
  const edited = MusicXml.read(new XMLSerializer().serializeToString(dom));
  assert.equal(edited.notation!.clips[0]!.notes[0]!.pitch, 74);
  assert.equal(edited.notation!.clips[0]!.notes[0]!.probability, 0.9);
  assert.equal(edited.lyrics, sheet.lyrics);
  dom.getElementsByTagName("text")[0]!.textContent = "different";
  assert.throws(() => MusicXml.read(new XMLSerializer().serializeToString(dom)), /lyric|underlay/i);
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

test("a metered MusicXML score retains barlines and ties without splitting the sung syllable or native note", () => {
  const sheet = emptyLeadSheet();
  sheet.lyrics = "[Chorus]\nFire";
  sheet.notation = LyricsDocument.empty();
  sheet.notation.analysis = { text: sheet.lyrics, accent: "uk", check: { lines: [{ words: [{ text: "Fire", syllables: ["Fire"], stress: [1] }], rhyme: { letter: "", quality: "none", part: "", sound: "" } }] } };
  const clip = { id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 64, start: 2.5, duration: 1.5, velocity: 83, probability: 0.8 }], bindings: [{ line: 2, text: "Fire", word: 0, syllable: 0, notes: [0] }],
    measures: [{ number: "1", start: 0, length: 3, meter: { beats: "3", beatType: 4 } }, { number: "2", start: 3, length: 3, meter: { beats: "3", beatType: 4 } }] };
  sheet.notation.clips = [clip];
  const xml = MusicXml.write(sheet);
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  assert.equal(dom.getElementsByTagName("measure").length, 2);
  assert.equal(dom.getElementsByTagName("beats")[0]?.textContent, "3");
  assert.equal(dom.getElementsByTagName("tie").length, 2);
  assert.equal(dom.getElementsByTagName("text").length, 1);
  const read = MusicXml.read(xml).notation!.clips[0]!;
  assert.deepEqual(read.notes, clip.notes);
  assert.deepEqual(read.bindings, clip.bindings);
  assert.deepEqual(LyricsDocument.position(read, 2.5), { measure: "1", beat: 3.5, meter: { beats: "3", beatType: 4 } });
  assert.deepEqual(LyricsDocument.position(read, 3), { measure: "2", beat: 1, meter: { beats: "3", beatType: 4 } });
  const tie = dom.getElementsByTagName("tie")[0]!;
  tie.parentNode!.removeChild(tie);
  assert.throws(() => MusicXml.read(new XMLSerializer().serializeToString(dom)), /tie/i);
  const edge = { ...clip, notes: [{ pitch: 64, start: 3 - 1e-15, duration: 1, velocity: 83, probability: 0.8 }] };
  const edgeRead = MusicXml.read(MusicXml.write({ ...sheet, notation: { ...sheet.notation!, clips: [edge] } }));
  assert.deepEqual(edgeRead.notation!.clips[0]!.notes, edge.notes);
  edge.notes = [{ pitch: 64, start: 128.75, duration: 1 / 3, velocity: 83, probability: 0.8 }];
  const tripletXml = MusicXml.write({ ...sheet, notation: { ...sheet.notation!, clips: [edge] } });
  assert.match(tripletXml, /<actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes>/);
  assert.deepEqual(MusicXml.read(tripletXml).notation!.clips[0]!.notes, edge.notes);
});

test("bar numbers and time changes are read from the native XML, including pickups and denominator beat units", () => {
  const sheet = emptyLeadSheet();
  sheet.notation = LyricsDocument.empty();
  sheet.notation.clips = [{ id: "guide", clip: { tag: "vocal" }, notes: [{ pitch: 60, start: 0, duration: 0.5 }, { pitch: 62, start: 2.5, duration: 0.5 }], bindings: [],
    measures: [{ number: "0", start: 0, length: 0.5, implicit: true, meter: { beats: "6", beatType: 8 } }, { number: "1", start: 0.5, length: 3, meter: { beats: "6", beatType: 8 } }] }];
  const dom = new DOMParser().parseFromString(MusicXml.write(sheet), "application/xml");
  dom.getElementsByTagName("measure")[1]!.setAttribute("number", "Verse-A");
  const second = dom.getElementsByTagName("measure")[1]!;
  const padding = second.getElementsByTagName("forward");
  const lastPadding = padding[padding.length - 1]!;
  second.removeChild(lastPadding); // The edited 5/8 bar ends with the last note, without the old 6/8 padding.
  const attributes = dom.getElementsByTagName("attributes")[1]!;
  const time = dom.createElement("time"), beats = dom.createElement("beats"), unit = dom.createElement("beat-type");
  beats.textContent = "3+2"; unit.textContent = "8"; time.appendChild(beats); time.appendChild(unit); attributes.appendChild(time);
  const read = MusicXml.read(new XMLSerializer().serializeToString(dom)).notation!.clips[0]!;
  assert.deepEqual(LyricsDocument.position(read, 0), { measure: "0", beat: 6, meter: { beats: "6", beatType: 8 } });
  assert.deepEqual(LyricsDocument.position(read, 2.5), { measure: "Verse-A", beat: 5, meter: { beats: "3+2", beatType: 8 } });
  assert.match(MusicXml.write({ ...sheet, notation: { ...sheet.notation!, clips: [read] } }), /<beats>3\+2<\/beats>/);
  const late = dom.createElement("attributes");
  late.appendChild(time.cloneNode(true)); second.appendChild(late);
  assert.throws(() => MusicXml.read(new XMLSerializer().serializeToString(dom)), /mid-bar|boundary/i);
});

test("unmeasured drafts do not acquire an invented beat grid", () => {
  const clip = { id: "draft", clip: { tag: "draft" }, notes: [{ pitch: 60, start: 2, duration: 1 }], bindings: [] };
  assert.equal(LyricsDocument.position(clip, 2), undefined);
});
