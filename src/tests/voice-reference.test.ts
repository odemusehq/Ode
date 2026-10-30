import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { VoiceReference } from "../mneme/voice-reference";
import { JsonFile } from "../mneme/json-file";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
import { AudioFileDecoder } from "../music/audio/decode";
import { audioHash } from "../services/music-audio";

const source = { track: { tag: "voice" }, start: 0, end: 8 };
const recording = (value: number) => encodeWav({ sampleRate: 8000, channels: [new Float32Array(400).fill(value)] }, WavBitDepth.Float32);

test("voice readiness needs positive consent and legacy consent remains explicit", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-voice-legacy-"));
  try {
    const voice = new VoiceReference(root);
    await writeFile(join(root, "reference.wav"), recording(0.25));
    for (const consent of [{ agreed: false }, {}, { agreed: true }]) {
      await writeFile(join(root, "consent.json"), JSON.stringify(consent));
      assert.equal(await voice.ready(), false);
    }
    await writeFile(join(root, "consent.json"), JSON.stringify({ agreed: true, time: new Date().toISOString(), source }));
    assert.equal(await voice.ready(), true);
    const snapshot = join(root, "snapshot.wav");
    await voice.withRecording(snapshot, async (path, evidence) => {
      assert.equal(evidence.consentBinding, "legacy-positive-unbound");
      assert.equal(audioHash(await readFile(path)), evidence.reference.sha256);
    });
    await assert.rejects(stat(snapshot), { code: "ENOENT" });
    await writeFile(join(root, "reference.wav"), recording(NaN));
    assert.equal(await voice.ready(), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("new voice references bind bytes and keep a frozen dispatch through replacement and cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-voice-bound-"));
  try {
    const folder = join(root, "Voice"), input = join(root, "input.wav");
    const voice = new VoiceReference(folder);
    await writeFile(input, recording(1.5));
    const saved = await voice.save(input, source);
    assert.equal(saved.consentBinding, "hash-bound");
    assert.equal(await voice.ready(), true);
    assert.equal((await stat(join(folder, "consent.json"))).mode & 0o777, 0o600);
    const snapshot = join(root, "snapshot.wav");
    await voice.withRecording(snapshot, async (path, evidence) => {
      const before = await readFile(path);
      assert.equal(new AudioFileDecoder().decode(before, path).channels[0]![0], 1.5);
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      await writeFile(input, recording(0.5));
      await new VoiceReference(folder).save(input, source);
      assert.deepEqual(await readFile(path), before);
      assert.equal(evidence.reference.sha256, saved.reference.sha256);
    });
    const manifest = await readFile(join(folder, "consent.json"), "utf8");
    const stop = new AbortController();
    const pending = voice.save(input, source, stop.signal);
    stop.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(await readFile(join(folder, "consent.json"), "utf8"), manifest);
    assert.equal(await voice.ready(), true);
    const originalWrite = JsonFile.writeAtomically;
    const stagingStop = new AbortController();
    JsonFile.writeAtomically = (path, text, mode, signal) => {
      queueMicrotask(() => stagingStop.abort());
      return originalWrite(path, text, mode, signal);
    };
    try { await assert.rejects(voice.save(input, source, stagingStop.signal), { name: "AbortError" }); }
    finally { JsonFile.writeAtomically = originalWrite; }
    assert.equal(await readFile(join(folder, "consent.json"), "utf8"), manifest);
    assert.equal((await readdir(folder)).filter((name) => name.endsWith(".wav")).length, 1);
    assert.equal((await readdir(folder)).some((name) => name.endsWith(".tmp")), false);
    await writeFile(snapshot, "existing file");
    await assert.rejects(voice.withRecording(snapshot, async () => undefined), { code: "EEXIST" });
    assert.equal(await readFile(snapshot, "utf8"), "existing file");
    const selected = JSON.parse(manifest).recording;
    await writeFile(join(folder, selected), recording(0.75));
    assert.equal(await voice.ready(), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("withdrawing voice consent cancels local dispatch and removes only retained voice files", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-voice-clear-"));
  try {
    const folder = join(root, "Voice"), input = join(root, "input.wav"), snapshot = join(root, "snapshot.wav");
    await mkdir(folder);
    await writeFile(input, recording(0.25));
    await writeFile(join(folder, "keep.txt"), "unrelated");
    const voice = new VoiceReference(folder);
    await voice.save(input, source);
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = voice.withRecording(snapshot, async (_path, _evidence, signal) => {
      entered();
      await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    });
    const stopped = assert.rejects(pending, { name: "AbortError" });
    await started;
    await new VoiceReference(folder).clear();
    await stopped;
    assert.equal(await voice.ready(), false);
    assert.deepEqual(await readdir(folder), ["keep.txt"]);
    await assert.rejects(stat(snapshot), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
