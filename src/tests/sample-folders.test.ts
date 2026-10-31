import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SampleFolders } from "../live/sample-folders";
import { SettingsStore } from "../mneme/settings-store";
import { TempFolder } from "../mneme/paths";
import { ProviderCatalog } from "../services/provider-catalog";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

async function fixture() {
  const temporary = await mkdtemp(join(tmpdir(), "ode-sample-folders-"));
  const root = join(temporary, "Samples");
  await mkdir(join(root, "Drums"), { recursive: true });
  await mkdir(join(root, "Keys"));
  // Deliberately not valid audio: discovery must use names and filesystem metadata only.
  await writeFile(join(root, "Drums", "Kick dry.wav"), "opaque audio");
  await writeFile(join(root, "Drums", "Kick room.aif"), "opaque audio");
  await writeFile(join(root, "Keys", "Soft.adg"), "opaque preset");
  await writeFile(join(root, "Swing.agr"), "opaque groove");
  await writeFile(join(root, "ignore.txt"), "not a sample");
  const settings = new SettingsStore(join(temporary, "Settings"), ProviderCatalog.bundled);
  await settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: [root] });
  const folders = new SampleFolders(settings);
  const rootId = (await folders.folders()).roots[0]!.id;
  return { temporary, root: await realpath(root), rootId, settings, folders };
}

test("folder tools narrow names with facets and stable pages without reading sample contents or calling Live", async () => {
  const f = await fixture();
  try {
    const registry = new ToolRegistry({ sampleFolders: f.folders, config: { limits: { toolResultMaxChars: 60000 } },
      live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext);
    assert.equal(registry.group("sample_files_search"), "daw_read");
    assert.equal(registry.find("sample_files_search")?.changes, "none");
    const response = await registry.run("sample_files_search", { rootId: f.rootId, query: "kick", kind: "audio", limit: 1 });
    assert.equal(response.ok, true, response.text);
    const first = JSON.parse(response.text);
    assert.equal(first.matching, 2);
    assert.deepEqual(first.facets.folders, [{ value: "Drums", count: 2 }]);
    assert.deepEqual(first.facets.formats, [{ value: "aif", count: 1 }, { value: "wav", count: 1 }]);
    assert.equal(first.items[0].loadVia, "native_audio");
    assert.equal(first.scan.coverage.complete, true);
    const missing = await f.folders.search({ rootId: f.rootId, query: "absent" });
    assert.equal(missing.matching, 0);
    assert.deepEqual(missing.navigation.subfolders, [{ value: "Drums", indexedMatches: 0 }, { value: "Keys", indexedMatches: 0 }]);
    assert.equal(missing.navigation.listingComplete, true);
    assert.ok(first.nextCursor);
    const next = await f.folders.search({ rootId: f.rootId, query: "kick", kind: "audio", cursor: first.nextCursor });
    assert.equal(next.scan.id, first.scan.id);
    assert.equal(next.items.length, 1);
    assert.notEqual(next.items[0]!.path, first.items[0].path);
    assert.equal(next.nextCursor, null);
    await assert.rejects(f.folders.search({ rootId: f.rootId, query: "soft", cursor: first.nextCursor }), /cursor|filters/i);
    const presets = await f.folders.search({ rootId: f.rootId, subfolder: "Keys", formats: ["ADG"] });
    assert.deepEqual(presets.items.map((entry) => entry.relativePath), ["Keys/Soft.adg"]);
    assert.equal(presets.items[0]!.loadVia, "human_browser");
    assert.equal(await readFile(join(f.root, "Keys", "Soft.adg"), "utf8"), "opaque preset");
    await f.settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: [] });
    await assert.rejects(f.folders.search({ rootId: f.rootId, query: "kick", kind: "audio", cursor: first.nextCursor }), /approved|configured|changed/i);
  } finally { await rm(f.temporary, { recursive: true, force: true }); }
});

test("discovery skips symlinks, refuses escapes and removed paths, and refreshes only on request", async () => {
  const f = await fixture();
  try {
    const outside = join(f.temporary, "Outside");
    await mkdir(outside);
    await writeFile(join(outside, "Secret.wav"), "outside");
    await symlink(outside, join(f.root, "Escape"));
    await symlink(join(outside, "Secret.wav"), join(f.root, "Secret.wav"));
    const first = await f.folders.search({ rootId: f.rootId });
    assert.equal(first.scan.coverage.symlinksSkipped, 2);
    assert.equal(first.items.some((entry) => entry.name === "Secret.wav"), false);
    await assert.rejects(f.folders.search({ rootId: f.rootId, subfolder: "../Outside" }));
    await assert.rejects(f.folders.search({ rootId: f.rootId, subfolder: "Escape" }));
    await writeFile(join(f.root, "New.wav"), "new");
    assert.equal((await f.folders.search({ rootId: f.rootId, query: "New" })).matching, 0);
    const fresh = await f.folders.search({ rootId: f.rootId, query: "New", refresh: true });
    assert.equal(fresh.matching, 1);
    await rm(join(f.root, "New.wav"));
    await assert.rejects(f.folders.search({ rootId: f.rootId, query: "New" }), /changed|refresh/i);
    const stopped = new AbortController();
    stopped.abort();
    await assert.rejects(f.folders.search({ rootId: f.rootId, refresh: true }, stopped.signal), { name: "AbortError" });
  } finally { await rm(f.temporary, { recursive: true, force: true }); }
});

