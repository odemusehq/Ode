import type { z } from "zod";
import type { MidiMaterialScope } from "../harness/midi-materials";
import type { SkillLibrary } from "../harness/skills";
import type { SampleFolders } from "../live/sample-folders";
import type { Mneme } from "../mneme/artist";
import type { LyricsStore } from "../mneme/lyrics-store";
import type { TempFolder } from "../mneme/paths";
import type { PreferencesStore } from "../mneme/preferences";
import type { ProductionTaskStore } from "../mneme/production-task";
import type { SongStore, SongVersions } from "../mneme/song-store";
import type { Services } from "../services/types";
import type { OdeConfig } from "../shared/config";
import type { UiEvent } from "../shared/events";
import type { LiveConnections } from "../shared/live";
import type { MaxAudioRequest, MaxAudioResult, MaxAudioSources } from "../shared/max-audio";
import type { MaxDaw } from "../shared/max-daw";
import type { MaxParameters } from "../shared/max-parameters";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { AudioContent } from "../services/capabilities";
import type { RefNames } from "./daw/ref-names";

/** Binary tool output is agent context, never JSON in History, Mneme or the activity feed. */
export const TOOL_AUDIO = Symbol("tool audio");
export interface ToolAudio { description: string; content: AudioContent }
export function withAudio<T extends object>(result: T, audio: ToolAudio[]): T & { [TOOL_AUDIO]: ToolAudio[] } {
  return Object.assign(result, { [TOOL_AUDIO]: audio });
}

/** What a tool changes: "none" (it only reads or computes), the Live Set, or Mneme (the lyrics, the lead sheet, memory and settings). */
export type ToolChange = "none" | "set" | "memory";

/** Reads the whole Set: every track, device and clip, the song's tempo, key, scale, scenes and locators, and the lead sheet. */
export interface SetReader {
  /** Throws "Ode can't read the Set: …" with the fix when Live is out of reach. */
  read(): Promise<SetSnapshot>;
  /** The most recent snapshot read, or null before the first one (or after another Set opened). */
  readonly latest: SetSnapshot | null;
}

/** One-line questions to the musician, each with two to four answers. */
export interface MusicianQuestions {
  /**
   * The answer the musician tapped, or null when they stopped Ode at the question.
   */
  ask(text: string, options: string[]): Promise<string | null>;
}

export interface ToolContext {
  /** Exact temporary note material shared only within the current accepted request and original song. */
  midiMaterials?: MidiMaterialScope;
  production: ProductionTaskStore;
  exchangeId?: string;
  toolCallId?: string;
  /** Stops later stages of an interrupted request. */
  signal?: AbortSignal;
  config: OdeConfig;
  live: LiveConnections;
  song: SongStore;
  lyrics: LyricsStore;
  versions: SongVersions;
  snapshots: SetReader;
  questions: MusicianQuestions;
  mneme: Mneme;
  prefs: PreferencesStore;
  services: Services;
  /** The same on-demand instructions available to the agent, for selected Lyricist guidance. */
  skills?: SkillLibrary;
  /** Actual audio through the paired Max device; unavailable before a capable device connects. */
  maxAudio?: {
    sources(signal?: AbortSignal): Promise<MaxAudioSources>;
    capture(input: MaxAudioRequest, signal?: AbortSignal): Promise<MaxAudioResult>;
  };
  /** Actual displayed units and native control state through the paired Max device. */
  maxParameters?: MaxParameters;
  maxDaw?: MaxDaw;
  /** Read-only discovery within the musician's Settings-approved real sample folders. */
  sampleFolders?: SampleFolders;
  /** Where generated and rendered files go. */
  temp: TempFolder;
  emit: (event: UiEvent) => void;
}

export interface OdeTool<S extends z.ZodRawShape = z.ZodRawShape> {
  /** snake_case and unique across Ode's tools: the model calls the tool by this name. */
  name: string;
  /** The only documentation of the tool: what it does, when to use it, inputs, output. */
  description: string;
  input: S;
  changes: ToolChange;
  run: (input: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
  /** Actual covered tags for tools that may skip requested targets. Empty means no target was observed. */
  observationTargets?: (result: unknown) => readonly string[];
  /**
   * One line describing a call, shown while Ode works and when asking the musician to apply it, with what it touches
   * named from the latest snapshot: "Bass · EQ Eight · 1 Frequency A to 200".
   */
  describe?: (input: z.infer<z.ZodObject<S>>, names: RefNames) => string;
  /** Keep this tool's definition always in the model's context (otherwise it is found through tool search). */
  alwaysLoad?: boolean;
  /** Only the main agent gets this tool (for example, asking the musician a question). */
  mainAgentOnly?: boolean;
  /** Quiet maintenance of the local artist database; never host edits or settings changes. */
  backgroundMemory?: boolean;
  /** The musician's consent comes first in every mode, as for using their voice. */
  consent?: boolean;
}

export function defineTool<S extends z.ZodRawShape>(tool: OdeTool<S>): OdeTool<S> {
  return tool;
}

export type AnyTool = OdeTool<any>;
