import type { RoleConfig } from "../../shared/config";
import type { Transcriber } from "../capabilities";
import type { SpeechAudio } from "../speech-audio";
import type { Transcript } from "../types";
import { audioHash, type MusicAudioSource } from "../music-audio";

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

  async transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript> {
    const prepared = await this.audio.prepare(audio);
    signal?.throwIfAborted();
    const form = new FormData();
    const settings = { mode: "ENDPOINTING", model: this.role.model, audioEncoding: "WAV" };
    form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
    form.append("audio", new Blob([prepared.bytes], { type: "audio/wav" }), "audio.wav");
    const requestHash = audioHash(Buffer.from(JSON.stringify({ settings, payloadSha256: prepared.payload.sha256 })));
    const dispatchedAt = new Date().toISOString();
    const response = await fetch(`${this.role.baseUrl}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.role.apiKey}`, Accept: "application/json" },
      body: form,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${await response.text()}`);
    const result = (await response.json()) as MetaTranscriptResponse;
    if (typeof result.transcript !== "string" || !Array.isArray(result.turns) || result.turns.some((turn) => !Number.isFinite(turn.startMs) || !Number.isFinite(turn.endMs) || turn.startMs < 0 || turn.endMs < turn.startMs || typeof turn.transcript !== "string")) throw new Error("Transcription returned an unreadable transcript or detection times.");
    const turns = result.turns.map((turn) => ({ start: turn.startMs / 1000, end: turn.endMs / 1000, text: turn.transcript }));
    return {
      text: result.transcript,
      turns,
      timing: "speech-detection-approximate",
      providerMetadata: { ...result },
      evidence: { criteria: "Transcribe sung or spoken words with approximate speech-detection phrase times.", provider: this.role.provider, model: this.role.model,
        source: prepared.source, payload: prepared.payload, timing: "speech-detection-approximate", requestHash,
        transcriptHash: audioHash(Buffer.from(JSON.stringify({ text: result.transcript, turns, timing: "speech-detection-approximate" }))),
        dispatchedAt, completedAt: new Date().toISOString() },
    };
  }
}
