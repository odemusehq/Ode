import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { OdeConfig, type RoleConfig } from "../../shared/config";
import type { AudioListeningResult, AudioUnderstander } from "../capabilities";
import { MusicAudio, audioHash, type AudioListeningSource, type AudioTimeRange, type ListeningPayload, type MusicAudioSource } from "../music-audio";
import { Provider } from "../providers";

/** Audio understanding over an OpenAI-compatible endpoint that accepts input_audio parts (Meta's included). */
export class OpenAiCompatibleAudioUnderstander implements AudioUnderstander {
  private readonly client: OpenAI;
  private readonly music = new MusicAudio();

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey, timeout: 120_000, maxRetries: 0 });
  }

  async describe(audio: MusicAudioSource, question: string, signal?: AbortSignal, range?: AudioTimeRange): Promise<AudioListeningResult> {
    const prepared = await this.music.prepare(audio, range);
    return this.ask(prepared, question, `${question}\nListening representation: ${JSON.stringify(prepared.payload.representation)}`, signal);
  }

  async compare(a: MusicAudioSource, b: MusicAudioSource, question: string, levelMatch: boolean, signal?: AbortSignal, ranges?: { a?: AudioTimeRange; b?: AudioTimeRange }) {
    const prepared = await this.music.comparison(a, b, levelMatch, ranges);
    const result = await this.ask(prepared, question, `${question}\nThe WAV contains A followed by B. Comparison layout: ${JSON.stringify(prepared.comparison)}. Compare both for the stated criterion; do not infer source currentness or a complete mix from these files.`, signal);
    return { ...result, comparison: prepared.comparison };
  }

  private async ask(prepared: { bytes: Uint8Array; sources: AudioListeningSource[]; payload: ListeningPayload }, criteria: string, question: string, signal?: AbortSignal): Promise<AudioListeningResult> {
    signal?.throwIfAborted();
    const data = Buffer.from(prepared.bytes).toString("base64");
    const prompt = `${question}\nSource selections: ${JSON.stringify(prepared.sources.map((source) => source.selection))}. Each played excerpt starts at zero within its labelled playback segment; source-file times remain separate.\nAudio preparation: source channel count, sample rate and level are preserved in Float32 WAV without gain adjustment. Give qualitative listening observations. Numerical metering claims require actual readings from a supported Ableton, Max or plug-in analyser; do not invent them from this request.`;
    const requestHash = audioHash(Buffer.from(JSON.stringify({ model: this.role.model, prompt, maxTokens: OdeConfig.services.audioMaxTokens, payloadSha256: prepared.payload.sha256 })));
    const dispatchedAt = new Date().toISOString();
    // Baseten's multimodal gateway uses audio_url; Meta's direct API uses input_audio.
    const audioPart = this.role.provider === Provider.Baseten
      ? { type: "audio_url", audio_url: { url: `data:audio/wav;base64,${data}` } }
      : { type: "input_audio", input_audio: { data, format: "wav" } };
    const response = await this.client.post<ChatCompletion>("/chat/completions", { body: {
      model: this.role.model,
      max_tokens: OdeConfig.services.audioMaxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            audioPart,
          ],
        },
      ],
    }, signal });
    const choice = response.choices?.[0];
    if (!choice) throw new Error("Audio listening is incomplete: the service returned no answer.");
    if (choice.message.refusal) throw new Error(`Audio listening was refused: ${choice.message.refusal}`);
    if (choice.finish_reason !== "stop") throw new Error(`Audio listening is incomplete (${choice.finish_reason}); no audio judgement was verified. Try a shorter passage.`);
    const answer = choice.message.content?.trim();
    if (!answer) throw new Error("Audio listening is incomplete: the service returned an empty answer.");
    return { answer, evidence: { criteria, prompt, provider: this.role.provider, model: this.role.model, sources: prepared.sources, payload: prepared.payload,
      requestHash, dispatchedAt, completedAt: new Date().toISOString() } };
  }
}
