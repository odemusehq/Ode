import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import { AgentLoop, LoopEnd, LoopTool, RequestBudget, type LoopEvents, type LoopRun } from "../harness/loop";
import { SkillLibrary } from "../harness/skills";
import { FolderTexts } from "../harness/texts";
import { ToolLabels } from "../harness/tool-labels";
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
import type { ChatReply, ChatTurn, TextGenerator } from "../services/capabilities";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { OdeConfig } from "../shared/config";
import { DevConfig } from "../shared/dev-config";
import { ToolRegistry } from "../tools";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";
import { encodeWav } from "../audio/wav";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-harness-"));
}

/** An answer the model stopped at the turn's length limit. */
interface CutOff {
  cutOff: ChatCompletionMessage;
}

/** A model that answers from a script, one message per turn, and keeps every turn it was sent. */
class ScriptedModel implements TextGenerator {
  readonly turns: ChatTurn[] = [];

  constructor(private readonly script: (ChatCompletionMessage | CutOff)[]) {}

  async ask(): Promise<string> {
    return "";
  }

  async models(): Promise<string[]> {
    return [];
  }

  async json<T>(): Promise<T> {
    throw new Error("The scripted model answers in text.");
  }

  async complete(turn: ChatTurn): Promise<ChatReply> {
    this.turns.push({ ...turn, messages: [...turn.messages] });
    const next = this.script.shift();
    if (!next) throw new Error("The script has no more answers.");
    return "cutOff" in next ? { message: next.cutOff, tokens: 10, finishReason: "length" } : { message: next, tokens: 10, finishReason: "stop" };
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
async function rig(model: ScriptedModel, compactAtTokens?: number) {
  const config = new OdeConfig(join(await tempDir(), "storage"), join(await tempDir(), "temp"));
  if (compactAtTokens !== undefined) Object.assign(config.limits, { compactAtTokens });
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
  return { loop, seen, run, registry, live, limits: config.limits, temp: config.tempDir };
}

test("a long run compacts and continues without replaying edits or losing the musician's request", async () => {
  const summary = "Tempo is now 107. The earlier bass edit is complete. Keep the chorus melody; hook reference hook-123 is still available. Next: arrange drums.";
  const model = new ScriptedModel([
    answer("Find devices.", [{ id: "search", name: "tool_search", args: { query: "device_get" } }]),
    answer("Find note tools.", [{ id: "notes", name: "tool_search", args: { query: "MIDI clip notes" } }]),
    answer("Earlier work. ".repeat(6_000), [{ id: "edit", name: "song_set_tempo", args: { tempo: 107 } }]),
    answer(summary),
    answer("Done."),
  ]);
  const { loop, run, live } = await rig(model, 40_000);
  const history = [{ role: "user" as const, content: "Keep the chorus melody exactly." },
    { role: "assistant" as const, content: "The chorus melody is preserved; the requested bass edit is complete." }];
  const result = await loop.run(run({ history, prompt: "Finish the arrangement.", request: "Finish the arrangement." }));
  assert.equal(result.reply, "Done.");
  assert.equal(result.tokens, 50, "The summary call shares the request's accounting.");
  assert.equal(live.snapshot().song.tempo, 107);
  assert.equal(live.calls.filter((call) => call.op === "song_set_tempo").length, 1);
  assert.ok(model.turns[1]!.tools.some((tool) => tool.type === "function" && tool.function.name === "device_get"));
  assert.deepEqual(model.turns[3]!.tools, [], "Compaction cannot execute tools.");
  assert.ok(String(model.turns[3]!.messages.at(-1)?.content).includes('Current musician request: "Finish the arrangement."'));
  const resumed = model.turns[4]!;
  assert.ok(!resumed.tools.some((tool) => tool.type === "function" && tool.function.name === "device_get"));
  assert.ok(resumed.tools.some((tool) => tool.type === "function" && tool.function.name === "midi_clip_set_notes"), "The newest discovered tools remain callable after compaction.");
  assert.deepEqual(resumed.messages.filter((message) => message.role === "user").map((message) => message.content), ["Finish the arrangement."]);
  assert.ok(resumed.messages.some((message) => String(message.content).includes(summary)));
  assert.ok(!resumed.messages.some((message) => message.role === "tool" || (message.role === "assistant" && message.tool_calls?.length)));
  assert.ok(JSON.stringify(resumed.messages).length < JSON.stringify(model.turns[3]!.messages).length / 2);
  assert.ok(!resumed.messages.some((message) => message.role === "user" && message.content === history[0]!.content), "Earlier requests must be summarised with their outcomes, rather than pinned as unanswered commands.");
  assert.equal(history.length, 2, "Compaction must not rewrite the saved conversation.");
});

test("tool audio reaches the next agent turn after every sibling tool reply, outside the text limit", async () => {
  const model = new ScriptedModel([
    answer("Read the material.", [{ id: "audio", name: "song_get" }, { id: "track", name: "track_get", args: { track: { index: 0 } } }]),
    answer("Heard the material."),
  ]);
  const { loop, run, registry, limits } = await rig(model);
  const native = registry.run.bind(registry);
  const data = new Uint8Array(100_000);
  registry.run = async (name, ...args) => name === "song_get" ? { ok: true, text: "Captured source", media: [
    { description: "Native Main post-mixer capture", content: { type: "audio", data, format: "wav", durationSeconds: 1 } },
  ] } : native(name, ...args);
  limits.toolResultMaxChars = 100;
  const result = await loop.run(run({ prompt: "Listen to this passage." }));
  assert.equal(result.reply, "Heard the material.");
  assert.equal(model.turns.length, 2, "Only the original agent's two turns run.");
  const messages = model.turns[1]!.messages;
  assert.deepEqual(messages.filter(message => message.role === "tool").map(message => message.tool_call_id), ["audio", "track"]);
  const media = messages.at(-1)!;
  assert.equal(media.role, "user");
  assert.ok(Array.isArray(media.content));
  const content = media.content as any[];
  assert.equal(content[1].data, data);
  assert.match(content[0].text, /song_get \(audio\)/);
  assert.ok(!messages.filter(message => message.role === "tool").some(message => String(message.content).includes("100000")));
});

test("Stop after a tool returns audio prevents its next model request", async () => {
  const model = new ScriptedModel([answer("Capture.", [{ id: "audio", name: "song_get" }])]);
  const { loop, run, registry } = await rig(model);
  const stop = new AbortController();
  registry.run = async () => {
    stop.abort();
    return { ok: true, text: "Capture completed", media: [{ description: "Capture", content: { type: "audio", data: Uint8Array.of(1), format: "wav", durationSeconds: 1 } }] };
  };
  const result = await loop.run(run({ signal: stop.signal }));
  assert.equal(result.end, LoopEnd.Cancelled);
  assert.equal(model.turns.length, 1);
});

test("initial image attachments remain in the main conversation exactly once after compaction", async () => {
  const model = new ScriptedModel([answer("Earlier work completed. Inspect the current moodboard."), answer("Seen the reference.")]);
  const { loop, run } = await rig(model, 40_000);
  const image = { type: "image_url" as const, image_url: { url: "data:image/png;base64,aW1hZ2U=" } };
  const result = await loop.run(run({ prompt: "Use this moodboard.", content: [image], history: [{ role: "user", content: "Earlier completed context. ".repeat(10000) }] }));
  assert.equal(result.reply, "Seen the reference.");
  assert.equal(model.turns.length, 2);
  for (const turn of model.turns) {
    const images = turn.messages.flatMap(message => message.role === "user" && Array.isArray(message.content) ? message.content.filter(part => part.type === "image_url") : []);
    assert.deepEqual(images, [image]);
  }
});

test("a real audio_read reaches the same agent through the registry and survives compaction", async () => {
  const script: ChatCompletionMessage[] = [];
  const model = new ScriptedModel(script);
  const { loop, run, temp } = await rig(model, 40_000);
  const path = await new TempFolder(temp).file("wav");
  const bytes = encodeWav({ sampleRate: 8000, channels: [Float32Array.of(0.1, -0.2)] });
  await writeFile(path, bytes);
  script.push(answer("Earlier work. ".repeat(10_000), [{ id: "read-audio", name: "audio_read", args: { path } }]),
    answer("The capture is read. Continue answering the musician's question from its attached audio."), answer("Answered from the capture."));
  const result = await loop.run(run({ prompt: "Read the captured audio and describe it." }));
  assert.equal(result.reply, "Answered from the capture.");
  assert.equal(model.turns.length, 3, "The same agent makes the tool turn, compaction and answer.");
  for (const turn of model.turns.slice(1)) {
    const audio = turn.messages.flatMap(message => message.role === "user" && Array.isArray(message.content) ? message.content.filter(part => part.type === "audio") : []) as any[];
    assert.equal(audio.length, 1);
    assert.deepEqual(Buffer.from(audio[0].data), Buffer.from(bytes));
  }
});

test("repeated inspections get a continuation reminder without blocking fresh reads", async () => {
  const model = new ScriptedModel([
    answer("Read.", [{ id: "one", name: "song_get" }]),
    answer("Read.", [{ id: "two", name: "song_get" }]),
    answer("Read.", [{ id: "three", name: "song_get" }]),
    answer("Done."),
  ]);
  const { loop, run, live } = await rig(model);
  assert.equal((await loop.run(run())).reply, "Done.");
  assert.equal(live.calls.filter((call) => call.op === "song_get").length, 3);
  assert.ok(model.turns[3]!.messages.some((message) => message.role === "system" && /repeated.*song_get/.test(String(message.content))));
});

test("a used tool stays defined for correcting its arguments on the next model call", async () => {
  const model = new ScriptedModel([
    answer("Set the tempo.", [{ id: "bad", name: "song_set_tempo", args: { tempo: "fast" } }]),
    answer("Correct the input.", [{ id: "good", name: "song_set_tempo", args: { tempo: 107 } }]),
    answer("Done."),
  ]);
  const { loop, run, live } = await rig(model);
  assert.equal((await loop.run(run())).reply, "Done.");
  assert.ok(model.turns[1]!.tools.some((tool) => tool.type === "function" && tool.function.name === "song_set_tempo"));
  assert.equal(live.snapshot().song.tempo, 107);
  assert.equal(live.calls.filter((call) => call.op === "song_set_tempo").length, 1);
});

test("compaction uses the provider's active input count when it exceeds the character estimate", async () => {
  const model = new ScriptedModel([
    answer("Read the song.", [{ id: "read", name: "song_get" }]),
    answer("Tempo is 120; next write the drums."),
    answer("Done."),
  ]);
  const complete = model.complete.bind(model);
  model.complete = async (turn) => {
    const reply = await complete(turn);
    if (model.turns.length === 1) reply.inputTokens = 50_000;
    return reply;
  };
  const { loop, run } = await rig(model, 20_000);
  assert.equal((await loop.run(run({ history: [{ role: "assistant", content: "Earlier work. ".repeat(1_500) }] }))).reply, "Done.");
  assert.deepEqual(model.turns[1]!.tools, []);
});

test("compaction keeps the shared call limit instead of starting a new budget", async () => {
  const model = new ScriptedModel([
    answer("Earlier work. ".repeat(6_000), [{ id: "edit", name: "song_set_tempo", args: { tempo: 107 } }]),
    answer("Tempo is 107. Finish the drums next."),
  ]);
  const { loop, run, limits } = await rig(model, 20_000);
  const result = await loop.run(run({ budget: new RequestBudget({ ...limits, turnsPerRequest: 2 }) }));
  assert.equal(result.end, LoopEnd.TurnLimit);
  assert.equal(result.tokens, 20);
});

test("compaction retains recent complete tool replies so it can continue from exact state", async () => {
  const model = new ScriptedModel([
    answer("Earlier work. ".repeat(6_000), [{ id: "old", name: "song_get" }]),
    answer("Confirm the tempo.", [{ id: "recent", name: "song_get" }]),
    answer("The song is at 120 BPM. Next: write the bass."),
    answer("Done."),
  ]);
  const { loop, run, limits } = await rig(model, 100_000);
  const complete = model.complete.bind(model);
  model.complete = async (turn) => {
    const reply = await complete(turn);
    if (model.turns.length === 2) limits.compactAtTokens = 20_000;
    return reply;
  };
  assert.equal((await loop.run(run())).reply, "Done.");
  const resumed = model.turns[3]!.messages;
  assert.ok(!resumed.some((message) => message.role === "tool" && message.tool_call_id === "old"));
  const exact = resumed.find((message) => message.role === "tool" && message.tool_call_id === "recent");
  assert.match(String(exact?.content), /"tempo":120/);
  assert.ok(resumed.some((message) => message.role === "assistant" && message.tool_calls?.some((call) => call.id === "recent")));
});

test("an incomplete compaction does not discard history or execute its tool calls", async () => {
  const model = new ScriptedModel([
    answer("Earlier work. ".repeat(6_000), [{ id: "edit", name: "song_set_tempo", args: { tempo: 107 } }]),
    { cutOff: answer("Unfinished summary", [{ id: "bad", name: "song_set_tempo", args: { tempo: 200 } }]) },
    { cutOff: answer("Still unfinished") },
  ]);
  const { loop, run, live } = await rig(model, 20_000);
  await assert.rejects(loop.run(run()), /compact|condens/i);
  assert.equal(live.snapshot().song.tempo, 107);
  assert.equal(live.calls.filter((call) => call.op === "song_set_tempo").length, 1);
});

test("a truncated summary retries once with more room and then continues the same request", async () => {
  const model = new ScriptedModel([
    answer("Earlier work. ".repeat(6_000), [{ id: "edit", name: "song_set_tempo", args: { tempo: 107 } }]),
    { cutOff: answer("The summary ran out of space.") },
    answer("Tempo is 107. The existing chorus stays unchanged. Next: drums."),
    answer("Done."),
  ]);
  const { loop, run, live } = await rig(model, 20_000);
  const result = await loop.run(run());
  assert.equal(result.reply, "Done.");
  assert.equal(result.tokens, 40);
  assert.ok(model.turns[2]!.maxTokens > model.turns[1]!.maxTokens);
  assert.ok(!JSON.stringify(model.turns[3]!.messages).includes("ran out of space"));
  assert.equal(live.calls.filter((call) => call.op === "song_set_tempo").length, 1);
});

test("Stop during compaction prevents the resumed model call", async () => {
  const controller = new AbortController();
  const model = new ScriptedModel([
    answer("Earlier work. ".repeat(6_000), [{ id: "edit", name: "song_set_tempo", args: { tempo: 107 } }]),
    answer("Tempo is 107. Finish the drums next."),
  ]);
  const complete = model.complete.bind(model);
  model.complete = async (turn) => {
    const reply = await complete(turn);
    if (!turn.tools.length) controller.abort();
    return reply;
  };
  const { loop, run } = await rig(model, 20_000);
  assert.equal((await loop.run(run({ signal: controller.signal }))).end, LoopEnd.Cancelled);
  assert.equal(model.turns.length, 2);
});

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

test("every tool's input becomes a function definition the model can read", async () => {
  const { registry } = await rig(new ScriptedModel([]));
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

test("an answer cut at the length limit is set aside, and the model is asked for a smaller step", async () => {
  const model = new ScriptedModel([{ cutOff: answer("Writing every note", [{ id: "call-1", name: "song_get" }]) }, answer("Done in two smaller steps.")]);
  const { loop, seen, run } = await rig(model);
  const result = await loop.run(run());
  assert.equal(result.reply, "Done in two smaller steps.");
  assert.ok(!seen.includes("started: song_get"));
  const note = model.turns[1]?.messages.at(-1);
  assert.equal(note?.role, "user");
  assert.match(String(note?.content), /length limit/);
});
