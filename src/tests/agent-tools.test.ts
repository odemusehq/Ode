import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AgentTools, SDK_TOOL_PREFIX } from "../harness/agent-tools";
import { OdeConfig } from "../shared/config";
import { midiInputSchema } from "../tools/midi-material-adapter";

function rig() {
  const controller = new AbortController();
  const definitions = [
    { name: "track_get", description: "Read a track", input: { track: z.string() }, changes: "none" },
    { name: "track_set", description: "Edit a track", input: { track: z.string() }, changes: "set" },
  ];
  const calls: string[] = [], receipts: unknown[] = [], observations: any[] = [];
  let gate = async () => null as string | null;
  let result: any = { ok: true, text: "Completed", receipts: [{ kind: "unverified", tool: "track_set", reason: "fixture" }] };
  const bridge = new AgentTools({
    registry: { available: (kind: string) => definitions.filter(d => kind === "main" || d.changes === "none"), find: (name: string) => definitions.find(d => d.name === name),
      run: async (name: string) => { calls.push(name); return result; } },
    skills: { read: async () => "Skill text" }, labels: { for: (name: string) => name }, limits: new OdeConfig("unused", "unused").limits,
    observations: { record: async (value: unknown) => { observations.push(value); return { exchangeId: "exchange", toolCallId: "saved", targets: [] }; } },
  } as never, { signal: controller.signal, exchangeId: "exchange", gate: { check: () => gate() },
    events: { toolStarted() {}, toolFinished() {} }, onReceipts: (values: unknown[]) => receipts.push(...values),
  } as never);
  const authorize = (name: string, id: string, child = false) => bridge.authorize({ tool_name: SDK_TOOL_PREFIX + name, tool_input: { track: "bass" }, tool_use_id: id, ...(child ? { agent_id: "child" } : {}) } as never);
  const invoke = (name: string, id: string) => bridge.definitions().find(d => d.name === name)!.handler({ track: "bass" }, { _meta: { "claudecode/toolUseId": id } } as never);
  return { bridge, calls, receipts, observations, authorize, invoke, controller, gate: (value: typeof gate) => { gate = value; }, result: (value: any) => { result = value; } };
}

test("SDK calls require one exact native permit and children cannot obtain a write permit", async () => {
  const r = rig();
  assert.match((await r.authorize("track_set", "child-write", true))!, /main agent/);
  assert.equal((await r.invoke("track_set", "child-write")).isError, true);
  assert.equal(await r.authorize("track_set", "write"), null);
  assert.equal((await r.invoke("track_set", "write")).isError, false);
  assert.equal((await r.invoke("track_set", "write")).isError, true);
  assert.deepEqual(r.calls, ["track_set"]);
  assert.equal(r.receipts.length, 1);
  assert.equal(r.observations.length, 1);
});

test("Stop during permission checking and a skipped change execute no DAW action", async () => {
  const skipped = rig(); skipped.gate(async () => "Skipped");
  assert.equal(await skipped.authorize("track_set", "skipped"), "Skipped");
  assert.equal((await skipped.invoke("track_set", "skipped")).isError, true);
  const stopped = rig(); stopped.gate(async () => { stopped.controller.abort(); return null; });
  await assert.rejects(stopped.authorize("track_set", "stopped"), { name: "AbortError" });
  assert.deepEqual([...skipped.calls, ...stopped.calls], []);
});

test("a failed write retains receipts and undelivered audio is never recorded as listening success", async () => {
  const r = rig(); r.result({ ok: false, text: "Partial edit", receipts: [{ kind: "unverified" }] });
  await r.authorize("track_set", "partial");
  assert.equal((await r.invoke("track_set", "partial")).isError, true);
  assert.equal(r.receipts.length, 1);
  r.result({ ok: true, text: '{"audioAttached":true}', media: [{ description: "recording", content: { type: "audio", data: new Uint8Array([1, 2]), format: "wav" } }] });
  await r.authorize("track_get", "audio", true);
  const audio = await r.invoke("track_get", "audio");
  assert.equal(audio.isError, true);
  assert.match(JSON.stringify(audio), /has not been heard/);
  assert.ok(!JSON.stringify(audio).includes("audioAttached"));
  assert.equal(r.observations.at(-1).ok, false);
  assert.match(r.observations.at(-1).toolCallId, /^subagent:/);
});

test("the SDK keeps canonical MIDI reference schemas and sends image bytes rather than a path", () => {
  const schema = midiInputSchema("midi_clip_set_notes", { notes: z.array(z.object({ pitch: z.number() })) });
  assert.ok(schema.safeParse({ notes: { kind: "midi-material", id: "11111111-1111-4111-8111-111111111111", count: 1, sha256: "a".repeat(64) } }).success);
  assert.deepEqual(AgentTools.media({ description: "Moodboard", content: { type: "image_url", image_url: { url: "data:image/png;base64,AQID" } } }),
    [{ type: "text", text: "Moodboard" }, { type: "image", mimeType: "image/png", data: "AQID" }]);
});
