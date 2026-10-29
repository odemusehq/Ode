import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import { AgentLoop, LoopEnd, LoopTool, type LoopEvents, type LoopRun } from "../harness/loop";
import { SkillLibrary } from "../harness/skills";
import { FolderTexts } from "../harness/texts";
import { ToolLabels } from "../harness/tool-labels";
import { Mneme } from "../mneme/artist";
import { ConversationStore } from "../mneme/conversations";
import { LyricsStore } from "../mneme/lyrics-store";
import { TempFolder, userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore, SongVersions } from "../mneme/song-store";
import { SnapshotReader } from "../server/snapshot-reader";
import { ModelServices } from "../services";
import type { ChatReply, ChatTurn } from "../services/adapters/openai-compatible-text";
import type { TextGenerator } from "../services/capabilities";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { OdeConfig } from "../shared/config";
import { DevConfig } from "../shared/dev-config";
import { ToolRegistry } from "../tools";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-harness-"));
}

/** A model that answers from a script, one message per turn, and keeps every turn it was sent. */
class ScriptedModel implements TextGenerator {
  readonly turns: ChatTurn[] = [];

  constructor(private readonly script: ChatCompletionMessage[]) {}

  async ask(): Promise<string> {
    return "";
  }

  async models(): Promise<string[]> {
    return [];
  }

  async complete(turn: ChatTurn): Promise<ChatReply> {
    this.turns.push({ ...turn, messages: [...turn.messages] });
    const message = this.script.shift();
    if (!message) throw new Error("The script has no more answers.");
    return { message, tokens: 10 };
  }
}

function answer(content: string, calls: { id: string; name: string; args?: object }[] = []): ChatCompletionMessage {
  const message: ChatCompletionMessage = { role: "assistant", content, refusal: null };
  if (calls.length > 0) {
    message.tool_calls = calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) } }));
  }
  return message;
}

/** The loop over the real tools and skills, against the test Set, with the model's answers scripted. */
async function rig(model: ScriptedModel) {
  const config = new OdeConfig(join(await tempDir(), "storage"), join(await tempDir(), "temp"));
  const paths = userPaths(config.userDir);
  const live = new FakeSetLive(TestSets.small());
  const song = new SongStore(paths, () => undefined);
  await song.create("Night Bus");
  const prefs = new PreferencesStore(join(paths.preferences, "preferences.json"));
  const registry = new ToolRegistry({
    config,
    live,
    song,
    lyrics: new LyricsStore(song, prefs, () => undefined),
    versions: new SongVersions(song, config.versions.snapshotEvery),
    snapshots: new SnapshotReader(live, song),
    questions: { ask: async () => null },
    mneme: new Mneme(paths, config.memory.halfLifeDays),
    prefs,
    services: new ModelServices(new ModelRoles(new SettingsStore(config.userDir, ProviderCatalog.bundled), ProviderCatalog.bundled)),
    temp: new TempFolder(config.tempDir),
    emit: () => undefined,
  });
  const skills = new SkillLibrary(new FolderTexts(DevConfig.repoDir));
  const loop = new AgentLoop({
    services: { chat: async () => model },
    registry,
    skills,
    labels: new ToolLabels(registry),
    limits: config.limits,
    subagentPrompt: async () => "You are a subagent.",
  });
  const seen: string[] = [];
  const events: LoopEvents = {
    thought: (text) => seen.push(`thought: ${text}`),
    toolStarted: (_id, name) => seen.push(`started: ${name}`),
    toolFinished: (_id, ok) => seen.push(`finished: ${ok ? "ok" : "failed"}`),
    subagentStarted: (_id, task) => seen.push(`subagent: ${task}`),
    subagentFinished: () => seen.push("subagent finished"),
  };
  const run = (overrides: Partial<LoopRun> = {}): LoopRun => ({
    agent: "main",
    system: "You are Ode.",
    history: [],
    prompt: "What tempo is the song?",
    conversation: "test",
    depth: 0,
    gate: { check: async () => null },
    events,
    signal: new AbortController().signal,
    ...overrides,
  });
  return { loop, seen, run, limits: config.limits };
}

test("the loop runs the tools the model calls, shows its note and steps, and returns its reply", async () => {
  const model = new ScriptedModel([
    answer("Reading the song first.", [{ id: "call-1", name: "song_get" }]),
    answer("The song is at 120 BPM · read from the Set"),
  ]);
  const { loop, seen, run } = await rig(model);
  const result = await loop.run(run());
  assert.equal(result.end, LoopEnd.Reply);
  assert.equal(result.reply, "The song is at 120 BPM · read from the Set");
  assert.deepEqual(seen, ["thought: Reading the song first.", "started: song_get", "finished: ok"]);
  const toolAnswer = model.turns[1]?.messages.find((message) => message.role === "tool");
  assert.match(String(toolAnswer?.content), /"tempo":120/);
});

test("a stopped request ends at once, and the deepest agents keep subagents out of their tools", async () => {
  const stopped = new AbortController();
  stopped.abort();
  const idle = await rig(new ScriptedModel([]));
  assert.equal((await idle.loop.run(idle.run({ signal: stopped.signal }))).end, LoopEnd.Cancelled);

  const model = new ScriptedModel([answer("Done.")]);
  const deepest = await rig(model);
  await deepest.loop.run(deepest.run({ agent: "subagent", depth: deepest.limits.subagentDepth }));
  const offered = model.turns[0]?.tools.map((tool) => (tool.type === "function" ? tool.function.name : "")) ?? [];
  assert.ok(offered.includes(LoopTool.SkillRead));
  assert.ok(!offered.includes(LoopTool.Subagent));
});

test("skills are read by name and sub-skills by path; their test cases stay with the repo", async () => {
  const skills = new SkillLibrary(new FolderTexts(DevConfig.repoDir));
  const index = await skills.index();
  assert.ok(index.some((skill) => skill.name === "rhymes" && skill.description.length > 0));
  assert.match(await skills.read("rhymes"), /^---/);
  await assert.rejects(skills.read("rhymes", "../../package.json"), /Ode's skills are/);
  await assert.rejects(skills.read("song-form", "evals/mark-sections-with-locators/case.yaml"), /test cases/);
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
