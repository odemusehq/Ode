import { ROLES, type OdeConfig, type Role } from "../shared/config";
import { AdapterRegistry } from "./adapter-registry";
import { Capability, ROLE_CAPABILITY, type CapabilityAdapters, type SeparatedStems } from "./capabilities";
import { isConfigured, notConfiguredMessage } from "./roles";
import { SpeechAudio } from "./speech-audio";
import type { DemoVocalInput, Services, Transcript } from "./types";

/** Model-backed services: each role's capability, served by the adapter for its configured provider. */
export class ModelServices implements Services {
  /** Speech models expect 16 or 24 kHz audio. */
  private static readonly SPEECH_SAMPLE_RATE = 24_000;
  private static readonly TEXT_MAX_TOKENS = 4000;
  /** Release platforms ask for square artwork of at least 3000 × 3000 pixels. */
  private static readonly COVER_SIZE = 3000;
  private readonly registry = new AdapterRegistry(new SpeechAudio(ModelServices.SPEECH_SAMPLE_RATE));
  private readonly cache = new Map<Role, unknown>();

  constructor(private readonly config: OdeConfig) {}

  text(role: "main" | "subagent", prompt: string, options: { system?: string; maxTokens?: number } = {}): Promise<string> {
    return this.adapter(role, Capability.Text).ask(prompt, {
      system: options.system,
      maxTokens: options.maxTokens ?? ModelServices.TEXT_MAX_TOKENS,
    });
  }

  describeAudio(audioPath: string, question: string): Promise<string> {
    return this.adapter("audio_understanding", Capability.AudioUnderstanding).describe(audioPath, question);
  }

  transcribe(audioPath: string): Promise<Transcript> {
    return this.adapter("transcription", Capability.Transcription).transcribe(audioPath);
  }

  generateImage(prompt: string, outPath: string, size = ModelServices.COVER_SIZE): Promise<string> {
    return this.adapter("image_generation", Capability.ImageGeneration).square(prompt, outPath, size);
  }

  separateStem(audioPath: string, describe: string, outDir: string): Promise<SeparatedStems> {
    return this.adapter("stem_separation", Capability.StemSeparation).separate(audioPath, describe, outDir);
  }

  singDemoVocal(input: DemoVocalInput, outPath: string): Promise<string> {
    return this.adapter("singing_voice", Capability.SingingVoice).sing(input, outPath);
  }

  generateSound(prompt: string, seconds: number, outPath: string, loop = false): Promise<string> {
    return this.adapter("sound_generation", Capability.SoundGeneration).generate(prompt, seconds, outPath, loop);
  }

  available(): Record<Role, boolean> {
    return Object.fromEntries(ROLES.map((role) => [role, isConfigured(this.config.roles[role])])) as Record<Role, boolean>;
  }

  private adapter<C extends Capability>(role: Role, capability: C): CapabilityAdapters[C] {
    if (ROLE_CAPABILITY[role] !== capability) throw new Error(`The ${role} role doesn't provide ${capability}.`);
    const settings = this.config.roles[role];
    if (!isConfigured(settings)) throw new Error(notConfiguredMessage(role));
    if (!this.cache.has(role)) this.cache.set(role, this.registry.create(capability, settings));
    return this.cache.get(role) as CapabilityAdapters[C];
  }
}
