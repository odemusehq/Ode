import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LocalAudioFiles } from "../live/local-audio-files";
import { TempFolder } from "../mneme/paths";
import { AudioFileDecoder } from "../music/audio/decode";
import { HumTranscriber } from "../music/audio/hum";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
import { MusicAudio, audioHash, type FrozenMusicAudio } from "../services/music-audio";
import { OdeConfig } from "../shared/config";
import { ToolRegistry, type ToolOutcome } from "../tools";
import type { ToolContext } from "../tools/define";

function memo() {
  const sampleRate = 16_000;
  const channels = [Float32Array.from({ length: sampleRate * 2 }, (_, index) => {
    if (index < sampleRate * 0.1 || index > sampleRate * 1.9) return 0;
    const midi = index < sampleRate ? 61.2 : 63.2;
    return 0.25 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * index / sampleRate);
  })];
  return encodeWav({ sampleRate, channels });
}

function result(outcome: ToolOutcome): any { assert.equal(outcome.ok, true, outcome.text); return JSON.parse(outcome.text); }

test("an uploaded memo becomes MIDI locally with explicit timing and the exact same frozen ASR source", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-hum-file-")), freeze = MusicAudio.freeze;
  try {
    const work = join(root, "work"), library = new LocalAudioFiles(root, work), bytes = memo();
    const asset = await library.add({ name: "Voice memo.wav", bytes, purpose: "library", source: "Musician's melody memo" });
    const opened = await library.open(asset.id), catalogue = (await readdir(join(root, "Audio"))).sort();
    const metadata = await readFile(join(root, "Audio", `${asset.id}.json`), "utf8");
    const decoded = new AudioFileDecoder().decode(bytes, "memo", { rejectNonfinite: true });
    const baseline = new HumTranscriber(120).analyze(decoded);
    let nativeCalls = 0, transcribed = 0;
    const ctx = { config: new OdeConfig(root, work), temp: new TempFolder(work),
      live: { extension: { call: async () => { nativeCalls++; throw new Error("A file must not call Live"); } } },
      services: {
        available: async () => ({ transcription: true }),
        transcribe: async (source: FrozenMusicAudio) => {
          transcribed++;
          assert.notEqual(typeof source, "string");
          assert.ok(Buffer.from(source.bytes).equals(Buffer.from(bytes)));
          assert.equal(source.source.sha256, audioHash(bytes));
          return { text: "hello", turns: [{ text: "hello", start: 0.1, end: 1.8 }], timing: "speech-detection-approximate" };
        },
      },
    } as unknown as ToolContext;
    const registry = new ToolRegistry(ctx), input = { path: opened.path, assumedTempoBpm: 120 };
    const converted = result(await registry.run("hum_to_midi", input));
    assert.equal(baseline.notes.length, 2);
    assert.deepEqual(converted.notes, baseline.notes);
    assert.deepEqual(converted.originalNotes, baseline.originalNotes);
    assert.ok(Math.abs(converted.originalNotes[0].midi - Math.round(converted.originalNotes[0].midi)) > 0.05);
    assert.equal(converted.grid, null);
    assert.equal(converted.tuningCorrected, false);
    assert.deepEqual(converted.transformations, baseline.transformations);
    assert.equal(converted.source.sha256, audioHash(bytes));
    assert.equal(converted.source.provenance.id, asset.id);
    assert.deepEqual([converted.analyzedRange.firstFrame, converted.analyzedRange.endFrame, converted.analyzedRange.sourceFrames], [0, 32_000, 32_000]);
    assert.deepEqual(converted.suggestedClip, { placement: "unplaced", length: 4 });
    assert.equal(converted.timing.tempoSource, "explicit assumption");
    assert.equal(converted.timing.tempoAutomation, "unknown");
    assert.equal(nativeCalls, 0); assert.equal(transcribed, 0);

    ctx.services.available = async () => {
      await writeFile(opened.path, encodeWav({ sampleRate: 16_000, channels: [new Float32Array(32_000)] }));
      return { transcription: true } as never;
    };
    const words = result(await registry.run("hum_to_midi", { ...input, withWords: true }));
    assert.equal(transcribed, 1);
    assert.deepEqual(words.notes, baseline.notes);
    assert.equal(words.source.sha256, audioHash(bytes));
    assert.deepEqual(words.words.lines[0].notes, []);
    await writeFile(opened.path, bytes);
    const key = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] };
    const options = { quantize: true, snapToKey: true, correctTuning: true, cleanFragments: true };
    const transformed = result(await registry.run("hum_to_midi", { ...input, key, ...options }));
    assert.deepEqual(transformed.notes, new HumTranscriber(120, key, options).analyze(decoded).notes);
    assert.ok(transformed.grid !== null && transformed.tuningCorrected);
    const shortPath = join(work, "short.wav");
    await writeFile(shortPath, encodeWav({ sampleRate: 16_000,
      channels: [Float32Array.from({ length: 18_080 }, (_, index) => 0.25 * Math.sin(2 * Math.PI * 440 * index / 16_000))] }));
    const extended = result(await registry.run("hum_to_midi", { ...input, path: shortPath, quantize: true }));
    const sourceBeats = extended.analyzedRange.sourceDurationSeconds * 2;
    assert.ok(extended.noteEndBeats > sourceBeats, "This quantized note must exercise extension beyond the exact file duration.");
    assert.equal(extended.suggestedClip.length, extended.noteEndBeats, "An unplaced suggestion must hold every returned note without changing exact source duration.");
    assert.equal(extended.analyzedRange.sourceDurationSeconds, 1.13);

    for (const invalid of [
      { path: opened.path }, { ...input, assumedTempoBpm: 0 }, { ...input, track: { index: 0 }, start: 0, end: 4 },
      { ...input, start: 0 }, { ...input, fromSeconds: 0.5 }, { ...input, toSeconds: 1 },
      { ...input, snapToKey: true }, { ...input, key }, { ...input, snapToKey: true, key: { root: 0, intervals: [] } },
      { track: { index: 0 }, start: 0, end: 4, assumedTempoBpm: 120 },
    ]) assert.equal((await registry.run("hum_to_midi", invalid)).ok, false);
    const outside = join(root, "outside.wav"); await writeFile(outside, bytes);
    assert.equal((await registry.run("hum_to_midi", { ...input, path: outside })).ok, false);
    for (const [name, bad] of [["empty.wav", encodeWav({ sampleRate: 16_000, channels: [new Float32Array()] })],
      ["nonfinite.wav", encodeWav({ sampleRate: 16_000, channels: [Float32Array.of(NaN)] }, WavBitDepth.Float32)],
      ["unsupported.mp3", Buffer.from("ID3not-supported")]] as const) {
      const path = join(work, name); await writeFile(path, bad);
      assert.equal((await registry.run("hum_to_midi", { ...input, path, withWords: true })).ok, false);
    }
    const stopped = new AbortController();
    MusicAudio.freeze = async (path) => { const captured = await freeze(path); stopped.abort(); return captured; };
    assert.equal((await registry.run("hum_to_midi", { ...input, withWords: true }, stopped.signal)).ok, false);
    assert.equal(nativeCalls, 0); assert.equal(transcribed, 1);
    assert.deepEqual((await readdir(join(root, "Audio"))).sort(), catalogue);
    assert.equal(await readFile(join(root, "Audio", `${asset.id}.json`), "utf8"), metadata);
    assert.ok(Buffer.from((await library.readVerified(asset.id)).bytes).equals(Buffer.from(bytes)));
  } finally { MusicAudio.freeze = freeze; await rm(root, { recursive: true, force: true }); }
});

