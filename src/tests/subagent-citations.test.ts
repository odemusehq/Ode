import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AgentLoop, LoopEnd } from "../harness/loop";
import { ToolObservations, type ToolObservation } from "../mneme/tool-observations";
import { OdeConfig } from "../shared/config";

const events = { thought() {}, toolStarted() {}, toolFinished() {}, subagentStarted() {}, subagentFinished() {} };
const call = (id: string, name: string, input: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(input) } });

test("parallel child reads keep actual scoped citations despite reused provider ids and long prose", async () => {
  const folder = await mkdtemp(join(tmpdir(), "ode-child-citations-"));
  try {
    const limits = new OdeConfig("unused", "unused").limits;
    const store = new ToolObservations({ songId: "song", dataDir: folder });
    const saved: ToolObservation[] = [], childAnswers: string[] = [];
    const rounds = new Map<string, number>();
    let active = 0, concurrent = 0;
    const read = { name: "track_get", changes: "none" };
    const deps = {
      limits, skills: {}, labels: { for: () => "Read track" }, subagentPrompt: async () => "Read only.",
      observations: { record: async (input: Parameters<ToolObservations["record"]>[0]) => { const value = await store.record(input); saved.push(value); return value; } },
      registry: {
        find: () => read, available: () => [read], alwaysLoaded: () => [], functions: () => [],
        run: async (_name: string, input: { pass: number; track: { tag: string } }) => {
          active++; concurrent = Math.max(concurrent, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active--;
          return { ok: true, text: JSON.stringify({ measured: input.pass === 0 }), input,
            targets: input.pass === 0 ? ["actually-read"] : [] };
        },
      },
      services: { chat: async (agent: string) => ({ complete: async ({ conversation, messages }: { conversation: string; messages: { role: string; content?: string }[] }) => {
        const round = rounds.get(conversation) ?? 0; rounds.set(conversation, round + 1);
        if (agent === "main") {
          if (!round) return { tokens: 1, finishReason: "stop", message: { tool_calls: [
            call("left", "subagent", { task: "Read the drums." }), call("right", "subagent", { task: "Read the bass." }),
            call("same", "track_get", { pass: 0, track: { tag: "requested-main" } }),
          ] } };
          if (round === 1) {
            childAnswers.push(...messages.filter((message) => message.role === "tool" && message.content?.includes("Saved child observations:")).map((message) => message.content!));
            return { tokens: 1, finishReason: "stop", message: { tool_calls: [call("same", "track_get", { pass: 1, track: { tag: "requested-main" } })] } };
          }
          return { tokens: 1, finishReason: "stop", message: { content: "Reviewed." } };
        }
        return { tokens: 1, finishReason: "stop", message: round < 2
          ? { tool_calls: [call("same", "track_get", { pass: round, track: { tag: "requested-child" } })] }
          : { content: "Advice. ".repeat(15_000) } };
      } }) },
    };
    const loop = new AgentLoop(deps as never);
    const result = await loop.run({ agent: "main", system: "", history: [], prompt: "Review the song", conversation: "fixture", depth: 0,
      exchangeId: "accepted-exchange", signal: new AbortController().signal, gate: { check: async () => null }, events });
    assert.equal(result.end, LoopEnd.Reply);
    assert.ok(concurrent >= 2);
    assert.equal(saved.length, 6);
    assert.equal(new Set(saved.map((item) => item.toolCallId)).size, 6);
    assert.equal(saved.filter((item) => item.toolCallId.startsWith("main:")).length, 2);
    assert.ok(saved.every((item) => item.exchangeId === "accepted-exchange" && item.targetScope === "explicit"));
    assert.ok(saved.every((item) => !item.targets.includes("requested-child")));
    assert.equal(childAnswers.length, 2);
    for (const answer of childAnswers) {
      assert.ok(answer.length <= limits.toolResultMaxChars);
      const metadata = JSON.parse(answer.split("Saved child observations:")[1]!);
      assert.equal(metadata.total, 2);
      assert.equal(metadata.omitted, 0);
      assert.equal(metadata.citations.length, 2);
      for (const ref of metadata.citations) {
        const observation = await store.find(ref.exchangeId, ref.toolCallId);
        assert.ok(observation);
        assert.equal(ref.targetCount, observation.targets.length);
        assert.deepEqual(ref.targetPreview, observation.targets.slice(0, 3));
      }
    }
    rounds.clear(); childAnswers.length = 0;
    const tiny = new AgentLoop({ ...deps, limits: { ...limits, toolResultMaxChars: 100 } } as never);
    await tiny.run({ agent: "main", system: "", history: [], prompt: "Review the song", conversation: "fixture", depth: 0,
      exchangeId: "accepted-exchange", signal: new AbortController().signal, gate: { check: async () => null }, events });
    assert.equal(childAnswers.length, 2);
    for (const answer of childAnswers) {
      assert.ok(answer.length <= 100);
      const metadata = JSON.parse(answer.split("Saved child observations:")[1]!);
      assert.equal(metadata.total, 2);
      assert.equal(metadata.omitted, 2);
      assert.deepEqual(metadata.citations, []);
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test("Stop while children wait never dispatches later reads or invents saved citations", async () => {
  const controller = new AbortController();
  const limits = { ...new OdeConfig("unused", "unused").limits, subagentsAtOnce: 1 };
  let childModels = 0, reads = 0, observations = 0;
  const read = { name: "track_get", changes: "none" };
  const loop = new AgentLoop({ limits, skills: {}, labels: { for: () => "" }, subagentPrompt: async () => "",
    observations: { record: async () => { observations++; } },
    registry: { find: () => read, available: () => [read], alwaysLoaded: () => [], functions: () => [], run: async () => { reads++; } },
    services: { chat: async (agent: string) => ({ complete: async () => {
      if (agent === "main") return { tokens: 1, finishReason: "stop", message: { tool_calls: [call("a", "subagent", { task: "Read A" }), call("b", "subagent", { task: "Read B" })] } };
      childModels++; controller.abort();
      return { tokens: 1, finishReason: "stop", message: { tool_calls: [call("read", "track_get", {})] } };
    } }) },
  } as never);
  const result = await loop.run({ agent: "main", system: "", history: [], prompt: "Review", conversation: "fixture", depth: 0,
    exchangeId: "accepted-exchange", signal: controller.signal, gate: { check: async () => null }, events });
  assert.equal(result.end, LoopEnd.Cancelled);
  assert.equal(childModels, 1);
  assert.equal(reads, 0);
  assert.equal(observations, 0);
});
