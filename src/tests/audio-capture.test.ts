import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeWav } from "../audio/wav";
import { MusicAudio } from "../services/music-audio";
import { ArrangementAudio } from "../tools/daw/audio/arrangement-audio";
import { audioFileEvidence } from "../tools/daw/audio/file-evidence";
import { LocalAudioFiles } from "../live/local-audio-files";
import { buildLibraryProfile } from "../audio/library-profile";
import { encodeWav } from "../audio/wav";
import type { ToolContext } from "../tools/define";
import { MaxCaptureEvidenceSchema } from "../shared/audio-library";

test("retained Max capture metadata preserves selected-track identities", () => {
  const source = { id: "main", name: "Main", kind: "main", stage: "post-mixer" };
  const includedSources = [{ id: "keys", name: "Keys", kind: "track", stage: "post-mixer" }];
  const requested = { sourceId: source.id, includeSourceIds: ["keys"], durationSeconds: 1, startBeat: 0 };
  const capture = MaxCaptureEvidenceSchema.parse({ capturedAt: new Date().toISOString(), source, includedSources, requested,
    host: { trackName: "Ode", deviceName: "Ode" }, timing: { startedBeat: 0, endedBeat: 2, prerollBeats: 0, rangeUncertainty: "Message-thread timing" },
    frames: 8000, channels: 2, sampleRate: 8000, durationSeconds: 1 });
  assert.deepEqual(capture, { capturedAt: capture.capturedAt, source, includedSources, requested, host: capture.host, timing: capture.timing,
    frames: 8000, channels: 2, sampleRate: 8000, durationSeconds: 1 });
});

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

test("listening source evidence excludes catalogue reports without discarding the saved metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-source-provenance-"));
  try {
    const library = new LocalAudioFiles(root, join(root, "work"));
    const asset = await library.add({ name: "Voice.wav", purpose: "processed-bounce", source: "Musician-supplied mix",
      bytes: encodeWav({ sampleRate: 8000, channels: [new Float32Array(4000)] }) });
    await library.annotate(asset.id, 0, { labels: ["chorus"], notes: "Chosen take" }, {});
    const metadataPath = join(root, "Audio", `${asset.id}.json`);
    const saved = JSON.parse(await readFile(metadataPath, "utf8"));
    const historical = { ...buildLibraryProfile(encodeWav({ sampleRate: 8000, channels: [new Float32Array(4000)] })),
      level: "full", sampleValues: "validated-finite", measurements: { integratedLufs: null, truePeakDbtp: null,
        samplePeakDbfs: null, tiltDbPerOctave: null, loudnessStatus: "historical", coverage: "old custom analysis" }, report: { extra: "x".repeat(70_000) } };
    await writeFile(metadataPath, JSON.stringify({ ...saved, profile: historical }));
    const opened = await library.open(asset.id);
    assert.equal(opened.profile, undefined);
    assert.equal(opened.profileStatus, "legacy-analysis");
    const source = await audioFileEvidence(opened.path);
    assert.equal(source.provenance?.id, asset.id);
    assert.equal(source.provenance?.declaredSource, "Musician-supplied mix");
    assert.equal(source.provenance?.provenance, "user-supplied");
    assert.equal(source.sha256, asset.sha256);
    assert.equal(source.currentness, "unknown");
    assert.ok(JSON.stringify(source).length < 4000);
    assert.equal("profile" in source.provenance!, false);
    assert.equal("annotations" in source.provenance!, false);
    assert.equal((await library.verify(asset.id)).annotations?.notes, "Chosen take");
    assert.equal(JSON.parse(await readFile(metadataPath, "utf8")).profile.report.extra, "x".repeat(70_000));
    await library.profile(asset.id, "metadata", buildLibraryProfile);
    assert.equal((await library.verify(asset.id)).profile?.level, "metadata");
    assert.equal((await library.verify(asset.id)).profile?.measurements, undefined);
    assert.equal(JSON.parse(await readFile(metadataPath, "utf8")).profile.report.extra, "x".repeat(70_000), "A new header inspection preserves historical analysis on disk.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("agent audio input refuses an unknown multichannel layout without processing it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-multichannel-"));
  try {
    const path = join(dir, "eight.wav");
    await writeWav(path, { sampleRate: 8000, channels: Array.from({ length: 8 }, () => new Float32Array(800)) });
    await assert.rejects(new MusicAudio().read(path), /layout|mono|stereo/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
