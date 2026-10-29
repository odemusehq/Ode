import { writeFile } from "node:fs/promises";
import type { RoleConfig } from "../../shared/config";
import type { SoundGenerator } from "../capabilities";

/** Sound generation with ElevenLabs sound effects (model id from .env). */
export class ElevenLabsSoundGenerator implements SoundGenerator {
  /** ElevenLabs accepts 0.5–30 s per sound. */
  private static readonly MIN_SECONDS = 0.5;
  private static readonly MAX_SECONDS = 30;

  constructor(private readonly role: RoleConfig) {}

  async generate(prompt: string, seconds: number, outPath: string, loop: boolean, signal?: AbortSignal): Promise<string> {
    const duration = Math.min(ElevenLabsSoundGenerator.MAX_SECONDS, Math.max(ElevenLabsSoundGenerator.MIN_SECONDS, seconds));
    const response = await fetch(`${this.role.baseUrl}/v1/sound-generation`, {
      method: "POST",
      headers: { "xi-api-key": this.role.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: duration, loop, model_id: this.role.model }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Sound generation failed (${response.status}): ${await response.text()}`);
    const path = `${outPath.replace(/\.[a-z0-9]+$/i, "")}.mp3`;
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    return path;
  }
}
