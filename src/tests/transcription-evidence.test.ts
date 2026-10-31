import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { writeWav, WavBitDepth } from "../audio/wav";
import { MetaTranscriber } from "../services/adapters/transcribers";
import { audioHash, MusicAudio } from "../services/music-audio";
import { SpeechAudio } from "../services/speech-audio";

const role = { provider: "meta", baseUrl: "https://example.invalid", apiKey: "offline", model: "asr" };

test("ASR passes through exact provider-ready speech bytes despite later file changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-asr-evidence-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(directory, "vocal.wav");
    const mono = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 10) * 0.5);
    await writeWav(path, { sampleRate: 24_000, channels: [mono] }, WavBitDepth.Int16);
    const original = await readFile(path);
    let sent: Uint8Array;
    globalThis.fetch = async (_url, options) => {
      const form = options?.body as FormData;
      sent = new Uint8Array(await (form.get("audio") as Blob).arrayBuffer());
      await writeWav(path, { sampleRate: 8_000, channels: [new Float32Array(8)] });
      return Response.json({ transcript: "Stay", turns: [{ startMs: 10, endMs: 80, transcript: "Stay" }] });
    };
    const result = await new MetaTranscriber(role, new SpeechAudio()).transcribe(path);
    assert.equal(result.evidence?.source.sha256, audioHash(original));
    assert.equal(result.evidence?.source.frames, 2400);
    assert.equal(result.evidence?.payload.sha256, audioHash(sent!));
    assert.deepEqual(sent!, new Uint8Array(original));
    assert.equal(result.evidence?.payload.representation.mixing, "none");
    assert.equal(result.evidence?.payload.representation.resampling, "none");
    assert.equal(result.evidence?.provider, "meta");
    assert.equal(result.evidence?.model, "asr");
    const payload = new AudioFileDecoder().decode(sent!, "sent.wav");
    assert.equal(payload.channels.length, 1);
    assert.equal(payload.sampleRate, 24_000);
    assert.equal(payload.channels[0]?.length, 2400);
    assert.equal(result.evidence?.payload.representation.sourceChannels, 1);
    assert.deepEqual(result.turns, [{ start: 0.01, end: 0.08, text: "Stay" }]);
    assert.equal(result.evidence?.transcriptHash, audioHash(Buffer.from(JSON.stringify({ text: result.text, turns: result.turns, timing: result.timing }))));
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});

test("ASR rejects incompatible native formats before dispatch; captured speech never rereads its path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-asr-invalid-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(directory, "vocal.wav");
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("No dispatch expected"); };
    const transcriber = new MetaTranscriber(role, new SpeechAudio());
    await writeWav(path, { sampleRate: 48_000, channels: [new Float32Array(0)] });
    await assert.rejects(transcriber.transcribe(path), /zero sample frames/);
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.from([0, NaN])] }, WavBitDepth.Float32);
    await assert.rejects(transcriber.transcribe(path), /mono PCM16 WAV/);
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.of(0)] }, WavBitDepth.Int16);
    await assert.rejects(transcriber.transcribe(path), /16 or 24 kHz/);
    await writeWav(path, { sampleRate: 24_000, channels: [Float32Array.of(0), Float32Array.of(0)] }, WavBitDepth.Int16);
    await assert.rejects(transcriber.transcribe(path), /mono PCM16 WAV/);
    assert.equal(calls, 0);
    await writeWav(path, { sampleRate: 16_000, channels: [new Float32Array(32)] }, WavBitDepth.Int16);
    const frozen = await MusicAudio.freeze(path);
    await rm(path);
    const speech = await new SpeechAudio().prepare(frozen);
    assert.equal(speech.payload.representation.frames, 32);
    assert.equal(speech.source.sha256, frozen.source.sha256);
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});
