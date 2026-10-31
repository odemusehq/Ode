import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
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

  const saved = await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026", key: "sk-test", services: {} });
  assert.equal(saved.keySet, true);
  assert.equal(saved.credit, "Built with Muse Spark Open");
  assert.ok(!JSON.stringify(saved).includes("sk-test"));

  const kept = await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026", services: {} });
  assert.equal(kept.keySet, true);
});

test("each role reaches its provider's endpoint, with Meta's models for cover art when the chat runs elsewhere", async () => {
  const settings = await freshSettings();
  const roles = new ModelRoles(settings, ProviderCatalog.bundled);
  await settings.update({ provider: "modal", model: "my-endpoint.us-west.modal.direct", key: "wk-1.ws-2", metaKey: "meta-key", services: {} });
  const onModal = await roles.roles();
  assert.equal(onModal.main.baseUrl, "https://inference.us-west.modal.direct/v1");
  assert.equal(onModal.main.conversationHeader, "Modal-Routing-Affinity-Key");
  assert.equal(onModal.subagent.model, "my-endpoint.us-west.modal.direct");
  assert.equal(onModal.image_generation.apiKey, "meta-key");
  assert.equal(onModal.image_generation.model, "muse-image-1.0");
  assert.equal(onModal.stem_separation.provider, "");
  assert.equal(onModal.audio_understanding.model, "muse-spark-1.2");

  await settings.update({ provider: "meta", model: "muse-spark-1.3", key: "meta-main", services: {} });
  assert.equal((await roles.roles()).transcription.apiKey, "meta-main");
  await settings.update({ provider: "baseten", model: "meta-models/muse-spark-open-1026", key: "baseten-test", services: {} });
  const onBaseten = await roles.roles();
  assert.equal(onBaseten.audio_understanding.provider, "baseten");
  assert.equal(onBaseten.audio_understanding.apiKey, "baseten-test");
  assert.equal(onBaseten.audio_understanding.model, "meta-models/muse-spark-open-1026");
});

test("Settings lists each provider's models, and Modal lists its endpoints once a key is in", async () => {
  const roles = new ModelRoles(await freshSettings(), ProviderCatalog.bundled);
  assert.deepEqual(
    (await roles.models({ provider: "baseten" })).map((model) => model.id),
    ["meta-models/muse-spark-open-1026"],
  );
  assert.deepEqual(await roles.models({ provider: "modal" }), []);
});
