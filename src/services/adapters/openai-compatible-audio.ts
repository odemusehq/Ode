import OpenAI from "openai";
import { OdeConfig, type RoleConfig } from "../../shared/config";
import type { AudioUnderstander } from "../capabilities";
import { MusicAudio } from "../music-audio";

/** Audio understanding over an OpenAI-compatible endpoint that accepts input_audio parts (Meta's included). */
export class OpenAiCompatibleAudioUnderstander implements AudioUnderstander {
  private readonly client: OpenAI;
  private readonly music = new MusicAudio();

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey, timeout: 120_000, maxRetries: 0 });
  }

  async describe(audioPath: string, question: string, signal?: AbortSignal): Promise<string> {
    const prepared = await this.music.prepare(audioPath);
    return this.ask(prepared.bytes, `${question}\nListening representation: ${JSON.stringify(prepared.representation)}`, signal);
  }

  async compare(a: string, b: string, question: string, levelMatch: boolean, signal?: AbortSignal) {
    const { bytes, comparison } = await this.music.comparison(a, b, levelMatch);
    const answer = await this.ask(bytes, `${question}\nThe WAV contains A followed by B. Comparison layout: ${JSON.stringify(comparison)}. Compare both for the stated criterion; do not infer source currentness or a complete mix from these files.`, signal);
    return { answer, comparison };
  }

  private async ask(bytes: Uint8Array, question: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    const data = Buffer.from(bytes).toString("base64");
    const response = await this.client.chat.completions.create({
      model: this.role.model,
      max_tokens: OdeConfig.services.audioMaxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${question}\nAudio preparation: source channel count and sample rate preserved in PCM24 WAV; signals above full scale are uniformly attenuated to avoid conversion clipping. Stereo/full-band model judgement is not independently validated; use numerical metrics for technical claims.` },
            { type: "input_audio", input_audio: { data, format: "wav" } },
          ],
        },
      ],
    }, { signal });
    const choice = response.choices[0];
    if (!choice) throw new Error("Audio listening is incomplete: the service returned no answer.");
    if (choice.message.refusal) throw new Error(`Audio listening was refused: ${choice.message.refusal}`);
    if (choice.finish_reason !== "stop") throw new Error(`Audio listening is incomplete (${choice.finish_reason}); no audio judgement was verified. Try a shorter passage.`);
    const answer = choice.message.content?.trim();
    if (!answer) throw new Error("Audio listening is incomplete: the service returned an empty answer.");
    return answer;
  }
}
