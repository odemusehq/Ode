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

  async transcribe(audioPath: string, signal?: AbortSignal): Promise<Transcript> {
    const form = new FormData();
    const settings = { mode: "ENDPOINTING", model: this.role.model, audioEncoding: "WAV" };
    form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
    form.append("audio", new Blob([await this.audio.wav(audioPath)], { type: "audio/wav" }), "audio.wav");
    const response = await fetch(`${this.role.baseUrl}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.role.apiKey}`, Accept: "application/json" },
      body: form,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${await response.text()}`);
    const result = (await response.json()) as MetaTranscriptResponse;
    if (typeof result.transcript !== "string" || !Array.isArray(result.turns) || result.turns.some((turn) => !Number.isFinite(turn.startMs) || !Number.isFinite(turn.endMs) || turn.endMs < turn.startMs || typeof turn.transcript !== "string")) throw new Error("Transcription returned an unreadable transcript or detection times.");
    return {
      text: result.transcript,
      turns: result.turns.map((turn) => ({ start: turn.startMs / 1000, end: turn.endMs / 1000, text: turn.transcript })),
      timing: "speech-detection-approximate",
      providerMetadata: { ...result },
    };
  }
}
