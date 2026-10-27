import OpenAI, { toFile } from "openai";
import type { RoleConfig } from "../shared/config";
import { Provider } from "./providers";
import type { SpeechAudio } from "./speech-audio";
import type { Transcript } from "./types";

interface MetaTranscriptResponse {
  transcript: string;
  turns: { startMs: number; endMs: number; transcript: string }[];
}

/** Words from a vocal or spoken recording: Meta's ASR endpoint, or any OpenAI-compatible /audio/transcriptions. */
export class Transcription {
  constructor(
    private readonly role: RoleConfig,
    private readonly audio: SpeechAudio,
  ) {}

  transcribe(audioPath: string): Promise<Transcript> {
    return this.role.provider === Provider.Meta ? this.withMeta(audioPath) : this.withOpenAiCompatible(audioPath);
  }

  private async withMeta(audioPath: string): Promise<Transcript> {
    const form = new FormData();
    const settings = { mode: "ENDPOINTING", model: this.role.model, audioEncoding: "WAV" };
    form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
    form.append("audio", new Blob([await this.audio.wav(audioPath)], { type: "audio/wav" }), "audio.wav");
    const response = await fetch(`${this.role.baseUrl}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.role.apiKey}`, Accept: "application/json" },
      body: form,
    });
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${await response.text()}`);
    const result = (await response.json()) as MetaTranscriptResponse;
    return {
      text: result.transcript,
      turns: result.turns.map((turn) => ({ start: turn.startMs / 1000, end: turn.endMs / 1000, text: turn.transcript })),
    };
  }

  private async withOpenAiCompatible(audioPath: string): Promise<Transcript> {
    const client = new OpenAI({ baseURL: this.role.baseUrl, apiKey: this.role.apiKey });
    const result = await client.audio.transcriptions.create({
      model: this.role.model,
      file: await toFile(await this.audio.wav(audioPath), "audio.wav"),
      response_format: "verbose_json",
    });
    return {
      text: result.text,
      turns: (result.segments ?? []).map((segment) => ({ start: segment.start, end: segment.end, text: segment.text })),
    };
  }
}
