import type { Role, RoleConfig } from "../shared/config";
import type { TextGenerator } from "./capabilities";
import type { FrozenMusicAudio, MusicAudioSource } from "./music-audio";
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
  /** Transcription: words from a vocal or spoken recording. */
  transcribe(audio: MusicAudioSource, signal?: AbortSignal): Promise<Transcript>;
  /** Which roles are set up in Settings. */
  available(): Promise<Record<Role, boolean>>;
}
