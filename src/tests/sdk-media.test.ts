import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentMedia } from "../harness/agent-media";
import { MetaMessages } from "../harness/meta-messages";

test("SDK tool media becomes real audio after all tool results, with the captured bytes unchanged", () => {
  const media = new AgentMedia();
  const bytes = Uint8Array.from([82, 73, 70, 70, 1, 2, 3]);
  const marker = media.add({ type: "audio", data: bytes, format: "wav", durationSeconds: 1 }, "read-a");
  bytes[0] = 0;
  const body = MetaMessages.request({ model: "muse-spark-1.3", max_tokens: 4000, messages: [
    { role: "assistant", content: [{ type: "redacted_thinking", data: "state-before-listening" }, { type: "tool_use", id: "read-a", name: "audio_read", input: {} }, { type: "tool_use", id: "read-b", name: "track_get", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "read-a", content: `Captured recording. ${marker}` }, { type: "tool_result", tool_use_id: "read-b", content: "Track state" }] },
  ] }, media);
  assert.equal(body.model, "muse-spark-1.3");
  assert.equal(body.store, false);
  assert.deepEqual(body.input.map((item: any) => item.type ?? item.role), ["function_call", "function_call", "function_call_output", "function_call_output", "user"]);
  assert.equal(Object.hasOwn(body.input.at(-1), "type"), false, "Meta's verified music route uses Responses shorthand messages.");
  const audio = body.input.at(-1)!.content.find((part: any) => part.type === "input_audio");
  assert.equal(audio.type, "input_audio");
  assert.equal(audio.input_audio.format, "wav");
  assert.deepEqual(Buffer.from(audio.input_audio.data, "base64"), Buffer.from([82, 73, 70, 70, 1, 2, 3]));
  assert.ok(!JSON.stringify(body.input.slice(0, -1)).includes("input_audio"));
});

test("a copied or expired SDK media reference cannot open a file or claim attached audio", () => {
  const media = new AgentMedia();
  const marker = media.add({ type: "audio", data: Uint8Array.of(1), format: "mp3", durationSeconds: null }, "owned");
  const message = (id: string) => ({ model: "muse-spark-1.3", messages: [{ role: "user", content: [{ type: "tool_result", tool_use_id: id, content: marker }] }] });
  const foreign = MetaMessages.request(message("another-call"), media);
  assert.ok(!JSON.stringify(foreign).includes("input_audio"));
  assert.match(JSON.stringify(foreign), /reopen/i);
  media.clear();
  const expired = MetaMessages.request(message("owned"), media);
  assert.ok(!JSON.stringify(expired).includes("input_audio"));
  assert.match(JSON.stringify(expired), /reopen/i);
});

test("SDK instructions, tool schemas, images and encrypted reasoning survive the Responses translation", () => {
  const body = MetaMessages.request({ model: "chosen-model", max_tokens: 8000, system: "Musician directions", output_config: { effort: "high" },
    tools: [{ name: "mcp__ode__track_get", description: "Read", input_schema: { type: "object", properties: {} } }],
    messages: [{ role: "assistant", content: [{ type: "redacted_thinking", data: "encrypted-state" }, { type: "text", text: "Next step" }] },
      { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "AQID" } }] }],
  }, new AgentMedia());
  assert.deepEqual(body.include, ["reasoning.encrypted_content"]);
  assert.equal(body.reasoning.effort, "high");
  assert.equal(body.max_output_tokens, 8000);
  assert.equal(body.input[0].content[0].text, "Musician directions");
  assert.ok(body.input.filter((item: any) => item.role).every((item: any) => !Object.hasOwn(item, "type")), "Every conversational turn uses the verified shorthand route.");
  assert.deepEqual(body.input[1], { type: "reasoning", summary: [], encrypted_content: "encrypted-state" });
  assert.equal(body.input.at(-1).content[0].image_url, "data:image/png;base64,AQID");
  assert.equal(body.tools[0].type, "function");
  assert.equal(body.tools[0].name, "mcp__ode__track_get");
  assert.deepEqual(body.tools[0].parameters, { type: "object", properties: {} });
});

test("incomplete provider arguments cannot become an executable SDK tool call", () => {
  const incomplete = MetaMessages.message({ id: "resp_1", model: "chosen-model", status: "incomplete", output: [
    { type: "function_call", call_id: "edit", name: "track_set", arguments: '{"track":', status: "incomplete" },
  ], usage: { input_tokens: 12, output_tokens: 5 } });
  assert.equal(incomplete.stop_reason, "max_tokens");
  assert.ok(!incomplete.content.some((block: any) => block.type === "tool_use"));
  const complete = MetaMessages.message({ id: "resp_2", model: "chosen-model", status: "completed", output: [
    { type: "reasoning", summary: [], encrypted_content: "same-opaque-state" },
    { type: "function_call", call_id: "edit", name: "track_set", arguments: '{"track":"bass"}', status: "completed" },
  ], usage: { input_tokens: 30, input_tokens_details: { cached_tokens: 10 }, output_tokens: 8 } });
  assert.deepEqual(complete.content[0], { type: "redacted_thinking", data: "same-opaque-state" });
  assert.deepEqual(complete.content[1], { type: "tool_use", id: "edit", name: "track_set", input: { track: "bass" } });
  assert.equal(complete.usage.input_tokens + complete.usage.cache_read_input_tokens, 30);
});
