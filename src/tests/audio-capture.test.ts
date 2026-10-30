import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AudioMeasurement } from "../music/audio/measurement";
import { loudness } from "../music/audio/loudness";
import { writeWav } from "../music/audio/wav";
import { MusicAudio } from "../services/music-audio";
import { ArrangementAudio } from "../tools/audio/arrangement-audio";
import { measurementReport } from "../tools/audio/report";
import type { ToolContext } from "../tools/define";

test("Arrangement capture retains identity through track reordering and refuses duplicate names/tags", async () => {
  let tracks = [{ index: 0, kind: "audio", name: "Voice", tag: "voice" }, { index: 1, kind: "audio", name: "Guitar", tag: "guitar" }];
  let rendered: unknown;
  const ctx = { live: { extension: { call: async (op: string, args: unknown) => {
    if (op === "song_get") return { tracks: structuredClone(tracks), returnTracks: [] };
    rendered = args;
    return { path: join(tmpdir(), `ode-capture-${randomUUID()}.wav`) };
  } } } } as unknown as ToolContext;
  const audio = new ArrangementAudio(ctx);
  const found = await audio.resolve({ tag: "voice" });
  assert.ok("track" in found);
  assert.deepEqual(found.track.ref, { tag: "voice" });
  tracks = [...tracks].reverse().map((track, index) => ({ ...track, index }));
  await audio.withRender(found.track.ref, 0, 4, async () => undefined);
  assert.deepEqual(rendered, { track: { tag: "voice" }, start: 0, end: 4 });
  tracks.push({ index: 2, kind: "audio", name: "Voice", tag: "other" });
  const duplicateName = await audio.resolve({ name: "Voice" });
  assert.ok("skipped" in duplicateName && /ambiguous/i.test(duplicateName.skipped.reason));
  tracks.push({ index: 3, kind: "audio", name: "Different voice", tag: "voice" });
  const duplicateTag = await audio.resolve({ tag: "voice" });
  assert.ok("skipped" in duplicateTag && /ambiguous/i.test(duplicateTag.skipped.reason));
});

test("unknown multichannel layout retains peaks/spectrum without invented loudness or comparison", async () => {
  const sampleRate = 48_000;
  const channels = Array.from({ length: 8 }, () => new Float32Array(sampleRate));
  for (let i = 0; i < sampleRate; i++) channels[7]![i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / sampleRate);
  const audio = { sampleRate, channels };
  const result = measurementReport(new AudioMeasurement(audio));
  assert.equal(result.loudness.integratedLufs, null);
  assert.match(result.loudness.integratedStatus, /unsupported|unknown.*layout/i);
  assert.ok(Number.isFinite(result.samplePeakDbfs));
  assert.ok(result.spectrum);
  assert.equal(result.channels, 8);
  assert.throws(() => loudness(audio), /layout|mono|stereo/i);
  const dir = await mkdtemp(join(tmpdir(), "ode-multichannel-"));
  try {
    const path = join(dir, "eight.wav");
    await writeWav(path, audio);
    await assert.rejects(new MusicAudio().comparison(path, path, false), /layout|mono|stereo/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
