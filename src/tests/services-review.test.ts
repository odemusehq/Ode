import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioFileDecoder } from "../audio/decode";
import { writeWav, WavBitDepth } from "../audio/wav";
import { MusicAudio } from "../services/music-audio";
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
