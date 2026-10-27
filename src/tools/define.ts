import type { z } from "zod";
import type { OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { Services } from "../services/types";
import type { SongStore } from "../mneme/song-store";
import type { Mneme } from "../mneme/artist";
import type { PreferencesStore } from "../mneme/preferences";

/** What a tool changes: nothing, the Live Set, or Mneme. Changes need approval. */
export type ToolChange = "none" | "set" | "memory";

export interface ToolContext {
  config: OdeConfig;
  live: LiveConnections;
  song: SongStore;
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
  /** One plain sentence describing a change, shown when asking the musician for approval. */
  describe?: (input: z.infer<z.ZodObject<S>>) => string;
  /** Keep this tool's definition always in the model's context (otherwise it is found through tool search). */
  alwaysLoad?: boolean;
}

export function defineTool<S extends z.ZodRawShape>(tool: OdeTool<S>): OdeTool<S> {
  return tool;
}

export type AnyTool = OdeTool<any>;
