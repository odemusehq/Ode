import OpenAI, { toFile } from "openai";
import type { RoleConfig } from "../../shared/config";
import type { Transcriber } from "../capabilities";
import type { SpeechAudio } from "../speech-audio";
import type { Transcript } from "../types";

interface MetaTranscriptResponse {
  transcript: string;
  turns: { startMs: number; endMs: number; transcript: string }[];
}

/** Meta's ASR endpoint: multipart request with a JSON settings part and a mono 16-bit WAV. */
export class MetaTranscriber implements Transcriber {
  constructor(
    private readonly role: RoleConfig,
    private readonly audio: SpeechAudio,
  ) {}

  async transcribe(audioPath: string): Promise<Transcript> {
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
}

/** Any OpenAI-compatible /audio/transcriptions endpoint (a hosted service or a local Whisper server). */
export class OpenAiCompatibleTranscriber implements Transcriber {
  private readonly client: OpenAI;

  constructor(
    private readonly role: RoleConfig,
    private readonly audio: SpeechAudio,
  ) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey });
  }

  async transcribe(audioPath: string): Promise<Transcript> {
    const result = await this.client.audio.transcriptions.create({
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
