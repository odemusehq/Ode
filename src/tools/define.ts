import type { ProductionTaskStore } from "../mneme/production-task";
import type { MidiMaterialScope } from "../harness/midi-materials";
import type { AudioDeliveries } from "../mneme/audio-deliveries";
import type { z } from "zod";
import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { Services } from "../services/types";
import type { SongStore, SongVersions } from "../mneme/song-store";
import type { Mneme } from "../mneme/artist";
import type { LyricsStore } from "../mneme/lyrics-store";
import type { PreferencesStore } from "../mneme/preferences";
import type { TempFolder } from "../mneme/paths";
import type { RefNames } from "./live/ref-names";

/** What a tool changes: "none" (it only reads or computes), the Live Set, or Mneme (the lyrics, the lead sheet, memory, settings, release files). */
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
   * The answer the musician tapped, or null when they stopped Ode at the question. `images`, when given, are file names in the
   * release folder shown as the answers, one per option and in the same order.
   */
  ask(text: string, options: string[], images?: string[]): Promise<string | null>;
}

export interface ToolContext {
  /** Exact temporary note material shared only within the current accepted request and original song. */
  midiMaterials?: MidiMaterialScope;
  production: ProductionTaskStore;
  deliveries: AudioDeliveries;
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
  /** The musician's consent comes first in every mode, as for using their voice. */
  consent?: boolean;
}

export function defineTool<S extends z.ZodRawShape>(tool: OdeTool<S>): OdeTool<S> {
  return tool;
}

export type AnyTool = OdeTool<any>;
