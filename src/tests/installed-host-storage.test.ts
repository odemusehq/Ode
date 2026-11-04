import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, open, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import { JsonFile } from "../mneme/json-file";

async function runWithInstalledPermissions(scenario: string, verify?: (data: string) => Promise<void>): Promise<void> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "ode-installed-storage-")));
  const data = join(root, "data");
  const entry = join(root, "storage.mjs");
  try {
    await mkdir(data);
    await build({
      stdin: {
        resolveDir: import.meta.dirname,
        contents: `
          import assert from "node:assert/strict";
          import { join } from "node:path";
          const root = process.argv[2];
          ${scenario}
          console.log("persisted");
        `,
      },
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: entry,
      logLevel: "silent",
    });
    const output = execFileSync(process.execPath, [
      "--permission", `--allow-fs-read=${root}`, `--allow-fs-write=${data}`,
      entry, data, join(root, "outside.json"),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(output.trim(), "persisted");
    await verify?.(data);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("first-run songs and private settings persist under the installed host's Node permissions", async () => {
  await runWithInstalledPermissions(`
    import { JsonFile } from "../mneme/json-file";
    import { SongStore } from "../mneme/song-store";
    import { userPaths } from "../mneme/paths";
    import { SettingsStore } from "../mneme/settings-store";
    import { ProviderCatalog } from "../services/provider-catalog";
    const song = new SongStore(userPaths(root), () => undefined);
    const first = await song.openLast();
    await song.update({ title: "Tutorial", lyrics: "" });
    const reopened = new SongStore(userPaths(root), () => undefined);
    assert.equal((await reopened.openLast()).id, first.id);
    assert.equal((await reopened.read()).title, "Tutorial");
    const settings = new SettingsStore(root, ProviderCatalog.bundled);
    await settings.update({ provider: "meta", model: "muse-spark-1.3", key: "offline-fixture" });
    assert.equal((await new SettingsStore(root, ProviderCatalog.bundled).read()).key, "offline-fixture");
    await assert.rejects(JsonFile.writeAtomically(process.argv[3], "denied"), { code: "ERR_ACCESS_DENIED" });
  `, async data => {
    assert.equal(JSON.parse(await readFile(join(data, "Songs", "songs.json"), "utf8")).songs.length, 1);
    assert.ok(!(await readdir(data)).some(name => name.endsWith(".tmp")));
    if (process.platform !== "win32") assert.equal((await stat(join(data, "settings.json"))).mode & 0o777, 0o600);
  });
});

test("audio references retain their exact bytes under installed-host permissions", async () => {
  await runWithInstalledPermissions(`
    import { readFile } from "node:fs/promises";
    import { LocalAudioFiles } from "../live/local-audio-files";
    import { encodeWav, WavBitDepth } from "../audio/wav";
    const bytes = encodeWav({ sampleRate: 48000, channels: [new Float32Array([0, 0.25, -0.25, 0])] }, WavBitDepth.Int16);
    const files = new LocalAudioFiles(root, join(root, "temp"));
    const record = await files.add({ name: "Reference.wav", bytes, purpose: "reference" });
    const reopened = new LocalAudioFiles(root, join(root, "temp"));
    assert.equal((await reopened.search("Reference"))[0].id, record.id);
    assert.deepEqual(await readFile((await reopened.open(record.id)).path), Buffer.from(bytes));
  `);
});

test("recorded History survives reopening under installed-host permissions", async () => {
  await runWithInstalledPermissions(`
    import { VersionHistory } from "../mneme/version-history";
    import { VersionAuthor } from "../shared/versions";
    import { TestSets } from "./sets";
    const history = new VersionHistory(root, 20);
    const before = TestSets.small();
    await history.record(before, VersionAuthor.Musician, "Opened");
    const after = structuredClone(before);
    after.song.tempo = 124;
    const changed = await history.record(after, VersionAuthor.Ode, "Tempo changed");
    assert.ok(changed);
    const reopened = new VersionHistory(root, 20);
    assert.equal((await reopened.list()).length, 2);
    assert.equal((await reopened.snapshotAt(changed.id)).song.tempo, 124);
  `);
});

test("a disk sync failure preserves the old document and removes its unpublished staging file", async context => {
  const root = await mkdtemp(join(tmpdir(), "ode-sync-failure-"));
  try {
    const path = join(root, "document.json");
    await writeFile(path, "old");
    const probe = await open(join(root, "probe"), "w");
    const prototype = Object.getPrototypeOf(probe);
    await probe.close();
    await rm(join(root, "probe"));
    context.mock.method(prototype, "sync", async () => { throw Object.assign(new Error("Disk I/O failed"), { code: "EIO" }); });
    await assert.rejects(JsonFile.writeAtomically(path, "new"), { code: "EIO" });
    assert.equal(await readFile(path, "utf8"), "old");
    assert.deepEqual(await readdir(root), ["document.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
