import type { Role, RoleConfig } from "../shared/config";
import type { Note } from "../shared/live";
import type { AudioListeningResult, TextGenerator } from "./capabilities";
import type { AudioTimeRange, FrozenMusicAudio, MusicAudioSource } from "./music-audio";
import type { SpeechPayload } from "./speech-audio";

export interface Transcript {
  text: string;
  turns: { start: number; end: number; text: string }[];
  timing?: "speech-detection-approximate";
  providerMetadata?: Record<string, unknown>;
  evidence?: {
    criteria: string;
    provider: string;
    model: string;
    source: FrozenMusicAudio["source"];
    payload: SpeechPayload;
    timing: "speech-detection-approximate";
    requestHash: string;
    transcriptHash: string;
    dispatchedAt: string;
    completedAt: string;
  };
}

export interface DemoVocalInput {
  lines: { text: string; notes: Note[]; pronunciation?: string; alignment?: { syllable: number; note: number }[]; delivery?: string }[];
  tempo: number;
  voiceModel?: string;
}

/** Where each role's settings come from, read again at every call so changes in Settings apply at once. */
export interface RoleSource {
  roles(): Promise<Record<Role, RoleConfig>>;
}

/** Model-backed services, one role per component, each set up in Settings. */
export interface Services {
  /** One-off text answer from the main agent's model or the subagent model (text only, without tools). */
  text(role: "main" | "subagent", prompt: string, options?: { system?: string; maxTokens?: number; signal?: AbortSignal }): Promise<string>;
  /** The configured main, subagent or Lyricist model. */
  chat(role: "main" | "subagent" | "lyrics_check"): Promise<TextGenerator>;
  /** Audio understanding: describe a recording or answer a question about it. */
  describeAudio(audio: MusicAudioSource, question: string, signal?: AbortSignal, range?: AudioTimeRange): Promise<AudioListeningResult>;
  compareAudio?(a: MusicAudioSource, b: MusicAudioSource, question: string, levelMatch: boolean, signal?: AbortSignal, ranges?: { a?: AudioTimeRange; b?: AudioTimeRange }): Promise<AudioListeningResult & { comparison: unknown }>;
  /** Transcription: words from a vocal or spoken recording. */
  transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript>;
  /** Image generation: writes a PNG to outPath and returns it. */
  generateImage(prompt: string, outPath: string, size?: number, signal?: AbortSignal): Promise<string>;
  /** Stem separation: isolates the described sound; writes target and rest as WAV files in outDir. */
  separateStem(audioPath: string, describe: string, outDir: string, signal?: AbortSignal): Promise<{ target: string; rest: string }>;
  /** Singing voice: writes a WAV of a demo vocal in the artist's voice to outPath. */
  singDemoVocal(input: DemoVocalInput, outPath: string, signal?: AbortSignal): Promise<string>;
  /** Sound generation: writes the generated sound next to outPath and returns its path. */
  generateSound(prompt: string, seconds: number, outPath: string, loop?: boolean, signal?: AbortSignal): Promise<string>;
  /** Which roles are set up in Settings. */
  available(): Promise<Record<Role, boolean>>;
}
