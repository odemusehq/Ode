import { ROLES, type OdeConfig, type Role, type RoleConfig } from "../shared/config";
import { AudioUnderstanding } from "./audio-understanding";
import { ImageGeneration } from "./image-generation";
import { isConfigured, notConfiguredMessage } from "./roles";
import { SingingVoice } from "./singing-voice";
import { SoundGeneration } from "./sound-generation";
import { SpeechAudio } from "./speech-audio";
import { StemSeparation } from "./stem-separation";
import { TextModel } from "./text";
import { Transcription } from "./transcription";
import type { DemoVocalInput, Services, Transcript } from "./types";

/** Model-backed services, each built from its role's settings on first use. */
export class ModelServices implements Services {
  /** Meta's transcription endpoint takes 16 or 24 kHz; audio understanding works well at the same rate. */
  private static readonly SPEECH_SAMPLE_RATE = 24_000;
  private static readonly TEXT_MAX_TOKENS = 4000;
  /** Release platforms ask for square artwork of at least 3000 × 3000 pixels. */
  private static readonly COVER_SIZE = 3000;
  private readonly speech = new SpeechAudio(ModelServices.SPEECH_SAMPLE_RATE);
  private readonly cache = new Map<Role, unknown>();

  constructor(private readonly config: OdeConfig) {}

  text(role: "main" | "subagent", prompt: string, options: { system?: string; maxTokens?: number } = {}): Promise<string> {
    return this.get(role, (settings) => new TextModel(settings)).ask(prompt, {
      system: options.system,
      maxTokens: options.maxTokens ?? ModelServices.TEXT_MAX_TOKENS,
    });
  }

  describeAudio(audioPath: string, question: string): Promise<string> {
    return this.get("audio_understanding", (settings) => new AudioUnderstanding(settings, this.speech)).describe(audioPath, question);
  }

  transcribe(audioPath: string): Promise<Transcript> {
    return this.get("transcription", (settings) => new Transcription(settings, this.speech)).transcribe(audioPath);
  }

  generateImage(prompt: string, outPath: string, size = ModelServices.COVER_SIZE): Promise<string> {
    return this.get("image_generation", (settings) => new ImageGeneration(settings)).square(prompt, outPath, size);
  }

  separateStem(audioPath: string, describe: string, outDir: string): Promise<{ target: string; rest: string }> {
    return this.get("stem_separation", (settings) => new StemSeparation(settings)).separate(audioPath, describe, outDir);
  }

  singDemoVocal(input: DemoVocalInput, outPath: string): Promise<string> {
    return this.get("singing_voice", (settings) => new SingingVoice(settings)).sing(input, outPath);
  }

  generateSound(prompt: string, seconds: number, outPath: string, loop = false): Promise<string> {
    return this.get("sound_generation", (settings) => new SoundGeneration(settings)).generate(prompt, seconds, outPath, loop);
  }

  available(): Record<Role, boolean> {
    return Object.fromEntries(ROLES.map((role) => [role, isConfigured(this.config.roles[role])])) as Record<Role, boolean>;
  }

  private get<T>(role: Role, create: (settings: RoleConfig) => T): T {
    const settings = this.config.roles[role];
    if (!isConfigured(settings)) throw new Error(notConfiguredMessage(role));
    if (!this.cache.has(role)) this.cache.set(role, create(settings));
    return this.cache.get(role) as T;
  }
}
