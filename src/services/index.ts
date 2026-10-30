import { OdeConfig, ROLES, type Role, type RoleConfig } from "../shared/config";
import { AdapterRegistry } from "./adapter-registry";
import { Capability, ROLE_CAPABILITY, type CapabilityAdapters, type SeparatedStems, type TextGenerator } from "./capabilities";
import { RoleCheck } from "./roles";
import { SpeechAudio } from "./speech-audio";
import type { DemoVocalInput, RoleSource, Services, Transcript } from "./types";
import type { AudioTimeRange, MusicAudioSource } from "./music-audio";

/** Model-backed services: each role's capability, served by the adapter for the provider chosen in Settings. */
export class ModelServices implements Services {
  private readonly registry = new AdapterRegistry(new SpeechAudio(OdeConfig.services.speechSampleRate));
  /** Adapters by role, rebuilt when the role's settings change. */
  private readonly cache = new Map<Role, { settings: string; adapter: unknown }>();

  constructor(private readonly source: RoleSource) {}

  async text(role: "main" | "subagent", prompt: string, options: { system?: string; maxTokens?: number; signal?: AbortSignal } = {}): Promise<string> {
    return (await this.chat(role)).ask(prompt, {
      system: options.system,
      maxTokens: options.maxTokens ?? OdeConfig.services.textMaxTokens,
      signal: options.signal,
    });
  }

  chat(role: "main" | "subagent" | "lyrics_check"): Promise<TextGenerator> {
    return this.adapter(role, Capability.Text);
  }

  async describeAudio(audio: MusicAudioSource, question: string, signal?: AbortSignal, range?: AudioTimeRange) {
    return (await this.adapter("audio_understanding", Capability.AudioUnderstanding)).describe(audio, question, signal, range);
  }

  async compareAudio(a: MusicAudioSource, b: MusicAudioSource, question: string, levelMatch: boolean, signal?: AbortSignal, ranges?: { a?: AudioTimeRange; b?: AudioTimeRange }) {
    const adapter = await this.adapter("audio_understanding", Capability.AudioUnderstanding);
    if (!adapter.compare) throw new Error("The configured audio service does not support paired comparison.");
    return adapter.compare(a, b, question, levelMatch, signal, ranges);
  }

  async transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript> {
    return (await this.adapter("transcription", Capability.Transcription)).transcribe(audio, signal);
  }

  async generateImage(prompt: string, outPath: string, size = OdeConfig.services.coverSize, signal?: AbortSignal): Promise<string> {
    return (await this.adapter("image_generation", Capability.ImageGeneration)).square(prompt, outPath, size, signal);
  }

  async separateStem(audioPath: string, describe: string, outDir: string, signal?: AbortSignal): Promise<SeparatedStems> {
    return (await this.adapter("stem_separation", Capability.StemSeparation)).separate(audioPath, describe, outDir, signal);
  }

  async singDemoVocal(input: DemoVocalInput, outPath: string, signal?: AbortSignal): Promise<string> {
    return (await this.adapter("singing_voice", Capability.SingingVoice)).sing(input, outPath, signal);
  }

  async generateSound(prompt: string, seconds: number, outPath: string, loop = false, signal?: AbortSignal): Promise<string> {
    return (await this.adapter("sound_generation", Capability.SoundGeneration)).generate(prompt, seconds, outPath, loop, signal);
  }

  async available(): Promise<Record<Role, boolean>> {
    const roles = await this.source.roles();
    return Object.fromEntries(ROLES.map((role) => [role, RoleCheck.isConfigured(roles[role])])) as Record<Role, boolean>;
  }

  private async adapter<C extends Capability>(role: Role, capability: C): Promise<CapabilityAdapters[C]> {
    if (ROLE_CAPABILITY[role] !== capability) throw new Error(`The ${role} role lacks ${capability}.`);
    const settings: RoleConfig = (await this.source.roles())[role];
    if (!RoleCheck.isConfigured(settings)) throw new Error(RoleCheck.setupMessage(role));
    const key = JSON.stringify(settings);
    const cached = this.cache.get(role);
    if (cached?.settings === key) return cached.adapter as CapabilityAdapters[C];
    const adapter = this.registry.create(capability, settings);
    this.cache.set(role, { settings: key, adapter });
    return adapter;
  }
}
