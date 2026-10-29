import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../music/audio/decode";
import { writeWav } from "../music/audio/wav";
import { OpenAiCompatibleAudioUnderstander } from "../services/adapters/openai-compatible-audio";
import { SelfHostedSingingVoice, SelfHostedStemSeparator } from "../services/adapters/self-hosted";

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
    assert.equal(await listener.describe(path, "What sounds?"), "An audible stereo signal.");
    const encoded = sent.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data;
    const audio = new AudioFileDecoder().decode(Buffer.from(encoded, "base64"), "request.wav");
    assert.equal(audio.channels.length, 2);
    assert.equal(audio.sampleRate, 48_000);
    const comparison = await listener.compare(path, path, "Compare the stereo examples", false);
    const paired = new AudioFileDecoder().decode(Buffer.from(sent.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data, "base64"), "comparison.wav");
    assert.equal(paired.channels[0]?.length, 4800 * 2 + 24_000);
    assert.equal(comparison.comparison.levelMatched, false);
    for (choice of [null, { finish_reason: "length", message: { content: "The chorus, but" } }, { finish_reason: "stop", message: { content: "" } }, { finish_reason: "stop", message: { content: null, refusal: "No" } }]) {
      await assert.rejects(() => listener.describe(path, "Evaluate it"), /incomplete|empty|refus|answer/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
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
