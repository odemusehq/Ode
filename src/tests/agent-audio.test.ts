import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAiCompatibleText } from "../services/adapters/openai-compatible-text";
import { chatContextSize, type AudioContent, type ChatMessage } from "../services/capabilities";

test("the configured agent sends tool audio with its conversation and tools, without a listening call", async () => {
  const original = globalThis.fetch;
  try {
    const data = Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4]);
    const audio: AudioContent = { type: "audio", data, format: "wav", durationSeconds: 6 };
    const messages: ChatMessage[] = [
      { role: "user", content: "Listen to the captured passage." },
      { role: "assistant", content: null, tool_calls: [{ id: "capture", type: "function", function: { name: "audio_read", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "capture", content: '{"sha256":"captured-source"}' },
      { role: "user", content: [{ type: "text", text: "Audio returned by audio_read (capture)." }, audio] },
    ];
    for (const provider of ["meta", "baseten", "modal"]) {
      let calls = 0;
      globalThis.fetch = async (input, init) => {
        calls++;
        const request = new Request(input, init), body = JSON.parse(await request.text());
        assert.equal(request.url, "https://example.invalid/v1/chat/completions");
        assert.equal(body.model, "configured-agent");
        assert.equal(body.response_format, undefined);
        assert.equal(body.messages[0].content, "Listen to the captured passage.");
        assert.equal(body.messages[2].tool_call_id, "capture");
        const part = body.messages[3].content[1];
        const encoded = provider === "baseten" ? part.audio_url.url.split(",")[1] : part.input_audio.data;
        assert.deepEqual(Buffer.from(encoded, "base64"), Buffer.from(data));
        assert.equal(part.type, provider === "baseten" ? "audio_url" : "input_audio");
        assert.equal(body.tools[0].function.name, "song_get");
        return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Observed.", refusal: null } }], usage: { total_tokens: 30, prompt_tokens: 20 } });
      };
      const agent = new OpenAiCompatibleText({ provider, baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "configured-agent" });
      const reply = await agent.complete({ messages, tools: [{ type: "function", function: { name: "song_get", parameters: {} } }], maxTokens: 4000, conversation: "same-agent" });
      assert.equal(reply.message.content, "Observed.");
      assert.equal(calls, 1);
    }
    assert.equal(messages[3]!.role, "user");
    assert.equal((messages[3]!.content as any[])[1], audio, "Provider encoding must not mutate the agent's captured content.");
  } finally { globalThis.fetch = original; }
});

test("context size counts audio separately from binary serialization", () => {
  const audio: AudioContent = { type: "audio", data: new Uint8Array(2_000_000), format: "wav", durationSeconds: 6 };
  const size = chatContextSize([{ role: "user", content: [audio] }]);
  assert.ok(size.chars < 200);
  assert.ok(size.audioTokens >= 75, "The waveform still consumes context even though it is not text.");
});
