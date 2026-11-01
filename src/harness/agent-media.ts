import { randomUUID } from "node:crypto";
import type { AudioContent } from "../services/capabilities";

/** The SDK keeps a small reference; only the provider request receives the captured waveform. */
export class AgentMedia {
  private readonly recordings = new Map<string, { owner?: string; bytes: number; format: "wav" | "mp3"; data: string }>();
  private bytes = 0;

  add(audio: AudioContent, owner?: string): string {
    if (!audio.data.length || audio.data.length > 50_000_000) throw new Error("Audio context requires a nonempty recording of at most 50 MB.");
    const id = `ode-audio:${randomUUID()}`;
    this.recordings.set(id, { owner, bytes: audio.data.length, format: audio.format, data: Buffer.from(audio.data).toString("base64") });
    this.bytes += audio.data.length;
    while (this.bytes > 100_000_000 || this.recordings.size > 32) {
      const oldest = this.recordings.keys().next().value!;
      this.bytes -= this.recordings.get(oldest)!.bytes; this.recordings.delete(oldest);
    }
    return id;
  }

  extract(text: string, owner?: string): { text: string; audio: Record<string, any>[] } {
    const audio: Record<string, any>[] = [];
    const replaced = text.replace(/ode-audio:[a-f0-9-]{36}/g, id => {
      const value = this.recordings.get(id);
      if (!value || value.owner !== owner) return "Recording is not attached in this context; reopen its saved source with audio_read.";
      audio.push({ type: "input_audio", input_audio: { data: value.data, format: value.format } });
      return "Recording attached as native audio in this model request.";
    });
    return { text: replaced, audio };
  }

  clear(): void { this.recordings.clear(); this.bytes = 0; }
}
