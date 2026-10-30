import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LocalAudioFiles } from "../live/local-audio-files";
import { encodeWav } from "../music/audio/wav";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

test("library writers remain main-only memory changes while discovery and opening stay read-only", () => {
  const registry = new ToolRegistry({} as ToolContext);
  const readers = new Set(registry.available("subagent").map((entry) => entry.name));
  for (const name of ["library_audio_update", "library_audio_profile"]) {
    assert.equal(registry.find(name)?.changes, "memory");
    assert.equal(registry.find(name)?.mainAgentOnly, true);
    assert.equal(readers.has(name), false);
  }
  assert.equal(readers.has("library_audio_search"), true);
  assert.equal(readers.has("library_audio_open"), true);
});

test("catalogue tools retain declaration provenance, profile explicitly and search saved metadata without writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-tools-"));
  try {
    const tempDir = join(root, "work");
    const library = new LocalAudioFiles(root, tempDir);
    const bytes = encodeWav({ sampleRate: 8_000, channels: [Float32Array.from({ length: 1600 }, (_, at) => Math.sin(at / 10) * 0.25)] });
    const chosen = await library.add({ name: "Verse.wav", bytes, purpose: "library", source: "Musician's recording" });
    await library.add({ name: "Unprofiled.wav", bytes, purpose: "reference" });
    const registry = new ToolRegistry({ config: { userDir: root, tempDir }, live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext);
    const exchangeId = randomUUID();
    const updated = await registry.run("library_audio_update", { id: chosen.id, expectedRevision: 0, patch: { labels: ["Dry", "Percussion"], role: "shaker", kind: "loop", declaredBpm: 97, declaredKey: "unknown" } }, undefined, { exchangeId });
    assert.equal(updated.ok, true, updated.text);
    const annotated = JSON.parse(updated.text);
    assert.equal(annotated.annotations.enteredBy, "ode");
    assert.equal(annotated.annotations.exchangeId, exchangeId);
    assert.equal(annotated.name, "Verse.wav");
    assert.equal(annotated.sha256, chosen.sha256);
    const conflict = await registry.run("library_audio_update", { id: chosen.id, expectedRevision: 0, patch: { role: "bass" } });
    assert.equal(conflict.ok, false);
    assert.match(conflict.text, /revision|changed|conflict/i);

    const metadata = await registry.run("library_audio_profile", { id: chosen.id });
    assert.equal(metadata.ok, true, metadata.text);
    assert.equal(JSON.parse(metadata.text).profile.level, "metadata");
    assert.equal(JSON.parse(metadata.text).profile.sampleValues, "unexamined");
    const complete = await registry.run("library_audio_profile", { id: chosen.id, level: "full" });
    assert.equal(complete.ok, true, complete.text);
    assert.equal(JSON.parse(complete.text).profile.level, "full");
    assert.equal(JSON.parse(complete.text).profile.sha256, chosen.sha256);

    const storedPath = join(root, "Audio", `${chosen.id}.json`);
    const before = await readFile(storedPath, "utf8");
    const found = await registry.run("library_audio_search", { labels: ["dry", "percussion"], role: "SHAKER", kind: "loop", declaredBpm: { min: 96, max: 98 }, durationSeconds: { min: 0.19, max: 0.21 }, channels: 1, limit: 1 });
    assert.equal(found.ok, true, found.text);
    const result = JSON.parse(found.text);
    assert.deepEqual(result.items.map((entry: { id: string }) => entry.id), [chosen.id]);
    assert.equal(result.total, 1);
    assert.equal(result.nextOffset, null);
    const unknowns = await registry.run("library_audio_search", { durationSeconds: { min: 0.19, max: 0.21 } });
    assert.equal(JSON.parse(unknowns.text).coverage.excludedUnknown, 1);
    assert.equal(await readFile(storedPath, "utf8"), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
