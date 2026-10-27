import OpenAI from "openai";
import type { RoleConfig } from "../shared/config";
import type { SpeechAudio } from "./speech-audio";

/** Audio understanding over an OpenAI-compatible endpoint that accepts input_audio parts (Meta's included). */
export class AudioUnderstanding {
  /** Reasoning shares the output budget, so too low a limit returns an empty answer. */
  private static readonly MAX_OUTPUT_TOKENS = 4000;
  private readonly client: OpenAI;

  constructor(
    private readonly role: RoleConfig,
    private readonly audio: SpeechAudio,
  ) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey });
  }

  async describe(audioPath: string, question: string): Promise<string> {
    const data = await this.audio.base64Wav(audioPath);
    const response = await this.client.chat.completions.create({
      model: this.role.model,
      max_tokens: AudioUnderstanding.MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: question },
            { type: "input_audio", input_audio: { data, format: "wav" } },
          ],
        },
      ],
    });
    return response.choices[0]?.message.content ?? "";
  }
}
