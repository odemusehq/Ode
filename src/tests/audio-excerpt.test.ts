import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { audioExcerpt, samplePeakRegions } from "../music/audio/excerpt";
import { encodeWav } from "../music/audio/wav";
import { TempFolder } from "../mneme/paths";
import { audioAnalyze } from "../tools/audio/analyze";

test("file excerpts measure only selected samples and locate peaks in source-file coordinates", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-excerpt-"));
  const samples = new Float32Array(16_000);
  samples[10] = 0.9;
  samples[8_005] = 0.995; samples[8_006] = 0.995;
  const path = join(root, "source.wav");
  await writeFile(path, encodeWav({ sampleRate: 8_000, channels: [samples] }));
  const result = await audioAnalyze.run({ path, fromSeconds: 1, toSeconds: 1.1, locatePeaks: true }, { temp: new TempFolder(root) } as never) as any;
  assert.equal(result.source.frames, 16_000);
  assert.equal(result.frames, 800);
  assert.equal(result.analyzedRange.firstFrame, 8_000);
  assert.equal(result.sampleLocations.peak.frame, 8_005);
  assert.equal(result.sampleLocations.peak.channel, 1);
  assert.equal(result.sampleLocations.nearFullScale.regions[0].endFrame, 8_007);
  assert.equal(result.loudness.integratedStatus, "insufficient duration");
  await assert.rejects(audioAnalyze.run({ path, fromSeconds: 1, toSeconds: 3 }, { temp: new TempFolder(root) } as never), /within this recording/);
  await assert.rejects(audioAnalyze.run({ track: { tag: "voice" }, start: 0, end: 4, fromSeconds: 1 }, {} as never), /uploaded file/);
});

test("peak locations bound result size across channels and silence has no invented peak", () => {
  const left = Float32Array.from({ length: 200 }, (_, i) => i % 2 === 0 ? 1 : 0);
  const audio = { sampleRate: 8_000, channels: [left, left.slice()] };
  const result = samplePeakRegions(audio, 8_000);
  assert.equal(result.nearFullScale.regionCount, 200);
  assert.equal(result.nearFullScale.regions.length, 32);
  assert.equal(result.nearFullScale.omittedRegions, 168);
  assert.deepEqual(result.nearFullScale.regions.slice(0, 3).map((region) => [region.channel, region.firstFrame]), [[1, 8_000], [2, 8_000], [1, 8_002]]);
  assert.equal(samplePeakRegions({ sampleRate: 8_000, channels: [new Float32Array(20)] }).peak, null);
  assert.throws(() => audioExcerpt(audio, 0, 0.000001), /no sample frames/);
});
