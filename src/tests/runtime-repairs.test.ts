import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { OperationRegistry } from "../live/extension/ops/registry";
import { AgentLoop, LoopEnd, RequestBudget } from "../harness/loop";
import { ConversationStore } from "../mneme/conversations";
import { SettingsStore } from "../mneme/settings-store";
import { ProviderCatalog } from "../services/provider-catalog";
import { OdeConfig } from "../shared/config";
import { Questions } from "../server/questions";

const limits = new OdeConfig("unused", "unused").limits;

test("chat keeps the full transcript while only recent exchanges enter the model window", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-chat-"));
  const log = new ConversationStore(folder, 2).log("song-a");
  await log.add("first", "one");
  await log.add("second", "two");
  const interrupted = await log.begin("keep the vocal");
  await log.recover();
  assert.equal((await log.all()).length, 3);
  assert.deepEqual((await log.recent()).map((entry) => entry.request), ["second", "keep the vocal"]);
  assert.equal((await log.all()).find((entry) => entry.id === interrupted)?.status, "stopped");
  assert.equal((await new ConversationStore(folder, 2).log("song-b").all()).length, 0);
});

test("concurrent model calls reserve their turns and tokens before dispatch", () => {
  const budget = new RequestBudget({ ...limits, turnsPerRequest: 2, tokensPerRequest: 100, tokensPerTurn: 30 });
  const first = budget.reserve(10), second = budget.reserve(10);
  assert.ok(first && second);
  assert.equal(budget.reserve(0), null);
  first.settle(20); second.settle(25);
  assert.equal(budget.tokens, 45);
  assert.equal(budget.reached, LoopEnd.TurnLimit);
  const tokens = new RequestBudget({ ...limits, tokensPerRequest: 40, tokensPerTurn: 30 });
  assert.ok(tokens.reserve(10));
  assert.equal(tokens.reserve(1), null);
});

test("Stop during an awaited gate prevents the edit, and questions accept ordinary text", async () => {
  const controller = new AbortController();
  let dispatched = 0;
  const tool = { name: "edit", changes: "set" };
  const loop = new AgentLoop({
    services: { chat: async () => ({ complete: async () => ({ message: { content: "", tool_calls: [
      { id: "one", type: "function", function: { name: "edit", arguments: "{}" } },
    ] }, tokens: 1, finishReason: "stop" }) }) },
    registry: { alwaysLoaded: () => [], functions: () => [], find: () => tool, available: () => [tool], run: async () => { dispatched++; return { ok: true, text: "done" }; } },
    labels: { for: () => "edit" }, limits, skills: {}, subagentPrompt: async () => "",
  } as never);
  const result = await loop.run({ agent: "main", system: "", history: [], prompt: "edit", conversation: "fixture", depth: 0,
    signal: controller.signal, gate: { check: async () => { await Promise.resolve(); controller.abort(); return null; } },
    events: { thought() {}, toolStarted() {}, toolFinished() {}, subagentStarted() {}, subagentFinished() {} },
  });
  assert.equal(dispatched, 0);
  assert.equal(result.end, LoopEnd.Cancelled);
  const questions = new Questions(() => undefined);
  const pending = questions.ask("Which part?", ["Verse", "Chorus"]);
  assert.equal(questions.reply("The second half of verse two"), true);
  assert.equal(await pending, "The second half of verse two");
});

test("saved keys survive recreating Settings and never enter the frontend response", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-settings-"));
  await new SettingsStore(folder, ProviderCatalog.bundled).update({ provider: "meta", model: "muse-wonder-1.0", key: "offline-secret", services: {} });
  const reopened = new SettingsStore(folder, ProviderCatalog.bundled);
  assert.equal((await reopened.read()).key, "offline-secret");
  assert.ok(!JSON.stringify(await reopened.view()).includes("offline-secret"));
  if (process.platform !== "win32") assert.equal((await stat(join(folder, "settings.json"))).mode & 0o777, 0o600);
});

test("an aborted SDK operation waiting behind another operation never starts", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let edits = 0;
  const registry = new OperationRegistry({} as never, {
    read: { prepare: () => async () => held },
    edit: { prepare: () => async () => { edits++; } },
  } as never);
  const controller = new AbortController();
  const read = registry.run("read", {});
  const edit = registry.run("edit", {}, controller.signal);
  controller.abort();
  release();
  await read;
  await assert.rejects(edit, { name: "AbortError" });
  assert.equal(edits, 0);
});
