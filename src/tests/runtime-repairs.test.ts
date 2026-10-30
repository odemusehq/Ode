import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { OperationRegistry } from "../live/extension/ops/registry";
import { OdeSession } from "../harness/session";
import { AgentLoop, LoopEnd, RequestBudget } from "../harness/loop";
import { ConversationStore } from "../mneme/conversations";
import { SettingsStore } from "../mneme/settings-store";
import { ProviderCatalog } from "../services/provider-catalog";
import { OdeConfig } from "../shared/config";
import { assertUnlocked } from "../tools/locked-material";
import { ToolRegistry } from "../tools";
import { TestSets } from "./sets";
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

test("the normal production budget has room beyond sixty model calls but still bounds tokens", () => {
  const budget = new RequestBudget(limits);
  for (let index = 0; index < 61; index++) {
    const admitted = budget.reserve(100);
    assert.ok(admitted);
    admitted.settle(100);
  }
  assert.equal(budget.reached, null);
  const bounded = new RequestBudget({ ...limits, tokensPerRequest: 100 });
  assert.ok(bounded.reserve(1));
  assert.equal(bounded.reserve(1), null);
});

test("temporary MIDI material belongs to the parent request and expires immediately on Stop", async () => {
  let active = false, opened = 0, closed = 0;
  let wait: Promise<void> | undefined, enter: () => void = () => undefined;
  const loop = new AgentLoop({
    services: { chat: async () => ({ complete: async () => {
      enter(); await wait;
      return { message: { content: "Done" }, tokens: 1, finishReason: "stop" };
    } }) },
    registry: { alwaysLoaded: () => [], functions: () => [], beginMidiMaterials: () => {
      opened++; active = true;
      return () => { if (active) { active = false; closed++; } };
    } }, labels: {}, limits, skills: {}, subagentPrompt: async () => "",
  } as never);
  const controller = new AbortController();
  const start = { agent: "main" as const, system: "", history: [], prompt: "draft", conversation: "fixture", depth: 0,
    exchangeId: "request", signal: controller.signal, gate: { check: async () => null },
    events: { thought() {}, toolStarted() {}, toolFinished() {}, subagentStarted() {}, subagentFinished() {} } };
  await loop.run(start);
  assert.equal(opened, 1); assert.equal(closed, 1); assert.equal(active, false);
  await loop.run({ ...start, agent: "subagent", depth: 1 });
  assert.equal(opened, 1, "A child must not reset or close its parent's shared material.");
  let finish!: () => void;
  wait = new Promise<void>((resolve) => { finish = resolve; });
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const pending = loop.run(start);
  await entered;
  assert.equal(active, true);
  controller.abort();
  assert.equal(active, false, "Stop expires material while the provider's pending response is still unresolved.");
  finish();
  assert.equal((await pending).end, LoopEnd.Cancelled);
  assert.equal(closed, 2);
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

test("a failed change receipt stays failed in the saved conversation", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-receipt-"));
  const log = new ConversationStore(folder, 12).log("song");
  const session = new OdeSession({
    loop: { run: async (run: { onMutation: () => void }) => { run.onMutation(); return { reply: "Bass changed", tokens: 1, end: LoopEnd.Reply }; } },
    agents: { systemPrompt: async () => "" }, approvals: { denyAll() {} }, questions: { cancelAll() {} }, emit() {},
    requests: { prepare: async () => ({ hiddenContext: "fixture" }), finish: async () => { throw new Error("snapshot refused"); } },
  } as never, log);
  await session.send({ text: "Change the bass" });
  const [exchange] = await log.all();
  assert.equal(exchange?.status, "failed");
  assert.match(exchange!.reply, /Could not record the changes: snapshot refused/);
  assert.equal(exchange?.versionId, null);
});

test("identifiable locked tracks and lyric sections cannot be changed through a tool or group", async () => {
  const snapshot = TestSets.small();
  snapshot.sheet = TestSets.sheet();
  const track = snapshot.tracks[1]!;
  snapshot.sheet.locked = [track.name, "Chorus"];
  snapshot.sheet.lyrics = "[Verse]\nnew words\n[Chorus]\nkeep me";
  assert.throws(() => assertUnlocked("track_set", { track: { index: 1 }, mute: true }, snapshot), /locked/);
  assert.throws(() => assertUnlocked("apply_as_one_undo_step", { calls: [{ op: "track_set", args: { track: { name: track.name }, mute: true } }] }, snapshot), /locked/);
  assert.throws(() => assertUnlocked("lyrics_write", { text: "[Verse]\nnew words\n[Chorus]\nchanged" }, snapshot), /locked/);
  assert.doesNotThrow(() => assertUnlocked("lyrics_write", { text: "[Verse]\nother words\n[Chorus]\nkeep me" }, snapshot));
  assert.throws(() => assertUnlocked("lyrics_write", { text: "[ Chorus ]\nnew words\n[Chorus]\nkeep me" }, snapshot), /locked/);
  assert.doesNotThrow(() => assertUnlocked("song_duplicate_track", { track: { index: 1 } }, snapshot));
  assert.doesNotThrow(() => assertUnlocked("apply_as_one_undo_step", { calls: [{ op: "track_get", args: { track: { index: 1 } } }] }, snapshot));

  track.tag = "ba55";
  for (const lock of [track.name, track.tag, `${track.name} ·${track.tag}`]) {
    snapshot.sheet.locked = [lock];
    for (const ref of [{ index: 1 }, { name: track.name }, { name: `${track.name} ·${track.tag}` }, { tag: track.tag }]) {
      assert.throws(() => assertUnlocked("track_set", { track: ref, mute: true }, snapshot), /locked/);
    }
    assert.throws(() => assertUnlocked("parameter_set", { parameter: { device: { track: { index: 1 }, index: 0 }, parameter: 0 }, value: 1 }, snapshot), /locked/);
  }
  const clip = track.arrangementClips[0]!;
  snapshot.sheet.locked = [clip.name];
  assert.throws(() => assertUnlocked("song_delete_track", { track: { index: 1 } }, snapshot), /locked/);
  assert.throws(() => assertUnlocked("track_clear_range", { track: { index: 1 }, start: 4, end: 8 }, snapshot), /locked/);
  assert.doesNotThrow(() => assertUnlocked("track_clear_range", { track: { index: 1 }, start: clip.endTime, end: clip.endTime + 4 }, snapshot));
  track.clipSlots = [{ slot: 0, clip }];
  assert.throws(() => assertUnlocked("song_delete_scene", { scene: { index: 0 } }, snapshot), /locked/);
  snapshot.song.scenes[0]!.name = "Verse ·sceneTag";
  assert.throws(() => assertUnlocked("song_delete_scene", { scene: { name: "Verse" } }, snapshot), /locked/);
  snapshot.tracks[0]!.kind = "group";
  track.groupTrack = 0;
  assert.throws(() => assertUnlocked("song_delete_track", { track: { index: 0 } }, snapshot), /locked/);

  clip.tag = "keep";
  snapshot.sheet.locked = ["bass part"];
  const link = { tag: "keep", role: "bass part", description: "protected part" };
  snapshot.sheet.links = [link];
  assert.throws(() => assertUnlocked("lead_sheet_update", { links: [] }, snapshot), /locked/);
  assert.doesNotThrow(() => assertUnlocked("lead_sheet_update", { links: [{ ...link, description: "same protected part" }] }, snapshot));

  const folder = await mkdtemp(join(tmpdir(), "ode-unlock-"));
  const registry = new ToolRegistry({
    config: new OdeConfig(folder, folder), live: { extension: { call: async () => undefined } },
    song: { read: async () => snapshot.sheet }, snapshots: { read: async () => { throw new Error("Live unreadable"); } },
  } as never);
  assert.equal((await registry.run("voice_reference_clear", {})).ok, true);
});

test("retrying an accepted request keeps one exchange, including after restart", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-idempotent-"));
  const log = new ConversationStore(folder, 12).log("song");
  const id = crypto.randomUUID();
  const attempts = await Promise.all([log.beginOnce("Keep the hook", id), log.beginOnce("Keep the hook", id)]);
  assert.equal(attempts.filter((attempt) => attempt.created).length, 1);
  const reopened = new ConversationStore(folder, 12).log("song");
  assert.equal((await reopened.beginOnce("Keep the hook", id)).created, false);
  await assert.rejects(reopened.beginOnce("Change the hook", id), /different words/);
  assert.equal((await reopened.all()).length, 1);
});

test("Stop also cancels an identified request that arrives after the Stop response", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-late-request-"));
  const log = new ConversationStore(folder, 12).log("song");
  let runs = 0;
  const session = new OdeSession({ loop: { run: async () => { runs++; } }, emit() {},
    approvals: { denyAll() {} }, questions: { cancelAll() {} } } as never, log);
  const requestId = crypto.randomUUID();
  session.stop([requestId]);
  await session.accept({ requestId, text: "Replace the drums" });
  assert.equal(runs, 0);
  assert.equal((await log.all())[0]?.status, "stopped");
});
