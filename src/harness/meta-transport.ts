import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import OpenAI from "openai";
import type { RoleConfig } from "../shared/config";
import { KeyGuard } from "../services/key-guard";
import type { AgentMedia } from "./agent-media";
import { MetaMessages, type MessagesRequest } from "./meta-messages";

/** HTTP translation only. The official SDK owns tools, iteration, sessions and compaction. */
export class MetaTransport {
  private readonly token = randomBytes(32).toString("hex");
  private readonly controller = new AbortController();
  private readonly server = createServer((request, response) => { void this.handle(request, response); });
  private readonly client: OpenAI;
  private readonly guard: KeyGuard;

  constructor(private readonly role: RoleConfig, private readonly media: AgentMedia, private readonly signal: AbortSignal,
    conversation: string, fetcher?: typeof fetch) {
    if (role.provider !== "meta" || role.baseUrl.replace(/\/+$/, "") !== "https://api.meta.ai/v1") throw new Error("The Responses bridge requires Meta's documented endpoint.");
    this.guard = new KeyGuard(role.apiKey);
    this.client = new OpenAI({ apiKey: role.apiKey, baseURL: role.baseUrl, maxRetries: 0, fetch: fetcher,
      defaultHeaders: role.conversationHeader ? { [role.conversationHeader]: conversation } : undefined });
  }

  async start(): Promise<{ url: string; token: string }> {
    this.signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => { this.server.once("error", reject); this.server.listen(0, "127.0.0.1", resolve); });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Could not start the local SDK transport.");
    return { url: `http://127.0.0.1:${address.port}`, token: this.token };
  }

  async close(): Promise<void> {
    this.controller.abort();
    this.media.clear();
    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const disconnected = new AbortController();
    response.on("close", () => { if (!response.writableEnded) disconnected.abort(); });
    const signal = AbortSignal.any([this.signal, this.controller.signal, disconnected.signal]);
    try {
      const supplied = request.headers.authorization ?? "";
      const expected = `Bearer ${this.token}`;
      if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) { response.writeHead(401).end(); return; }
      const route = request.url?.split("?")[0];
      if (request.method !== "POST" || !["/v1/messages", "/v1/messages/count_tokens"].includes(route ?? "")) { response.writeHead(404).end(); return; }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 200_000_000) throw new Error("The SDK request is too large. Use a smaller reference or recording range.");
        chunks.push(chunk);
      }
      signal.throwIfAborted();
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as MessagesRequest;
      if (body.model !== this.role.model) throw new Error("The SDK requested a model other than Ode's selected model.");
      const native = MetaMessages.request(body, this.media);
      if (route === "/v1/messages/count_tokens") {
        const counted = await this.client.post<{ input_tokens: number }>("/responses/input_tokens", {
          body: { model: native.model, input: native.input, ...(native.tools ? { tools: native.tools } : {}) }, signal,
        });
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ input_tokens: counted.input_tokens }));
        return;
      }
      if (!body.stream) {
        const result = await this.client.responses.create({ ...native, stream: false } as OpenAI.Responses.ResponseCreateParamsNonStreaming, { signal });
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(MetaMessages.message(result)));
        return;
      }
      const stream = await this.client.responses.create({ ...native, stream: true } as OpenAI.Responses.ResponseCreateParamsStreaming, { signal });
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      const send = (type: string, data: object) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      // Use only the final encrypted state. Meta can replace it at response.completed;
      // forwarding interim snapshots would corrupt reasoning replay and the SDK's final reply.
      let completed: ReturnType<typeof MetaMessages.message> | undefined;
      for await (const event of stream) {
        if (event.type === "response.completed" || event.type === "response.incomplete") completed = MetaMessages.message(event.response);
        if (event.type === "response.failed" || event.type === "error") throw new Error(event.type === "error" ? event.message : event.response.error?.message ?? "The provider request failed.");
      }
      if (!completed) throw new Error("The provider stream ended before its final response. No tool calls were released.");
      // Account for this completed inference before the SDK can dispatch any returned tool call.
      send("message_start", { message: { ...completed, id: `msg_${randomUUID()}`, content: [], stop_reason: null } });
      for (const [index, block] of completed.content.entries()) {
        const call = block.type === "tool_use" || block.type === "server_tool_use";
        send("content_block_start", { index, content_block: call ? { ...block, input: {} } : block.type === "text" ? { type: "text", text: "" } : block });
        if (block.type === "text") send("content_block_delta", { index, delta: { type: "text_delta", text: block.text } });
        if (call) send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
        send("content_block_stop", { index });
      }
      send("message_delta", { delta: { stop_reason: completed.stop_reason, stop_sequence: null }, usage: completed.usage });
      send("message_stop", {});
      response.end();
    } catch (error) {
      const detail = { type: "error", error: { type: "api_error", message: this.guard.scrub(error instanceof Error ? error.message : String(error)) } };
      if (response.destroyed) return;
      if (response.headersSent) response.end(`event: error\ndata: ${JSON.stringify(detail)}\n\n`);
      else response.writeHead(signal.aborted ? 499 : error instanceof OpenAI.APIError ? error.status ?? 502 : 502, { "content-type": "application/json" }).end(JSON.stringify(detail));
    }
  }
}