test("bounded scans report partial coverage and bounded responses preserve a continuation", async () => {
  const f = await fixture();
  try {
    const folders = new SampleFolders(f.settings, { maxEntries: 2 });
    const found = await folders.search({ rootId: f.rootId });
    assert.equal(found.scan.coverage.complete, false);
    assert.equal(found.scan.coverage.visitedEntries, 2);
    assert.ok(found.scan.coverage.limitsReached.includes("entries"));
    const shallow = await new SampleFolders(f.settings, { maxDepth: 0 }).search({ rootId: f.rootId, kind: "audio" });
    assert.equal(shallow.matching, 0);
    assert.deepEqual(shallow.navigation.subfolders.map((folder) => folder.value), ["Drums", "Keys"]);
    assert.equal(shallow.navigation.countsComplete, false);
    for (let at = 0; at < 23; at++) await mkdir(join(f.root, `Branch ${at.toString().padStart(2, "0")}`));
    const navigationPage = await f.folders.search({ rootId: f.rootId, query: "absent", refresh: true });
    assert.equal(navigationPage.navigation.subfolders.length, 20);
    assert.equal(navigationPage.navigation.nextOffset, 20);
    const remaining = await f.folders.search({ rootId: f.rootId, query: "absent", folderOffset: navigationPage.navigation.nextOffset! });
    assert.equal(remaining.scan.id, navigationPage.scan.id);
    assert.equal(remaining.navigation.subfolders.length, 5);
    assert.equal(remaining.navigation.nextOffset, null);
    for (let at = 0; at < 20; at++) await writeFile(join(f.root, `Long ${at} ${"x".repeat(100)}.wav`), "audio");
    const page = await f.folders.search({ rootId: f.rootId, kind: "audio", limit: 50, refresh: true }, undefined, 4500);
    assert.ok(JSON.stringify(page).length <= 4500);
    assert.ok(page.items.length > 0 && page.items.length < page.matching);
    assert.ok(page.nextCursor);
  } finally { await rm(f.temporary, { recursive: true, force: true }); }
});

test("selected audio opens as unchanged managed bytes, refusing presets, links and stale selections", async () => {
  const f = await fixture();
  try {
    const temp = new TempFolder(join(f.temporary, "Working"));
    const registry = new ToolRegistry({ sampleFolders: f.folders, temp, config: { limits: { toolResultMaxChars: 60000 } },
      live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext);
    const found = await f.folders.search({ rootId: f.rootId, query: "Kick dry" });
    const selection = { rootId: f.rootId, scanId: found.scan.id, relativePath: "Drums/Kick dry.wav" };
    const opened = await registry.run("sample_file_open", selection);
    assert.equal(opened.ok, true, opened.text);
    const copied = JSON.parse(opened.text);
    assert.equal(await temp.inside(copied.path), copied.path);
    assert.equal(await readFile(copied.path, "utf8"), "opaque audio");
    assert.equal(copied.source.originalPath, join(f.root, "Drums", "Kick dry.wav"));
    assert.match(copied.sha256, /^[a-f0-9]{64}$/);
    assert.equal(copied.retained, false);
    const presets = await f.folders.search({ rootId: f.rootId, kind: "preset" });
    assert.equal((await registry.run("sample_file_open", { ...selection, scanId: presets.scan.id, relativePath: "Keys/Soft.adg" })).ok, false);
    await writeFile(join(f.root, selection.relativePath), "edited audio");
    assert.equal((await registry.run("sample_file_open", selection)).ok, false);
    await assert.rejects(f.folders.search({ rootId: f.rootId, query: "Kick dry" }), /changed|refresh/i);
    await rm(join(f.root, selection.relativePath));
    await symlink(join(f.root, "Drums", "Kick room.aif"), join(f.root, selection.relativePath));
    assert.equal((await registry.run("sample_file_open", selection)).ok, false);
    const refreshed = await f.folders.search({ rootId: f.rootId, query: "Kick room", refresh: true });
    await f.settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: [] });
    assert.equal((await registry.run("sample_file_open", { ...selection, scanId: refreshed.scan.id, relativePath: "Drums/Kick room.aif" })).ok, false);
  } finally { await rm(f.temporary, { recursive: true, force: true }); }
});
