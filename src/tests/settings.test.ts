import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SettingsStore } from "../mneme/settings-store";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";

async function freshSettings(): Promise<SettingsStore> {
  return new SettingsStore(await mkdtemp(join(tmpdir(), "ode-settings-")), ProviderCatalog.bundled);
}

test("a fresh install starts on Meta's first model, and a saved key shows only as set", async () => {
  const settings = await freshSettings();
  const fresh = await settings.view();
  assert.equal(fresh.provider, "meta");
  assert.equal(fresh.model, "muse-spark-1.3");
  assert.equal(fresh.keySet, false);

  const saved = await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026", key: "sk-test" });
  assert.equal(saved.keySet, true);
  assert.equal(saved.credit, "Built with Muse Spark Open");
  assert.ok(!JSON.stringify(saved).includes("sk-test"));

  const kept = await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026" });
  assert.equal(kept.keySet, true);
});

test("each role reaches its provider's endpoint, with the same agent model and independent microphone transcription", async () => {
  const settings = await freshSettings();
  const roles = new ModelRoles(settings, ProviderCatalog.bundled);
  await settings.update({ provider: "modal", model: "my-endpoint.us-west.modal.direct", key: "wk-1.ws-2", metaKey: "meta-key" });
  const onModal = await roles.roles();
  assert.equal(onModal.main.baseUrl, "https://inference.us-west.modal.direct/v1");
  assert.equal(onModal.main.conversationHeader, "Modal-Routing-Affinity-Key");
  assert.equal(onModal.subagent.model, "my-endpoint.us-west.modal.direct");
  assert.equal(onModal.transcription.apiKey, "meta-key");
  assert.deepEqual(Object.keys(onModal).sort(), ["lyrics_check", "main", "subagent", "transcription"]);

  await settings.update({ provider: "meta", model: "muse-spark-1.3", key: "meta-main" });
  assert.equal((await roles.roles()).transcription.apiKey, "meta-main");
  await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026", key: "baseten-test" });
  const onBaseten = await roles.roles();
  assert.equal(onBaseten.main.model, "meta-models/muse-spark-open-1026");
  assert.equal(onBaseten.main.apiKey, "baseten-test");
});

test("Settings lists each provider's models, and Modal lists its endpoints once a key is in", async () => {
  const roles = new ModelRoles(await freshSettings(), ProviderCatalog.bundled);
  assert.deepEqual(
    (await roles.models({ provider: "baseten" })).map((model) => model.id),
    ["meta-models/muse-spark-open-1026"],
  );
  assert.deepEqual(await roles.models({ provider: "modal" }), []);
});

test("approved sample folders persist without exposing or replacing saved keys and unknown settings", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-sample-settings-"));
  try {
    const file = join(folder, "settings.json");
    const settings = new SettingsStore(folder, ProviderCatalog.bundled);
    assert.deepEqual((await settings.view()).sampleFolders, []);
    await settings.update({ provider: "meta", model: "muse-spark-1.3", key: "protected-key" });
    await writeFile(file, JSON.stringify({ ...JSON.parse(await readFile(file, "utf8")), futureSetting: { enabled: true } }));
    const view = await settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: [folder, folder] });
    assert.deepEqual(view.sampleFolders, [await realpath(folder)]);
    assert.equal(JSON.stringify(view).includes("protected-key"), false);
    assert.equal((await settings.read()).key, "protected-key");
    assert.deepEqual((await settings.read()).futureSetting, { enabled: true });
    await settings.update({ provider: "meta", model: "muse-spark-1.3" });
    assert.deepEqual((await settings.view()).sampleFolders, view.sampleFolders);
    const before = await readFile(file, "utf8");
    await assert.rejects(settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: ["relative-folder"] }));
    assert.equal(await readFile(file, "utf8"), before);
    await settings.update({ provider: "meta", model: "muse-spark-1.3", sampleFolders: [] });
    assert.deepEqual((await new SettingsStore(folder, ProviderCatalog.bundled).view()).sampleFolders, []);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
