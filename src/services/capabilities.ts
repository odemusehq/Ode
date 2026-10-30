import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Role } from "../shared/config";
import type { DemoVocalInput, Transcript } from "./types";
import type { AudioListeningSource, AudioTimeRange, ListeningPayload, MusicAudioSource } from "./music-audio";

/** One model call in a conversation: the messages so far, the tools on offer, and who it belongs to. */
export interface ChatTurn {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  maxTokens: number;
  /** Keeps one conversation's requests on the same server where the provider asks for it. */
  conversation: string;
  signal?: AbortSignal;
}

/** The model's answer to one turn: its message, what it cost in tokens, and why it stopped. */
export interface ChatReply {
  message: ChatCompletionMessage;
  tokens: number;
  /** "length" when the answer reached the turn's token limit and stopped part-way. */
  finishReason: string;
}

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
  lyrics_check: Capability.Text,
  stem_separation: Capability.StemSeparation,
  singing_voice: Capability.SingingVoice,
  sound_generation: Capability.SoundGeneration,
};

export interface TextOptions {
  system?: string;
  maxTokens: number;
  signal?: AbortSignal;
}

/** A request for an answer in a fixed JSON shape: the strict schema the provider enforces, and a parser that checks it. */
export interface JsonRequest<T> {
  /** The schema's name, as the provider asks for one. */
  name: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
  maxTokens: number;
  parse(value: unknown): T;
  signal?: AbortSignal;
}

export interface TextGenerator {
  ask(prompt: string, options: TextOptions): Promise<string>;
  /** One turn of a conversation with tools, for the agent loop. */
  complete(turn: ChatTurn): Promise<ChatReply>;
  /** One answer in a fixed JSON shape, at the role's reasoning effort. */
  json<T>(request: JsonRequest<T>): Promise<T>;
  /** The model names the key reaches. */
  models(): Promise<string[]>;
}

export interface AudioListeningResult {
  answer: string;
  evidence: {
    criteria: string;
    prompt: string;
    provider: string;
    model: string;
    sources: AudioListeningSource[];
    payload: ListeningPayload;
    requestHash: string;
    dispatchedAt: string;
    completedAt: string;
  };
}

export interface AudioUnderstander {
  describe(audio: MusicAudioSource, question: string, signal?: AbortSignal, range?: AudioTimeRange): Promise<AudioListeningResult>;
  compare?(a: MusicAudioSource, b: MusicAudioSource, question: string, levelMatch: boolean, signal?: AbortSignal, ranges?: { a?: AudioTimeRange; b?: AudioTimeRange }): Promise<AudioListeningResult & { comparison: unknown }>;
}

export interface Transcriber {
  transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript>;
}

export interface ImageGenerator {
  /** Writes a square PNG of size × size pixels to outPath. */
  square(prompt: string, outPath: string, size: number, signal?: AbortSignal): Promise<string>;
}

export interface SeparatedStems {
  target: string;
  rest: string;
}

export interface StemSeparator {
  /** Writes the described sound and everything else as audio files in outDir. */
  separate(audioPath: string, describe: string, outDir: string, signal?: AbortSignal): Promise<SeparatedStems>;
}

export interface SingingVoiceSynthesizer {
  /** Writes a WAV of the lyrics sung on the notes, in the voice of the reference recording. */
  sing(input: DemoVocalInput, outPath: string, signal?: AbortSignal): Promise<string>;
}

export interface SoundGenerator {
  /** Writes the generated sound next to outPath and returns its path. */
  generate(prompt: string, seconds: number, outPath: string, loop: boolean, signal?: AbortSignal): Promise<string>;
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
