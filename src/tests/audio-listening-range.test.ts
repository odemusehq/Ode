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
import { attachAudioFile } from "../tools/daw/audio/file-evidence";

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

test("whole-song listening fits the decoded audio limit without changing rate, channels or source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-whole-song-"));
  try {
    const path = join(directory, "main.wav"), frames = 6_250_001;
    const bytes = encodeWav({ sampleRate: 44_100, channels: [new Float32Array(frames).fill(0.25), new Float32Array(frames).fill(-0.5)] }, WavBitDepth.Float32);
    await writeFile(path, bytes);
    const read = await new MusicAudio().read(path);
    assert.ok(read.content.data.length <= 50_000_000, "Meta refuses more than 50 MB of decoded audio per input.");
    const info = new AudioFileDecoder().inspect(read.content.data, "payload.wav");
    assert.equal(info.bitDepth, 24);
    assert.equal(info.frames, frames);
    assert.equal(info.sampleRate, 44_100);
    assert.equal(info.channels, 2);
    assert.equal(read.payload.representation.encoding, "PCM24 WAV");
    assert.equal(read.source.sha256, audioHash(bytes));
    assert.equal(audioHash(await readFile(path)), audioHash(bytes), "The original float capture stays unchanged.");
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(bytes.length - frames * 8, 1.2, true);
    await writeFile(path, bytes);
    await assert.rejects(new MusicAudio().read(path), /headroom.*shorter range/i, "Oversized float headroom must not be clipped to integer PCM.");
  } finally { await rm(directory, { recursive: true, force: true }); }
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
    const captured: any = await attachAudioFile({ path, capture: { timing: { startedBeat: 48, endedBeat: 100 } } });
    assert.match(captured[TOOL_MEDIA][0].description, /^Observed Arrangement coverage: beat 48 to 100\./);
    assert.match(captured[TOOL_MEDIA][0].description, /Do not claim to have heard sections outside/);
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
