import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TempFolder } from "../mneme/paths";
import { AudioFileDecoder } from "../music/audio/decode";
import { writeWav, WavBitDepth } from "../music/audio/wav";
import { MetaTranscriber } from "../services/adapters/transcribers";
import { audioHash, MusicAudio } from "../services/music-audio";
import { SpeechAudio } from "../services/speech-audio";
import { mediaTools } from "../tools/media";

const role = { provider: "meta", baseUrl: "https://example.invalid", apiKey: "offline", model: "asr" };

test("ASR evidence binds the frozen source and actual mono resampled payload despite later file changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-asr-evidence-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(directory, "vocal.wav");
    const left = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 10) * 0.5);
    await writeWav(path, { sampleRate: 48_000, channels: [left, left.map((sample) => sample * 0.5)] });
    const original = await readFile(path);
    let sent: Uint8Array;
    globalThis.fetch = async (_url, options) => {
      const form = options?.body as FormData;
      sent = new Uint8Array(await (form.get("audio") as Blob).arrayBuffer());
      await writeWav(path, { sampleRate: 8_000, channels: [new Float32Array(8)] });
      return Response.json({ transcript: "Stay", turns: [{ startMs: 10, endMs: 80, transcript: "Stay" }] });
    };
    const result = await new MetaTranscriber(role, new SpeechAudio(16_000)).transcribe(path);
    assert.equal(result.evidence?.source.sha256, audioHash(original));
    assert.equal(result.evidence?.source.frames, 4800);
    assert.equal(result.evidence?.payload.sha256, audioHash(sent!));
    assert.equal(result.evidence?.provider, "meta");
    assert.equal(result.evidence?.model, "asr");
    const payload = new AudioFileDecoder().decode(sent!, "sent.wav");
    assert.equal(payload.channels.length, 1);
    assert.equal(payload.sampleRate, 16_000);
    assert.equal(payload.channels[0]?.length, 1600);
    assert.equal(result.evidence?.payload.representation.sourceChannels, 2);
    assert.deepEqual(result.turns, [{ start: 0.01, end: 0.08, text: "Stay" }]);
    assert.equal(result.evidence?.transcriptHash, audioHash(Buffer.from(JSON.stringify({ text: result.text, turns: result.turns, timing: result.timing }))));
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});

test("ASR rejects zero frames and nonfinite PCM before dispatch; captured speech never rereads its path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-asr-invalid-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(directory, "vocal.wav");
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("No dispatch expected"); };
    const transcriber = new MetaTranscriber(role, new SpeechAudio(16_000));
    await writeWav(path, { sampleRate: 48_000, channels: [new Float32Array(0)] });
    await assert.rejects(transcriber.transcribe(path), /zero sample frames/);
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.from([0, NaN])] }, WavBitDepth.Float32);
    await assert.rejects(transcriber.transcribe(path), /nonfinite/);
    assert.equal(calls, 0);
    await writeWav(path, { sampleRate: 16_000, channels: [new Float32Array(32)] });
    const frozen = await MusicAudio.freeze(path);
    await rm(path);
    const speech = await new SpeechAudio(16_000).prepare(frozen);
    assert.equal(speech.payload.representation.frames, 32);
    assert.equal(speech.source.sha256, frozen.source.sha256);
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});

test("vocal detection seconds stay canonical and beat estimates require an explicit tempo assumption", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-asr-times-"));
  try {
    const path = join(directory, "vocal.wav");
    await writeWav(path, { sampleRate: 16_000, channels: [new Float32Array(16)] });
    const tool = mediaTools.find((entry) => entry.name === "vocal_transcribe")!;
    const transcript = { text: "Stay", turns: [{ start: 1, end: 2, text: "Stay" }], timing: "speech-detection-approximate" };
    const ctx = { temp: new TempFolder(directory), services: { transcribe: async () => transcript } } as never;
    const seconds: any = await tool.run({ path }, ctx);
    assert.deepEqual(seconds.turns, transcript.turns);
    assert.equal(seconds.beatEstimates, undefined);
    const assumed: any = await tool.run({ path, assumedTempoBpm: 120 }, ctx);
    assert.deepEqual(assumed.turns, transcript.turns);
    assert.equal(assumed.beatEstimates.turns[0].startBeat, 2);
    assert.equal(assumed.beatEstimates.turns[0].endBeat, 4);
    assert.equal(assumed.beatEstimates.tempoAutomation, "unknown");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
