import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { encodeWav, writeWav, WavBitDepth } from "../audio/wav";
import { TempFolder } from "../mneme/paths";
import { MusicAudio, audioHash } from "../services/music-audio";
import { TOOL_MEDIA } from "../tools/define";
import { listeningTools } from "../tools/daw/state/listening";

test("preparing audio lets the host process its Max heartbeat", async () => {
  const bytes = encodeWav({ sampleRate: 8_000, channels: [new Float32Array(80_000).fill(0.25)] }, WavBitDepth.Float32);
  const source = { ...new AudioFileDecoder().inspect(bytes, "reference.wav"), sha256: audioHash(bytes), bytes: bytes.length, capturedAt: new Date().toISOString() };
  let ticked = false;
  const heartbeat = new Promise<void>(resolve => setTimeout(() => { ticked = true; resolve(); }, 0));
  const prepared = await new MusicAudio().prepare({ bytes, source });
  assert.equal(ticked, true, "PCM decoding must yield to native bridge traffic.");
  await heartbeat;
  assert.equal(new AudioFileDecoder().decode(prepared.bytes, "prepared.wav").channels[0]![79_999], 0.25);
});

test("audio_read attaches exact selected frames and source identity without calling a model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-read-audio-"));
  try {
    const path = join(directory, "reference.wav");
    const samples = Float32Array.from({ length: 16_000 }, (_, frame) => frame < 8_000 ? 0.1 : 0.6);
    await writeWav(path, { sampleRate: 8_000, channels: [samples, samples.map(sample => sample / 2)] });
    const ctx = { temp: new TempFolder(directory) } as never;
    const tool = listeningTools.find(tool => tool.name === "audio_read")!;
    const result: any = await tool.run({ path, fromSeconds: 1, toSeconds: 1.25 }, ctx);
    const attached = result[TOOL_MEDIA][0].content;
    const decoded = new AudioFileDecoder().decode(attached.data, "context.wav");
    assert.equal(decoded.channels.length, 2);
    assert.equal(decoded.channels[0]!.length, 2_000);
    assert.ok(Math.abs(decoded.channels[0]![0]! - 0.6) < 0.001);
    assert.equal(result.source.selection.firstFrame, 8_000);
    assert.equal(result.source.sha256, audioHash(await readFile(path)));
    assert.equal(result.payload.sha256, audioHash(attached.data));
    assert.ok(!JSON.stringify(result).includes('"data"'), "Binary content must not become an ordinary saved tool result.");
    await assert.rejects(tool.run({ path, toSeconds: 3 }, ctx), /within this recording/);
    await assert.rejects(tool.run({ track: { tag: "voice" }, start: 0, end: 4, fromSeconds: 1 }, ctx), /file passage/);
    assert.equal(listeningTools.some(tool => tool.name === "audio_describe" || tool.name === "audio_compare"), false);

    const mp3 = join(directory, "recording.mp3"), bytes = Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 255, 251, 144, 0]);
    await writeFile(mp3, bytes);
    const compressed = await new MusicAudio().read(mp3);
    assert.deepEqual(Buffer.from(compressed.content.data), bytes);
    assert.equal(compressed.content.format, "mp3");
    assert.equal(compressed.content.durationSeconds, null);
    await assert.rejects(new MusicAudio().read(mp3, { fromSeconds: 0 }), /excerpts in Live/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