test("Arrangement hum conversion retains requested placement and describes a deleted pre-FX capture", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-hum-arrangement-"));
  try {
    const bytes = memo(), path = join(root, "capture.wav"), calls: string[] = [];
    const ctx = { config: new OdeConfig(root, root), temp: new TempFolder(root), live: { extension: { call: async (op: string) => {
      calls.push(op);
      if (op === "song_get") return { tempo: 120, scaleMode: false, rootNote: 0, scaleName: "Major", scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
        tracks: [{ index: 0, kind: "audio", name: "Voice", tag: "voice" }], returnTracks: [] };
      assert.equal(op, "render_track_audio"); await writeFile(path, bytes); return { path };
    } } } } as unknown as ToolContext;
    const converted = result(await new ToolRegistry(ctx).run("hum_to_midi", { track: { tag: "voice" }, start: 8, end: 12 }));
    assert.deepEqual(converted.suggestedClip, { start: 8, length: 4 });
    assert.equal(converted.source.sha256, audioHash(bytes));
    assert.equal(converted.source.retained, false);
    assert.match(JSON.stringify(converted.source), /pre-effects|pre-FX|pre-fader/i);
    assert.equal(JSON.stringify(converted).includes(path), false);
    assert.equal(await stat(path).then(() => true, () => false), false);
    assert.equal(calls.filter((op) => op === "render_track_audio").length, 1);
    assert.equal(converted.timing.tempoSource, "observed Set tempo");
    assert.equal(converted.timing.tempoAutomation, "unknown");
    assert.equal(converted.notesExceedRequestedLength, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
