import type { ChatCompletionContentPart, ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Role } from "../shared/config";
import type { Transcript } from "./types";
import type { MusicAudioSource } from "./music-audio";

/** Captured audio stays binary in the agent context; the provider adapter encodes it at dispatch. */
export interface AudioContent {
  type: "audio";
  data: Uint8Array;
  format: "wav" | "mp3";
  durationSeconds: number | null;
}

export type ChatMessage = ChatCompletionMessageParam | {
  role: "user";
  content: string | (ChatCompletionContentPart | AudioContent)[];
};

/** Estimate media separately: JSON/base64 size is not the waveform's model token count. */
export function chatContextSize(value: unknown): { chars: number; mediaTokens: number } {
  let mediaTokens = 0;
  const text = JSON.stringify(value, (_key, part) => {
    if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
      mediaTokens += 4096;
      return { type: "image_url", image_url: { detail: part.image_url.detail, url: "[image content]" } };
    }
    if (part?.type !== "audio" || !(part.data instanceof Uint8Array)) return part;
    // A conservative allowance above Spark Open's 12.5 embeddings/second; provider usage replaces it.
    // Compressed input with unknown timing uses its byte size rather than inventing a duration.
    mediaTokens += part.durationSeconds === null ? Math.ceil(part.data.byteLength / 128) : Math.ceil(part.durationSeconds * 100);
    return { type: "audio", format: part.format, durationSeconds: part.durationSeconds, bytes: part.data.byteLength };
  });
  return { chars: text.length, mediaTokens };
}

/** One model call in a conversation: the messages so far, the tools on offer, and who it belongs to. */
export interface ChatTurn {
  messages: ChatMessage[];
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
  /** The provider's actual active input size, including tool definitions, when reported. */
  inputTokens?: number;
  /** "length" when the answer reached the turn's token limit and stopped part-way. */
  finishReason: string;
}

/** What Ode needs from models, independent of who provides them. */
export enum Capability {
  Text = "text",
  Transcription = "transcription",
}

export const ROLE_CAPABILITY: Record<Role, Capability> = {
  main: Capability.Text,
  subagent: Capability.Text,
  transcription: Capability.Transcription,
  lyrics_check: Capability.Text,
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

export interface Transcriber {
  transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript>;
}

export interface CapabilityAdapters {
  [Capability.Text]: TextGenerator;
  [Capability.Transcription]: Transcriber;
}
