import { writeFile } from "node:fs/promises";
import type { RoleConfig } from "../../shared/config";
import type { SoundGenerator } from "../capabilities";
import { AudioFileDecoder } from "../../audio/decode";

/** Sound generation with ElevenLabs sound effects (model id from .env). */
export class ElevenLabsSoundGenerator implements SoundGenerator {
  /** ElevenLabs accepts 0.5–30 s per sound. */
  private static readonly MIN_SECONDS = 0.5;
  private static readonly MAX_SECONDS = 30;

  constructor(private readonly role: RoleConfig) {}

  async generate(prompt: string, seconds: number, outPath: string, loop: boolean, signal?: AbortSignal): Promise<string> {
    const duration = Math.min(ElevenLabsSoundGenerator.MAX_SECONDS, Math.max(ElevenLabsSoundGenerator.MIN_SECONDS, seconds));
    // The provider's documented WAV output keeps generated sounds usable by the local analysis/listening path.
    const response = await fetch(`${this.role.baseUrl}/v1/sound-generation?output_format=wav_44100`, {
      method: "POST",
      headers: { "xi-api-key": this.role.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: duration, loop, model_id: this.role.model }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Sound generation as PCM WAV failed (${response.status}): ${await response.text()}. The provider must permit WAV output; MP3 is not silently substituted because local listening cannot decode it.`);
    const path = `${outPath.replace(/\.[a-z0-9]+$/i, "")}.wav`;
    const bytes = Buffer.from(await response.arrayBuffer());
    const decoder = new AudioFileDecoder();
    const metadata = decoder.inspect(bytes, path);
    if (metadata.format !== "WAV" || metadata.frames === 0) throw new Error("Sound generation did not return the requested nonempty WAV. Local listening needs PCM WAV; no MP3 fallback was used.");
    decoder.decode(bytes, path);
    await writeFile(path, bytes);
    return path;
  }
}
