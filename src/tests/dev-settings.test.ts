import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SettingsStore } from "../mneme/settings-store";
import { ProviderCatalog } from "../services/provider-catalog";
import { importDevSettings } from "../shared/dev-settings";

async function fixture(run: (store: SettingsStore, file: string) => Promise<void>): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), "ode-dev-settings-"));
  try { await run(new SettingsStore(folder, ProviderCatalog.bundled), join(folder, "settings.json")); }
  finally { await rm(folder, { recursive: true, force: true }); }
}

test("developer Meta settings configure the existing roles and persist owner-only", () => fixture(async (store, file) => {
  const result = await importDevSettings(store, { META_API_KEY: "test-meta-key", ODE_CHAT_PROVIDER: "meta", ODE_CHAT_MODEL: "muse-wonder-1.0" });
  assert.equal(result.changed, true);
  assert.deepEqual(result.configuredRoles, ["main", "subagent", "transcription", "lyrics_check"]);
  const view = await store.view();
  assert.equal(view.provider, "meta");
  assert.equal(view.model, "muse-wonder-1.0");
  assert.equal(view.keySet && view.metaKeySet, true);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
}));

test("a Meta key preserves other chat, saved fields and Lyricist settings; blank keys preserve saved credentials", () => fixture(async (store, file) => {
  await store.update({ provider: "modal", model: "developer-endpoint", key: "test-chat-key",
    lyrics: { provider: "meta", model: "muse-wonder-1.0", key: "test-lyrics-key" } });
  const stored = { ...JSON.parse(await readFile(file, "utf8")), retired: { apiKey: "unused-old-key" } };
  await writeFile(file, JSON.stringify(stored));
  const before = await store.view();
  const result = await importDevSettings(store, { META_API_KEY: "test-meta-key" });
  const after = await store.view();
  assert.equal(result.changed, true);
  assert.deepEqual(after, { ...before, metaKeySet: true });
  const saved = await readFile(file, "utf8");
  assert.deepEqual(JSON.parse(saved).retired, stored.retired);
  assert.equal("retired" in after, false);
  assert.equal((await importDevSettings(store, { META_API_KEY: " ", ODE_CHAT_API_KEY: "" })).changed, false);
  assert.equal(await readFile(file, "utf8"), saved);
}));

test("explicit alternate chat is accepted; invalid or incomplete choices cannot publish settings", () => fixture(async (store, file) => {
  await importDevSettings(store, { ODE_CHAT_PROVIDER: "baseten", ODE_CHAT_MODEL: "meta-models/muse-spark-open-1026", ODE_CHAT_API_KEY: "test-chat-key" });
  assert.equal((await store.view()).keySet, true);
  const saved = await readFile(file, "utf8");
  for (const env of [
    { ODE_CHAT_PROVIDER: "unknown", ODE_CHAT_MODEL: "anything", ODE_CHAT_API_KEY: "test-key" },
    { ODE_CHAT_PROVIDER: "meta", ODE_CHAT_MODEL: "unknown", META_API_KEY: "test-key" },
    { ODE_CHAT_PROVIDER: "baseten", ODE_CHAT_MODEL: "meta-models/muse-spark-open", ODE_CHAT_API_KEY: "test-key" },
    { ODE_CHAT_PROVIDER: "baseten", ODE_CHAT_MODEL: "" },
    { ODE_CHAT_PROVIDER: "modal", ODE_CHAT_MODEL: "developer-endpoint" },
    { ODE_CHAT_API_KEY: "test-key" },
  ]) {
    await assert.rejects(importDevSettings(store, env), { name: "Error" });
    assert.equal(await readFile(file, "utf8"), saved);
  }
  await importDevSettings(store, { ODE_CHAT_PROVIDER: "modal", ODE_CHAT_MODEL: "developer-endpoint", ODE_CHAT_API_KEY: "test-modal-key" });
  const modal = await store.view();
  assert.equal(modal.provider, "modal");
  assert.equal(modal.model, "developer-endpoint");
  assert.equal(modal.keySet, true);
}));
