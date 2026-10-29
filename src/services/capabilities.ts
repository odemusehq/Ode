import type { Role } from "../shared/config";
import type { ChatReply, ChatTurn } from "./adapters/openai-compatible-text";
import type { DemoVocalInput, Transcript } from "./types";

/** What Ode needs from models, independent of who provides them. */
export enum Capability {
  Text = "text",
  AudioUnderstanding = "audio understanding",
  Transcription = "transcription",
  ImageGeneration = "image generation",
  StemSeparation = "stem separation",
  SingingVoice = "singing voice synthesis",
  SoundGeneration = "sound generation",
}

export const ROLE_CAPABILITY: Record<Role, Capability> = {
  main: Capability.Text,
  subagent: Capability.Text,
  audio_understanding: Capability.AudioUnderstanding,
  transcription: Capability.Transcription,
  image_generation: Capability.ImageGeneration,
  stem_separation: Capability.StemSeparation,
  singing_voice: Capability.SingingVoice,
  sound_generation: Capability.SoundGeneration,
};

export interface TextOptions {
  system?: string;
  maxTokens: number;
}

export interface TextGenerator {
  ask(prompt: string, options: TextOptions): Promise<string>;
  /** One turn of a conversation with tools, for the agent loop. */
  complete(turn: ChatTurn): Promise<ChatReply>;
  /** The model names the key reaches. */
  models(): Promise<string[]>;
}

export interface AudioUnderstander {
  describe(audioPath: string, question: string): Promise<string>;
}

export interface Transcriber {
  transcribe(audioPath: string): Promise<Transcript>;
}

export interface ImageGenerator {
  /** Writes a square PNG of size × size pixels to outPath. */
  square(prompt: string, outPath: string, size: number): Promise<string>;
}

export interface SeparatedStems {
  target: string;
  rest: string;
}

export interface StemSeparator {
  /** Writes the described sound and everything else as audio files in outDir. */
  separate(audioPath: string, describe: string, outDir: string): Promise<SeparatedStems>;
}

export interface SingingVoiceSynthesizer {
  /** Writes a WAV of the lyrics sung on the notes, in the voice of the reference recording. */
  sing(input: DemoVocalInput, outPath: string): Promise<string>;
}

export interface SoundGenerator {
  /** Writes the generated sound next to outPath and returns its path. */
  generate(prompt: string, seconds: number, outPath: string, loop: boolean): Promise<string>;
}

export interface CapabilityAdapters {
  [Capability.Text]: TextGenerator;
  [Capability.AudioUnderstanding]: AudioUnderstander;
  [Capability.Transcription]: Transcriber;
  [Capability.ImageGeneration]: ImageGenerator;
  [Capability.StemSeparation]: StemSeparator;
  [Capability.SingingVoice]: SingingVoiceSynthesizer;
  [Capability.SoundGeneration]: SoundGenerator;
}
