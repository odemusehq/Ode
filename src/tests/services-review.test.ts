import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../music/audio/decode";
import { writeWav, WavBitDepth } from "../music/audio/wav";
import { MusicAudio } from "../services/music-audio";
import { OpenAiCompatibleAudioUnderstander } from "../services/adapters/openai-compatible-audio";
import { SelfHostedSingingVoice, SelfHostedStemSeparator } from "../services/adapters/self-hosted";
import { ElevenLabsSoundGenerator } from "../services/adapters/elevenlabs-sound";

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

test("empty listening is refused before dispatch and generated sounds request real WAV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-listening-format-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(dir, "empty.wav");
    await writeWav(path, { sampleRate: 48_000, channels: [new Float32Array(0)] });
    let calls = 0;
    let url = "";
    const valid = join(dir, "valid.wav");
    await writeWav(valid, { sampleRate: 44_100, channels: [new Float32Array(4410)] });
    const bytes = await readFile(valid);
    globalThis.fetch = async (input) => { calls++; url = String(input); return new Response(bytes, { headers: { "Content-Type": "audio/wav" } }); };
    const role = { provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "audio" };
    await assert.rejects(new OpenAiCompatibleAudioUnderstander(role).describe(path, "Listen"), /empty|zero|samples|frames/i);
    assert.equal(calls, 0);
    const generated = await new ElevenLabsSoundGenerator({ ...role, baseUrl: "https://example.invalid" }).generate("Soft impact", 1, join(dir, "generated.mp3"), false);
    assert.equal(new URL(url).searchParams.get("output_format"), "wav_44100");
    assert.match(generated, /\.wav$/);
    assert.deepEqual(await readFile(generated), bytes);
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
    source.bytes[source.bytes.length - 1]! ^= 1;
    await assert.rejects(new MusicAudio().prepare(source), /captured.*changed/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("self-hosted separation sends WAV for AIFF input and rejects unsupported vocal instructions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-separation-"));
  const originalFetch = globalThis.fetch;
  try {
    const bytes = Buffer.alloc(58);
    bytes.write("FORM"); bytes.writeUInt32BE(50, 4); bytes.write("AIFFCOMM", 8); bytes.writeUInt32BE(18, 16);
    bytes.writeUInt16BE(1, 20); bytes.writeUInt32BE(2, 22); bytes.writeUInt16BE(16, 26);
    bytes.set([0x40, 0x0e, 0xbb, 0x80, 0, 0, 0, 0, 0, 0], 28);
    bytes.write("SSND", 38); bytes.writeUInt32BE(12, 42); bytes.writeInt16BE(1000, 54); bytes.writeInt16BE(-1000, 56);
    const input = join(dir, "source.aiff");
    await writeFile(input, bytes);
    const role = { provider: "self-hosted", baseUrl: "https://example.invalid", apiKey: "offline", model: "local" };
    let sent: any;
    globalThis.fetch = async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return Response.json({ target: sent.audio, rest: sent.audio });
    };
    const result = await new SelfHostedStemSeparator(role).separate(input, "voice", dir);
    assert.equal(Buffer.from(sent.audio.wavBase64, "base64").subarray(0, 4).toString(), "RIFF");
    assert.equal(new AudioFileDecoder().inspect(await readFile(result.target), "target.wav").sampleRate, 48_000);
    await assert.rejects(() => new SelfHostedSingingVoice(role).sing({ tempo: 120, voiceModel: input, lines: [{ text: "stay here", notes: [{ pitch: 60, start: 0, duration: 1 }], delivery: "quiet" }] }, join(dir, "vocal.wav")), /cannot preserve/i);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
