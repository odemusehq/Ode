import Anthropic from "@anthropic-ai/sdk";
import type { RoleConfig } from "../../shared/config";
import type { TextGenerator, TextOptions } from "../capabilities";
import { Provider } from "../providers";

/** Text from any Anthropic Messages-compatible endpoint (Meta, Anthropic, OpenRouter, a LiteLLM proxy…). */
export class AnthropicCompatibleText implements TextGenerator {
  private readonly client: Anthropic;

  constructor(private readonly role: RoleConfig) {
    // Anthropic's own API takes an API key header; other compatible endpoints take a bearer token.
    this.client =
      role.provider === Provider.Anthropic
        ? new Anthropic({ baseURL: role.baseUrl, apiKey: role.apiKey })
        : new Anthropic({ baseURL: role.baseUrl, apiKey: null, authToken: role.apiKey });
  }

  async ask(prompt: string, options: TextOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: this.role.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}
