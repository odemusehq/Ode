import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../music/audio/decode";
import { writeWav } from "../music/audio/wav";
import { TempFolder } from "../mneme/paths";
import { OpenAiCompatibleAudioUnderstander } from "../services/adapters/openai-compatible-audio";
import { audioHash } from "../services/music-audio";
import { mediaTools } from "../tools/media";

test("listening sends the selected source frames, keeping stereo and whole-file identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-listen-range-"));
  const originalFetch = globalThis.fetch;
  try {
    const path = join(directory, "reference.wav");
    const samples = Float32Array.from({ length: 16_000 }, (_, frame) => frame < 8_000 ? 0.1 : 0.6);
    await writeWav(path, { sampleRate: 8_000, channels: [samples, samples.map((sample) => sample / 2)] });
    let calls = 0, sent = new Uint8Array();
    globalThis.fetch = async (_url, options) => {
      calls++;
      const request = JSON.parse(String(options?.body));
      sent = Buffer.from(request.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data, "base64");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: "A short sustained sound." } }] });
    };
    const listener = new OpenAiCompatibleAudioUnderstander({ provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "audio" });
    const ctx = { temp: new TempFolder(directory), services: { describeAudio: listener.describe.bind(listener), compareAudio: listener.compare.bind(listener) } } as never;
    const describe = mediaTools.find((tool) => tool.name === "audio_describe")!;
    const result: any = await describe.run({ path, fromSeconds: 1, toSeconds: 1.25, question: "Describe this entrance" }, ctx);
    const decoded = new AudioFileDecoder().decode(sent, "sent.wav");
    assert.equal(decoded.channels.length, 2);
    assert.equal(decoded.channels[0]!.length, 2_000);
    assert.ok(Math.abs(decoded.channels[0]![0]! - 0.6) < 0.001);
    assert.ok(Math.abs(decoded.channels[1]![0]! - 0.3) < 0.001);
    assert.equal(result.source.sha256, result.evidence.sources[0].sha256);
    assert.equal(result.evidence.sources[0].frames, 16_000);
    assert.equal(result.evidence.sources[0].selection.firstFrame, 8_000);
    assert.equal(result.evidence.sources[0].selection.endFrame, 10_000);
    assert.equal(result.evidence.payload.sha256, audioHash(sent));
    await assert.rejects(describe.run({ path, toSeconds: 3, question: "Describe it" }, ctx), /within this recording/);
    assert.equal(calls, 1);
    await assert.rejects(describe.run({ track: { tag: "voice" }, start: 0, end: 4, fromSeconds: 1, question: "Describe it" }, ctx), /file passage/);

    const compare = mediaTools.find((tool) => tool.name === "audio_compare")!;
    const paired: any = await compare.run({ a: path, b: path, aRange: { fromSeconds: 0.2, toSeconds: 0.7 }, bRange: { fromSeconds: 1.1, toSeconds: 1.35 }, question: "Compare the entrances", levelMatch: false }, ctx);
    const pairAudio = new AudioFileDecoder().decode(sent, "pair.wav");
    assert.equal(pairAudio.channels[0]!.length, 10_000);
    assert.ok(Math.abs(pairAudio.channels[0]![0]! - 0.1) < 0.001);
    assert.equal(pairAudio.channels[0]![6_000], 0);
    assert.ok(Math.abs(pairAudio.channels[0]![8_000]! - 0.6) < 0.001);
    assert.equal(paired.evidence.sources[0].selection.firstFrame, 1_600);
    assert.equal(paired.evidence.sources[1].selection.firstFrame, 8_800);
    assert.equal(paired.comparison.b.startSeconds, 1);
    assert.equal(paired.evidence.sources[1].selection.fromSeconds, 1.1);
    assert.equal(paired.evidence.payload.sha256, audioHash(sent));
  } finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
});
