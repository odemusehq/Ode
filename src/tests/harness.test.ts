import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SkillLibrary } from "../harness/skills";
import { BundledTexts, FolderTexts } from "../harness/texts";
import { Mneme } from "../mneme/artist";
import { ConversationStore } from "../mneme/conversations";
import { ProductionTaskStore } from "../mneme/production-task";
import { LyricsStore } from "../mneme/lyrics-store";
import { TempFolder, userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore, SongVersions } from "../mneme/song-store";
import { SnapshotReader } from "../server/snapshot-reader";
import { ModelServices } from "../services";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { OdeConfig } from "../shared/config";
import { DevConfig } from "../shared/dev-config";
import { ToolRegistry } from "../tools";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";
async function tempDir() { return mkdtemp(join(tmpdir(), "ode-harness-")); }

async function rig() {
  const config = new OdeConfig(join(await tempDir(), "storage"), join(await tempDir(), "temp"));
  const paths = userPaths(config.userDir);
  const live = new FakeSetLive(TestSets.small());
  const song = new SongStore(paths, () => undefined);
  await song.create("Night Bus");
  const prefs = new PreferencesStore(join(paths.preferences, "preferences.json"));
  const conversations = new ConversationStore(join(paths.workspace, "conversations"), config.limits.historyExchanges);
  const registry = new ToolRegistry({
    config,
    live,
    song,
    production: new ProductionTaskStore(song),
    lyrics: new LyricsStore(song, prefs, () => undefined),
    versions: new SongVersions(song, config.versions.snapshotEvery),
    snapshots: new SnapshotReader(live, song),
    questions: { ask: async () => null },
    mneme: new Mneme(paths, config.memory),
    prefs,
    services: new ModelServices(new ModelRoles(new SettingsStore(config.userDir, ProviderCatalog.bundled), ProviderCatalog.bundled)),
    temp: new TempFolder(config.tempDir),
    emit: () => undefined,
  });
  const skills = new SkillLibrary(new FolderTexts(DevConfig.repoDir));
  return { registry, skills, conversations };
}

test("every tool's input becomes a function definition the model can read", async () => {
  const { registry } = await rig();
  const names = registry.available("main").map((tool) => tool.name);
  const functions = registry.functions(names);
  assert.equal(functions.length, names.length);
  for (const definition of functions) {
    assert.equal(definition.type, "function");
    if (definition.type === "function") assert.equal(definition.function.parameters?.type, "object", definition.function.name);
  }
});

test("skills are read by name and sub-skills by path; their test cases stay with the repo", async () => {
  const skills = new SkillLibrary(new FolderTexts(DevConfig.repoDir));
  const index = await skills.index();
  assert.ok(index.some((skill) => skill.name === "lyrics" && skill.description.length > 0));
  assert.match(await skills.read("lyrics/rhymes"), /^---/);
  await assert.rejects(skills.read("lyrics/rhymes", "../../package.json"), /Ode's skills are/);
  await assert.rejects(skills.read("production/song-form", "evals/mark-sections-with-locators/case.yaml"), /test cases/);
});

test("skill descriptions survive Windows line endings", async () => {
  const skills = new SkillLibrary(new BundledTexts({
    "skills/lyrics/SKILL.md": "---\r\nname: lyrics\r\ndescription: Write lyrics.\r\n---\r\n# Lyrics\r\n",
  }));
  assert.deepEqual(await skills.index(), [{ name: "lyrics", description: "Write lyrics." }]);
});

test("a song's conversation keeps its latest exchanges", async () => {
  const log = new ConversationStore(await tempDir(), 2).log("night-bus");
  await log.add("Darker chords", "Chords now minor · in key");
  await log.add("Lock the bass to the kick", "Bass on 1 and the and of 2 · no clash");
  await log.add("Bigger chorus", "Chorus doubled an octave up · in range");
  assert.deepEqual(
    (await log.recent()).map((exchange) => exchange.request),
    ["Lock the bass to the kick", "Bigger chorus"],
  );
});
