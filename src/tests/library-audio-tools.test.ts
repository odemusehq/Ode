import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LocalAudioFiles } from "../live/local-audio-files";
import { encodeWav } from "../music/audio/wav";
import { AudioFileDecoder } from "../music/audio/decode";
import { buildLibraryProfile } from "../music/audio/library-profile";
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
  assert.equal(readers.has("library_audio_read"), true);
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
    const registry = new ToolRegistry({ config: { userDir: root, tempDir, limits: { toolResultMaxChars: 60000 } }, live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext);
    const exchangeId = randomUUID();
    const updated = await registry.run("library_audio_update", { id: chosen.id, expectedRevision: 0, patch: { labels: ["Dry", "Percussion"], role: "shaker", kind: "loop", declaredBpm: 97, declaredKey: "unknown" } }, undefined, { exchangeId });
    assert.equal(updated.ok, true, updated.text);
    const declarations = await registry.run("library_audio_read", { id: chosen.id, section: "annotations" });
    const annotated = JSON.parse(updated.text);
    assert.equal(JSON.parse(declarations.text).value.enteredBy, "ode");
    assert.equal(JSON.parse(declarations.text).value.exchangeId, exchangeId);
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

test("large catalogue results stay bounded and exact detail chunks refuse changed continuations", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-library-pages-"));
  const decode = AudioFileDecoder.prototype.decode;
  try {
    const tempDir = join(root, "work"), library = new LocalAudioFiles(root, tempDir);
    const bytes = encodeWav({ sampleRate: 8_000, channels: [new Float32Array(1600)] });
    const ids: string[] = [];
    for (let at = 0; at < 20; at++) {
      const record = await library.add({ name: `Sample ${at}.wav`, bytes, purpose: "library", source: "s".repeat(2000) });
      await library.annotate(record.id, 0, { notes: "n".repeat(2000) }, {});
      ids.push(record.id);
    }
    assert.ok(JSON.stringify(await library.searchRecords({ limit: 20 })).length > 60000);
    const id = ids[0]!;
    const report = { futureDetail: "\u0001".repeat(12000) + "x".repeat(1000) };
    await library.profile(id, "full", (captured, level) => ({ ...buildLibraryProfile(captured, level), report }));
    const snapshots = await Promise.all(ids.map((assetId) => readFile(join(root, "Audio", `${assetId}.json`), "utf8")));
    const run = (name: string, input: unknown, cap = 60000) => new ToolRegistry({ config: { userDir: root, tempDir, limits: { toolResultMaxChars: cap } },
      live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext).run(name, input);
    let decodes = 0;
    AudioFileDecoder.prototype.decode = function (...args) { decodes++; return decode.apply(this, args); };
    const seen: string[] = [];
    let offset: number | null = 0, selection: string | undefined;
    while (offset !== null) {
      const result = await run("library_audio_search", { limit: 20, offset, expectedSelectionFingerprint: selection });
      assert.equal(result.ok, true, result.text);
      assert.ok(result.text.length <= 60000);
      const page = JSON.parse(result.text);
      seen.push(...page.items.map((entry: { id: string }) => entry.id));
      selection = page.selectionFingerprint; offset = page.nextOffset;
    }
    assert.deepEqual([...seen].sort(), [...ids].sort());
    const limited = await run("library_audio_search", { limit: 20 }, 2500);
    assert.equal(limited.ok, true, limited.text);
    assert.ok(limited.text.length <= 2500);
    const small = JSON.parse(limited.text);
    assert.ok(small.items.length > 0 && small.items.length < 20);
    assert.equal(small.nextOffset, small.items.length);

    let json = "", detailHash: string | undefined, firstNext: number | null = null;
    offset = 0;
    while (offset !== null) {
      const result = await run("library_audio_read", { id, section: "report", offset, limit: 20000, detailHash });
      assert.equal(result.ok, true, result.text);
      assert.ok(result.text.length <= 60000);
      const page = JSON.parse(result.text);
      assert.equal(page.format, "json-fragment");
      assert.equal(page.offset, offset);
      json += page.json; detailHash = page.detailHash;
      if (offset === 0) firstNext = page.nextOffset;
      offset = page.nextOffset;
    }
    assert.ok(JSON.stringify(JSON.parse(json)) === JSON.stringify(report), "Report fragments must preserve the exact saved JSON value.");
    assert.equal(decodes, 0);
    const afterReads = await Promise.all(ids.map((assetId) => readFile(join(root, "Audio", `${assetId}.json`), "utf8")));
    assert.ok(afterReads.every((text, index) => text === snapshots[index]), "Search and detail reads must leave saved metadata unchanged.");
    assert.deepEqual(await readdir(tempDir).catch(() => []), []);
    AudioFileDecoder.prototype.decode = decode;

    for (const name of ["library_audio_open", "library_audio_profile", "library_audio_update"]) {
      const result = await run(name, name === "library_audio_update" ? { id, expectedRevision: 1, patch: { role: "percussion" } } : { id });
      assert.equal(result.ok, true, result.text);
      assert.ok(result.text.length <= 60000);
    }
    const changedDetail = await run("library_audio_read", { id, section: "report", offset: firstNext, detailHash });
    assert.equal(changedDetail.ok, false);
    assert.match(changedDetail.text, /changed|fingerprint|hash/i);
    const revision = (await library.get(id)).record.annotations!.revision;
    const tiny = await run("library_audio_update", { id, expectedRevision: revision, patch: { role: "tiny window" } }, 100);
    assert.equal(tiny.ok, true, tiny.text);
    assert.ok(tiny.text.length <= 100);
    assert.equal((await library.get(id)).record.annotations!.revision, revision + 1);
    const largest = await library.add({ name: `${"\u0001".repeat(251)}.wav`, bytes, purpose: "library", source: `s${"\u0001".repeat(1999)}` });
    const labels = Array.from({ length: 32 }, (_, at) => `${String(at).padStart(2, "0")}${"\u0001".repeat(78)}`);
    await library.annotate(largest.id, 0, { labels, notes: `n${"\u0001".repeat(1999)}`, role: `r${"\u0001".repeat(119)}`, declaredKey: `k${"\u0001".repeat(79)}` }, {});
    const changedSelection = await run("library_audio_search", { offset: small.nextOffset, expectedSelectionFingerprint: small.selectionFingerprint });
    assert.equal(changedSelection.ok, false);
    assert.match(changedSelection.text, /changed|fingerprint|restart/i);
    const escaped = await run("library_audio_search", { labels: [labels[0]] });
    assert.equal(escaped.ok, true, escaped.text);
    assert.ok(escaped.text.length <= 60000);
    assert.equal(JSON.parse(escaped.text).items[0].annotations.labelsCount, 32);
    const exact = await run("library_audio_read", { id: largest.id, section: "annotations" });
    assert.equal(exact.ok, true, exact.text);
    assert.ok(JSON.stringify(JSON.parse(exact.text).value.labels) === JSON.stringify(labels), "Maximum escaped labels remain exactly readable.");
  } finally { AudioFileDecoder.prototype.decode = decode; await rm(root, { recursive: true, force: true }); }
});
