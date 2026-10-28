import type { z } from "zod";
import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { Services } from "../services/types";
import type { SongStore, SongVersions } from "../mneme/song-store";
import type { Mneme } from "../mneme/artist";
import type { PreferencesStore } from "../mneme/preferences";

/** What a tool changes: nothing, the Live Set, or Mneme. In Manual mode, changes to the Set wait for the musician. */
export type ToolChange = "none" | "set" | "memory";

/** Reads the whole Set: every track, device and clip, plus the transport and the selection. */
export interface SetReader {
  /** Throws "Ode can't read the Set: …" with the fix when Live isn't reachable. */
  read(): Promise<SetSnapshot>;
}

/** One-line questions to the musician, each with two to four answers. */
export interface MusicianQuestions {
  /** The answer the musician tapped, or null when they stopped Ode instead. */
  ask(text: string, options: string[]): Promise<string | null>;
}

export interface ToolContext {
  config: OdeConfig;
  live: LiveConnections;
  song: SongStore;
  versions: SongVersions;
  snapshots: SetReader;
  questions: MusicianQuestions;
  mneme: Mneme;
  prefs: PreferencesStore;
  services: Services;
  emit: (event: UiEvent) => void;
}

export interface OdeTool<S extends z.ZodRawShape = z.ZodRawShape> {
  /** snake_case; shown to the model as mcp__<server>__<name>. */
  name: string;
  /** The only documentation of the tool: what it does, when to use it, inputs, output. */
  description: string;
  input: S;
  changes: ToolChange;
  run: (input: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
  /** One plain sentence describing a change, shown while Ode works and when asking the musician to apply it. */
  describe?: (input: z.infer<z.ZodObject<S>>) => string;
  /** Keep this tool's definition always in the model's context (otherwise it is found through tool search). */
  alwaysLoad?: boolean;
  /** Only the main agent gets this tool (for example, asking the musician a question). */
  mainAgentOnly?: boolean;
}

export function defineTool<S extends z.ZodRawShape>(tool: OdeTool<S>): OdeTool<S> {
  return tool;
}

export type AnyTool = OdeTool<any>;
