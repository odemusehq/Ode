import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";
import type { RoleConfig } from "../../shared/config";
import type { ChatReply, ChatTurn, JsonRequest, TextGenerator, TextOptions } from "../capabilities";

/** Chat Completions from any OpenAI-compatible endpoint: Meta, Baseten and Modal each serve one. */
export class OpenAiCompatibleText implements TextGenerator {
  /** Text runs about four characters to a token, for a provider whose answer leaves its usage out. */
  private static readonly CHARACTERS_PER_TOKEN = 4;
  private readonly client: OpenAI;

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey, timeout: 120_000, maxRetries: 0 });
  }

  async ask(prompt: string, options: TextOptions): Promise<string> {
    const system: ChatCompletionMessageParam[] = options.system ? [{ role: "system", content: options.system }] : [];
    const reply = await this.complete({
      messages: [...system, { role: "user", content: prompt }],
      tools: [],
      maxTokens: options.maxTokens,
      conversation: randomUUID(),
      signal: options.signal,
    });
    if (reply.message.refusal) throw new Error(`${this.role.model} refused the request: ${reply.message.refusal}`);
    if (reply.finishReason !== "stop" || !reply.message.content?.trim()) throw new Error(`${this.role.model} returned an incomplete or empty answer (${reply.finishReason}).`);
    return reply.message.content;
  }

  async complete(turn: ChatTurn): Promise<ChatReply> {
    const response = await this.client.chat.completions.create(
      {
        model: this.role.model,
        messages: turn.messages,
        tools: turn.tools.length > 0 ? turn.tools : undefined,
        max_tokens: turn.maxTokens,
      },
      { signal: turn.signal, headers: this.headers(turn.conversation) },
    );
    const choice = response.choices[0];
    if (!choice?.message) throw new Error(`${this.role.model} sent an empty answer.`);
    const tokens = response.usage?.total_tokens ?? OpenAiCompatibleText.estimate(turn, choice.message.content ?? "");
    return { message: choice.message, tokens, inputTokens: response.usage?.prompt_tokens, finishReason: choice.finish_reason ?? "stop" };
  }

  /** The provider holds the answer to the strict schema; the role's effort, where set, keeps the reasoning short. */
  async json<T>(request: JsonRequest<T>): Promise<T> {
    const response = await this.client.chat.completions.create(
      {
        model: this.role.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: request.name, schema: request.schema, strict: true } },
        reasoning_effort: this.role.effort as ReasoningEffort | undefined,
        max_tokens: request.maxTokens,
      },
      { signal: request.signal },
    );
    const content = response.choices[0]?.message?.content;
    const choice = response.choices[0];
    if (choice?.finish_reason !== "stop" || choice.message.refusal) throw new Error(`${this.role.model} returned an incomplete or refused structured answer.`);
    if (!content) throw new Error(`${this.role.model} sent an empty answer.`);
    return request.parse(JSON.parse(content));
  }

  /** The model names the key reaches, from the provider's model list. */
  async models(): Promise<string[]> {
    const names: string[] = [];
    for await (const model of this.client.models.list()) names.push(model.id);
    return names;
  }

  /** Tokens of a turn, worked out from its length. */
  private static estimate(turn: ChatTurn, answer: string): number {
    return Math.ceil((JSON.stringify(turn.messages).length + answer.length) / OpenAiCompatibleText.CHARACTERS_PER_TOKEN);
  }

  private headers(conversation: string): Record<string, string> {
    return this.role.conversationHeader ? { [this.role.conversationHeader]: conversation } : {};
  }
}
