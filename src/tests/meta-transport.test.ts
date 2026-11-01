import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentMedia } from "../harness/agent-media";
import { MetaTransport } from "../harness/meta-transport";

const role = { provider: "meta", baseUrl: "https://api.meta.ai/v1", apiKey: "private-provider-key", model: "chosen-model" };

test("the SDK bridge confines credentials and models, counts native audio, and releases only final reasoning and calls", async () => {
  const media = new AgentMedia(), calls: string[] = [];
  const marker = media.add({ type: "audio", data: Uint8Array.of(1, 2, 3), format: "wav", durationSeconds: 1 });
  const transport = new MetaTransport(role, media, new AbortController().signal, "conversation", async (input, init) => {
    const request = new Request(input, init), body = JSON.parse(await request.text());
    assert.equal(request.headers.get("authorization"), `Bearer ${role.apiKey}`);
    assert.equal(body.model, role.model);
    assert.equal(body.input.at(-1).content.find((part: any) => part.type === "input_audio").input_audio.data, "AQID");
    calls.push(request.url);
    if (request.url.endsWith("input_tokens")) return Response.json({ input_tokens: 125 });
    const response = { id: "response", model: role.model, status: "completed", output: [
      { type: "reasoning", summary: [], encrypted_content: "final-state" },
      { type: "message", content: [{ type: "output_text", text: "Received recording" }] },
      { type: "function_call", call_id: "read", name: "track_get", arguments: '{"track":"bass"}', status: "completed" },
    ], usage: { input_tokens: 125, input_tokens_details: { cached_tokens: 25 }, output_tokens: 30 } };
    const events = [{ type: "response.output_item.done", item: { type: "reasoning", encrypted_content: "interim-state" } }, { type: "response.completed", response }];
    return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
  });
  const local = await transport.start();
  const send = (route: string, body: object, token = local.token) => fetch(local.url + route, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const body = { model: role.model, messages: [{ role: "user", content: marker }], stream: true };
  try {
    assert.equal((await send("/v1/messages", body, "foreign-token")).status, 401);
    assert.equal((await send("/v1/messages", { ...body, model: "other-model" })).status, 502);
    assert.equal(calls.length, 0);
    assert.deepEqual(await (await send("/v1/messages/count_tokens", body)).json(), { input_tokens: 125 });
    const stream = await (await send("/v1/messages", body)).text();
    assert.match(stream, /final-state/);
    assert.ok(!stream.includes("interim-state"));
    assert.ok(stream.indexOf("final-state") < stream.indexOf("Received recording"));
    assert.match(stream, /input_json_delta/);
    assert.match(stream, /"cache_read_input_tokens":25/);
    assert.match(stream, /message_stop/);
    assert.deepEqual(calls, ["https://api.meta.ai/v1/responses/input_tokens", "https://api.meta.ai/v1/responses"]);
  } finally { await transport.close(); }
  assert.match(media.extract(marker).text, /not attached/);
});

test("Stop cancels the upstream media request and releases no unfinished tool arguments", async () => {
  const controller = new AbortController();
  let ready!: () => void, aborted = false;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const transport = new MetaTransport(role, new AgentMedia(), controller.signal, "conversation", async (_input, init) => {
    ready();
    return new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener("abort", () => { aborted = true; reject(new DOMException("Stopped", "AbortError")); }, { once: true }));
  });
  const local = await transport.start();
  try {
    const pending = fetch(local.url + "/v1/messages", { method: "POST", headers: { authorization: `Bearer ${local.token}`, "content-type": "application/json" },
      body: JSON.stringify({ model: role.model, stream: true, messages: [{ role: "user", content: "Listen" }] }) });
    await started; controller.abort();
    const response = await pending;
    assert.equal(response.status, 499);
    assert.equal(aborted, true);
    assert.ok(!(await response.text()).includes("tool_use"));
  } finally { await transport.close(); }
});
