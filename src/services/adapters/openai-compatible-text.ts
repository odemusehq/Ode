import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { RoleConfig } from "../../shared/config";
import type { TextGenerator, TextOptions } from "../capabilities";

/** One model call in a conversation: the messages so far, the tools on offer, and who it belongs to. */
export interface ChatTurn {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  maxTokens: number;
  /** Keeps one conversation's requests on the same server where the provider asks for it. */
  conversation: string;
  signal?: AbortSignal;
}

/** The model's answer to one turn, with what it cost in tokens. */
export interface ChatReply {
  message: ChatCompletionMessage;
  tokens: number;
}

/** Chat Completions from any OpenAI-compatible endpoint: Meta, Baseten and Modal each serve one. */
export class OpenAiCompatibleText implements TextGenerator {
  private readonly client: OpenAI;

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey });
  }

  async ask(prompt: string, options: TextOptions): Promise<string> {
    const system: ChatCompletionMessageParam[] = options.system ? [{ role: "system", content: options.system }] : [];
    const reply = await this.complete({
      messages: [...system, { role: "user", content: prompt }],
      tools: [],
      maxTokens: options.maxTokens,
      conversation: randomUUID(),
    });
    return reply.message.content ?? "";
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
    const message = response.choices[0]?.message;
    if (!message) throw new Error(`${this.role.model} sent an empty answer.`);
    return { message, tokens: response.usage?.total_tokens ?? 0 };
  }

  /** The model names the key reaches, from the provider's model list. */
  async models(): Promise<string[]> {
    const names: string[] = [];
    for await (const model of this.client.models.list()) names.push(model.id);
    return names;
  }

  private headers(conversation: string): Record<string, string> {
    return this.role.conversationHeader ? { [this.role.conversationHeader]: conversation } : {};
  }
}
