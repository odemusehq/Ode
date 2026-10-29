import type { Role, RoleConfig } from "../shared/config";
import type { Note } from "../shared/live";
import type { TextGenerator } from "./capabilities";

export interface Transcript {
  text: string;
  turns: { start: number; end: number; text: string }[];
}

export interface DemoVocalInput {
  lines: { text: string; notes: Note[] }[];
  tempo: number;
  voiceModel?: string;
}

/** Where each role's settings come from, read again at every call so changes in Settings apply at once. */
export interface RoleSource {
  roles(): Promise<Record<Role, RoleConfig>>;
}

/** Model-backed services, one role per component, each set up in Settings. */
export interface Services {
  /** One-off text answer from the main agent's model or the subagent model (no tools). */
  text(role: "main" | "subagent", prompt: string, options?: { system?: string; maxTokens?: number }): Promise<string>;
  /** The chat model of the main agent or of subagents, for the agent loop. */
  chat(role: "main" | "subagent"): Promise<TextGenerator>;
  /** Audio understanding: describe a recording or answer a question about it. */
  describeAudio(audioPath: string, question: string): Promise<string>;
  /** Transcription: words from a vocal or spoken recording. */
  transcribe(audioPath: string): Promise<Transcript>;
  /** Image generation: writes a PNG to outPath and returns it. */
  generateImage(prompt: string, outPath: string, size?: number): Promise<string>;
  /** Stem separation: isolates the described sound; writes target and rest as WAV files in outDir. */
  separateStem(audioPath: string, describe: string, outDir: string): Promise<{ target: string; rest: string }>;
  /** Singing voice: writes a WAV of a demo vocal in the artist's voice to outPath. */
  singDemoVocal(input: DemoVocalInput, outPath: string): Promise<string>;
  /** Sound generation: writes the generated sound next to outPath and returns its path. */
  generateSound(prompt: string, seconds: number, outPath: string, loop?: boolean): Promise<string>;
  /** Which roles are set up in Settings. */
  available(): Promise<Record<Role, boolean>>;
}
