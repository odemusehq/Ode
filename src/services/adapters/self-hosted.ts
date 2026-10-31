import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RoleConfig } from "../../shared/config";
import type { SeparatedStems, SingingVoiceSynthesizer, SoundGenerator, StemSeparator } from "../capabilities";
import type { DemoVocalInput } from "../types";
import { AudioFileDecoder, decode } from "../../audio/decode";
import { encodeWav, WavBitDepth } from "../../audio/wav";

/**
 * Ode's contract for self-hosted open models. A server implements any of these endpoints
 * (Authorization: Bearer <key> when a key is set):
 *
 * POST {baseUrl}/separate  SeparateRequest → SeparateResponse
 * POST {baseUrl}/sing      SingRequest     → WAV audio
 * POST {baseUrl}/sound     SoundRequest    → WAV audio
 */
export interface SeparateRequest {
  model: string;
  describe: string;
  audio: { wavBase64: string };
}

export interface SeparateResponse {
  target: { wavBase64: string };
  rest: { wavBase64: string };
}

export interface SingRequest {
  model: string;
  tempo: number;
  /** Lyric lines with the notes each line is sung on (beats from the start of the demo). */
  lines: { text: string; notes: { pitch: number; start: number; duration: number; velocity?: number }[] }[];
  /** A recording of the artist's own voice whose timbre the model reproduces (used with their consent). */
  voice: { wavBase64: string };
}

export interface SoundRequest {
  model: string;
  prompt: string;
  seconds: number;
  loop: boolean;
}

class SelfHostedClient {
  constructor(private readonly role: RoleConfig) {}

  get model(): string {
    return this.role.model;
  }

  async post(endpoint: string, body: unknown, accept: string, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: accept };
    if (this.role.apiKey) headers.Authorization = `Bearer ${this.role.apiKey}`;
    const response = await fetch(`${this.role.baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`The server at ${this.role.baseUrl} failed on ${endpoint} (${response.status}): ${await response.text()}`);
    return response;
  }

  async saveAudio(response: Response, path: string): Promise<string> {
    const bytes = Buffer.from(await response.arrayBuffer());
    SelfHostedClient.checkWav(bytes, path);
    await writeFile(path, bytes);
    return path;
  }

  static checkWav(bytes: Uint8Array, name: string): void {
    const decoder = new AudioFileDecoder();
    const metadata = decoder.inspect(bytes, name);
    if (metadata.format !== "WAV" || metadata.frames === 0) throw new Error(`${name}: the service must return a nonempty WAV file.`);
    decoder.decode(bytes, name);
  }
}

export class SelfHostedStemSeparator implements StemSeparator {
  private readonly client: SelfHostedClient;

  constructor(role: RoleConfig) {
    this.client = new SelfHostedClient(role);
  }

  async separate(audioPath: string, describe: string, outDir: string, signal?: AbortSignal): Promise<SeparatedStems> {
    const request: SeparateRequest = { model: this.client.model, describe, audio: { wavBase64: Buffer.from(encodeWav(await decode(audioPath), WavBitDepth.Float32)).toString("base64") } };
    const result = (await (await this.client.post("/separate", request, "application/json", signal)).json()) as SeparateResponse;
    await mkdir(outDir, { recursive: true });
    const target = join(outDir, "target.wav");
    const rest = join(outDir, "rest.wav");
    const targetBytes = Buffer.from(result.target?.wavBase64 ?? "", "base64");
    const restBytes = Buffer.from(result.rest?.wavBase64 ?? "", "base64");
    SelfHostedClient.checkWav(targetBytes, target);
    SelfHostedClient.checkWav(restBytes, rest);
    await writeFile(target, targetBytes);
    await writeFile(rest, restBytes);
    return { target, rest };
  }
}

export class SelfHostedSingingVoice implements SingingVoiceSynthesizer {
  private readonly client: SelfHostedClient;

  constructor(role: RoleConfig) {
    this.client = new SelfHostedClient(role);
  }

  async sing(input: DemoVocalInput, outPath: string, signal?: AbortSignal): Promise<string> {
    if (!input.voiceModel) throw new Error("The artist's voice recording is still missing: save one with voice_reference_set first.");
    if (input.lines.some((line) => line.pronunciation !== undefined || line.alignment !== undefined || line.delivery !== undefined)) {
      throw new Error("The installed self-hosted singing contract cannot preserve chosen pronunciation, syllable-to-note alignment or delivery instructions. Those fields were not sent; use a compatible singing service before requesting that performance.");
    }
    const request: SingRequest = {
      model: this.client.model,
      tempo: input.tempo,
      lines: input.lines.map((line) => ({
        text: line.text,
        notes: line.notes.map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity })),
      })),
      voice: { wavBase64: (await readFile(input.voiceModel)).toString("base64") },
    };
    return this.client.saveAudio(await this.client.post("/sing", request, "audio/wav", signal), outPath);
  }
}

export class SelfHostedSoundGenerator implements SoundGenerator {
  private readonly client: SelfHostedClient;

  constructor(role: RoleConfig) {
    this.client = new SelfHostedClient(role);
  }

  async generate(prompt: string, seconds: number, outPath: string, loop: boolean, signal?: AbortSignal): Promise<string> {
    const request: SoundRequest = { model: this.client.model, prompt, seconds, loop };
    const path = `${outPath.replace(/\.[a-z0-9]+$/i, "")}.wav`;
    return this.client.saveAudio(await this.client.post("/sound", request, "audio/wav", signal), path);
  }
}
