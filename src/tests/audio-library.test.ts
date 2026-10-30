import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { audioProvenance, LocalAudioFiles } from "../live/local-audio-files";
import { AudioFileDecoder } from "../music/audio/decode";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
import type { LibraryProfile } from "../shared/audio-library";

const wav = () => encodeWav({ sampleRate: 48000, channels: [new Float32Array(48001)] }, WavBitDepth.Int16);
const profile = (bytes: Uint8Array): LibraryProfile => ({
  version: 1, method: "ode-audio-profile-v1", measuredAt: new Date().toISOString(),
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, level: "metadata",
  ...new AudioFileDecoder().inspect(bytes, "sample"), durationSeconds: 48001 / 48000, sampleValues: "unexamined",
} as LibraryProfile);

test("catalogue annotations are backward compatible and concurrent writers use revision guards", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-"));
  try {
    const a = new LocalAudioFiles(root, join(root, "temp")), b = new LocalAudioFiles(root, join(root, "temp"));
    const original = await a.add({ name: "Dry Shaker.wav", bytes: wav(), purpose: "library" });
    assert.equal(original.annotations, undefined);
    const first = await a.annotate(original.id, 0, { labels: [" Dry ", "dry", "Percussion"], role: "Shaker", kind: "loop", declaredBpm: 120 }, {});
    assert.deepEqual(first.annotations?.labels, ["dry", "percussion"]);
    assert.equal(first.annotations?.enteredBy, "ode");
    await assert.rejects(b.annotate(original.id, 0, { role: "Bass" }, {}), /changed|revision/i);
    const results = await Promise.allSettled([
      a.annotate(original.id, 1, { notes: "First edit" }, {}),
      b.annotate(original.id, 1, { notes: "Second edit" }, {}),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const saved = (await a.search("shaker"))[0]!;
    assert.equal(saved.annotations?.revision, 2);
    assert.equal(saved.name, original.name);
    assert.equal(saved.sha256, original.sha256);
    assert.equal(saved.currentness, "unknown");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("delayed byte-bound profiles preserve a simultaneous annotation and reject changed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-"));
  try {
    const a = new LocalAudioFiles(root, join(root, "temp")), b = new LocalAudioFiles(root, join(root, "temp"));
    const original = await a.add({ name: "Loop.wav", bytes: wav(), purpose: "library" });
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = a.profile(original.id, "metadata", async (bytes) => { entered(); await held; return profile(bytes); });
    await started;
    await b.annotate(original.id, 0, { labels: ["keep this"] }, {});
    release();
    const saved = await pending;
    assert.deepEqual(saved.annotations?.labels, ["keep this"]);
    assert.equal(saved.profile?.sha256, original.sha256);
    await assert.rejects(a.profile(original.id, "metadata", async (bytes) => {
      const changed = Uint8Array.from(bytes); changed[changed.length - 1] = 1;
      await writeFile(join(root, "Audio", `${original.id}.wav`), changed);
      return profile(bytes);
    }), /changed/);
    const metadata = JSON.parse(await readFile(join(root, "Audio", `${original.id}.json`), "utf8"));
    assert.equal(metadata.profile.sha256, original.sha256);
    await assert.rejects(a.open(original.id), /changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("search uses exact full-file duration, declared filters and explicit unknown coverage without writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-"));
  try {
    const files = new LocalAudioFiles(root, join(root, "temp"));
    const measured = await files.add({ name: "Dry Shaker.wav", bytes: wav(), purpose: "library" });
    await files.annotate(measured.id, 0, { labels: ["dry"], role: "percussion", kind: "loop", declaredKey: "A minor" }, {});
    await files.profile(measured.id, "metadata", (bytes) => profile(bytes));
    const unknown = await files.add({ name: "Other.wav", bytes: wav(), purpose: "library" });
    const before = await readFile(join(root, "Audio", `${unknown.id}.json`), "utf8");
    const result = await files.searchRecords({ query: "", durationSeconds: { min: 1.00001 }, limit: 1 });
    assert.deepEqual(result.items.map((item) => item.id), [measured.id]);
    assert.equal(result.coverage.excludedUnknown, 1);
    assert.equal(result.coverage.unprofiled, 1);
    assert.equal(result.nextOffset, null);
    assert.equal((await files.searchRecords({ labels: ["DRY"], declaredKey: "a MINOR" })).total, 1);
    assert.equal((await files.searchRecords({ durationSeconds: { max: 1 } })).total, 0);
    assert.equal((await files.searchRecords({ integratedLufs: { max: -10 } })).coverage.excludedUnknown, 2);
    assert.equal(await readFile(join(root, "Audio", `${unknown.id}.json`), "utf8"), before);
    assert.deepEqual((await files.search("dry")).map((item) => item.id), [measured.id]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unusable advisory caches do not block valid bytes or erase malformed declarations", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-"));
  try {
    const files = new LocalAudioFiles(root, join(root, "temp"));
    const original = await files.add({ name: "Valid.wav", bytes: wav(), purpose: "library" });
    const path = join(root, "Audio", `${original.id}.json`);
    const raw = { ...original, annotations: { revision: 7, labels: "keep this malformed data" }, profile: { version: 2, method: "future-method" } };
    await writeFile(path, JSON.stringify(raw));
    const before = await readFile(path, "utf8");
    const verified = await files.verify(original.id);
    assert.equal(verified.profile, undefined);
    assert.equal(verified.profileStatus, "invalid-or-unsupported");
    assert.equal(verified.annotationsStatus, "invalid");
    assert.equal((await files.searchRecords({})).total, 1);
    const opened = await files.open(original.id);
    assert.equal((await audioProvenance(opened.path))?.profile, undefined);
    assert.equal((await audioProvenance(opened.path))?.profileStatus, "invalid-or-unsupported");
    assert.equal(await readFile(path, "utf8"), before);
    await assert.rejects(files.annotate(original.id, 0, { labels: ["replacement"] }, {}), /declarations.*invalid|review/i);
    await files.profile(original.id, "metadata", (bytes) => profile(bytes));
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")).annotations, raw.annotations);
    const stale = { ...original, profile: { ...profile(wav()), sha256: "0".repeat(64) } };
    await writeFile(path, JSON.stringify(stale));
    const staleOpened = await files.open(original.id);
    assert.equal(staleOpened.profileStatus, "stale");
    assert.equal(staleOpened.profile, undefined);
    assert.equal((await audioProvenance(staleOpened.path))?.profileStatus, "stale");
    assert.equal((await files.searchRecords({ durationSeconds: { min: 0 } })).coverage.excludedUnknown, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Stop observed after a synchronous profile callback prevents starting cache persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-"));
  try {
    const files = new LocalAudioFiles(root, join(root, "temp"));
    const original = await files.add({ name: "Stop.wav", bytes: wav(), purpose: "library" });
    const path = join(root, "Audio", `${original.id}.json`), before = await readFile(path, "utf8");
    const controller = new AbortController();
    await assert.rejects(files.profile(original.id, "metadata", (bytes) => {
      queueMicrotask(() => controller.abort());
      return profile(bytes);
    }, controller.signal), { name: "AbortError" });
    assert.equal(await readFile(path, "utf8"), before);
    await assert.rejects(files.annotate(original.id, 0, { labels: ["late"] }, {}, controller.signal), { name: "AbortError" });
    assert.equal(await readFile(path, "utf8"), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
