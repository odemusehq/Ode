import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { writeWav, WavBitDepth } from "../audio/wav";
import { MusicAudio } from "../services/music-audio";
import { OpenAiCompatibleAudioUnderstander } from "../services/adapters/openai-compatible-audio";

test("listening preserves stereo and rejects empty, refused and truncated responses", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-listening-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(dir, "stereo.wav");
    const left = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 10) * 0.25);
    await writeWav(path, { sampleRate: 48_000, channels: [left, left.map((value) => -value)] });
    let choice: unknown = { finish_reason: "stop", message: { role: "assistant", content: "An audible stereo signal." } };
    let sent: any;
    globalThis.fetch = async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return new Response(JSON.stringify({ choices: choice ? [choice] : [] }), { headers: { "Content-Type": "application/json" } });
    };
    const listener = new OpenAiCompatibleAudioUnderstander({ provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "muse-spark-1.2" });
    const described = await listener.describe(path, "What sounds?") as any;
    assert.equal(described.answer, "An audible stereo signal.");
    assert.match(described.evidence.prompt, /Float32 WAV/);
    assert.doesNotMatch(described.evidence.prompt, /PCM24|uniformly attenuated/);
    const encoded = sent.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data;
    const audio = new AudioFileDecoder().decode(Buffer.from(encoded, "base64"), "request.wav");
    assert.equal(described.evidence.payload.sha256, createHash("sha256").update(Buffer.from(encoded, "base64")).digest("hex"));
    assert.equal(described.evidence.criteria, "What sounds?");
    assert.equal(described.evidence.sources[0].sha256, createHash("sha256").update(await readFile(path)).digest("hex"));
    assert.equal(audio.channels.length, 2);
    assert.equal(audio.sampleRate, 48_000);
    const comparison = await listener.compare(path, path, "Compare the stereo examples", false);
    const paired = new AudioFileDecoder().decode(Buffer.from(sent.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data, "base64"), "comparison.wav");
    assert.equal(paired.channels[0]?.length, 4800 * 2 + 24_000);
    assert.equal(comparison.comparison.levelMatched, false);
    assert.deepEqual(comparison.comparison.gainDb, [0, 0]);
    await assert.rejects(listener.compare(path, path, "Match levels", true), /Ableton|plug-in backend/i);
    const baseten = new OpenAiCompatibleAudioUnderstander({ provider: "baseten", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "meta-models/muse-spark-open-1026" });
    const heard = await baseten.describe(path, "What sounds?");
    const dataUrl = sent.messages[0].content.find((part: any) => part.type === "audio_url")?.audio_url.url;
    assert.ok(dataUrl?.startsWith("data:audio/wav;base64,"));
    assert.equal(heard.evidence.payload.sha256, createHash("sha256").update(Buffer.from(dataUrl.split(",")[1], "base64")).digest("hex"));
    for (choice of [null, { finish_reason: "length", message: { content: "The chorus, but" } }, { finish_reason: "stop", message: { content: "" } }, { finish_reason: "stop", message: { content: null, refusal: "No" } }]) {
      await assert.rejects(() => listener.describe(path, "Evaluate it"), /incomplete|empty|refus|answer/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});

test("empty listening is refused before dispatch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-listening-format-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(dir, "empty.wav");
    await writeWav(path, { sampleRate: 48_000, channels: [new Float32Array(0)] });
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("Empty audio must not be dispatched"); };
    const role = { provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "audio" };
    await assert.rejects(new OpenAiCompatibleAudioUnderstander(role).describe(path, "Listen"), /empty|zero|samples|frames/i);
    assert.equal(calls, 0);

  } finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
});

test("nonfinite PCM and inconsistent channel lengths cannot become listening evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-invalid-listening-"));
  try {
    const path = join(dir, "bad.wav");
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.from([0, Number.NaN, Infinity])] }, WavBitDepth.Float32);
    await assert.rejects(new MusicAudio().prepare(await MusicAudio.freeze(path)), /nonfinite|finite/i);
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.from([0, 0.1, 0.2])] });
    const source = await MusicAudio.freeze(path);
    const prepared = await new MusicAudio().prepare(source);
    // Cached arrays are no longer an input: samples are decoded from the captured source bytes for each operation.
    const injected = { ...source, audio: { sampleRate: 1, channels: [Float32Array.from([0.5])] } };
    assert.equal((await new MusicAudio().prepare(injected)).payload.sha256, prepared.payload.sha256);
    source.source.frames = 999;
    assert.equal(prepared.sources[0]!.frames, 3);
    assert.equal((await new MusicAudio().prepare(source)).sources[0]!.frames, 3);
    const broken = Uint8Array.from(source.bytes);
    new DataView(broken.buffer).setUint16(22, 2, true); // Six mono data bytes cannot form whole stereo frames.
    await assert.rejects(new MusicAudio().prepare({ bytes: broken, source: { ...source.source, sha256: createHash("sha256").update(broken).digest("hex") } }), /channel|frame/i);
    await writeWav(path, { sampleRate: 48_000, channels: [Float32Array.of(1.2)] }, WavBitDepth.Float32);
    const headroom = await new MusicAudio().prepare(await MusicAudio.freeze(path));
    assert.equal(headroom.payload.representation.encoding, "Float32 WAV");
    assert.equal(headroom.payload.representation.gainDb, 0);
    assert.ok(Math.abs(new AudioFileDecoder().decode(headroom.bytes, "payload.wav").channels[0]![0]! - 1.2) < 0.000001);
    source.bytes[source.bytes.length - 1]! ^= 1;
    await assert.rejects(new MusicAudio().prepare(source), /captured.*changed/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
