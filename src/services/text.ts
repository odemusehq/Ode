import Anthropic from "@anthropic-ai/sdk";
import type { RoleConfig } from "../shared/config";
import { Provider } from "./providers";

/** One-off text answers from the main agent's or the subagent model, over the Anthropic Messages protocol. */
export class TextModel {
  private readonly client: Anthropic;

  constructor(private readonly role: RoleConfig) {
    this.client =
      role.provider === Provider.Anthropic
        ? new Anthropic({ baseURL: role.baseUrl, apiKey: role.apiKey })
        : new Anthropic({ baseURL: role.baseUrl, apiKey: null, authToken: role.apiKey });
  }

  async ask(prompt: string, options: { system?: string; maxTokens: number }): Promise<string> {
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
