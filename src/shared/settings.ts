import { z } from "zod";

/** Lyrics support: the model that highlights syllables and rhymes in the Lyrics editor, with its provider and key. */
export const LyricsSupportSchema = z.object({
  provider: z.string(),
  model: z.string(),
  key: z.string(),
});
export type LyricsSupport = z.infer<typeof LyricsSupportSchema>;

/** Explicitly approved local folders; saving resolves each to its real directory. */
export const SampleFoldersSchema = z.array(z.string().trim().min(1).max(4096)).max(16);

/** Model choices and protected local keys. Unknown saved fields survive updates but are never exposed in SettingsView. */
export const ModelSettingsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  key: z.string(),
  /** A Meta key for transcription and listening when the chat provider is Baseten or Modal. */
  metaKey: z.string(),
  /** Empty provider and model mean the catalog's default; settings saved before Lyrics support start that way. */
  lyrics: LyricsSupportSchema.default({ provider: "", model: "", key: "" }),
  sampleFolders: SampleFoldersSchema.default([]),
}).passthrough();
export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

/** The settings as the Settings dialog sees them: keys stay with Ode and show as set. */
export interface SettingsView {
  provider: string;
  model: string;
  keySet: boolean;
  metaKeySet: boolean;
  /** Lyrics support's provider and model, and whether Ode holds a key for that provider. */
  lyrics: { provider: string; model: string; keySet: boolean };
  /** The line the chosen model's licence asks Ode to show. */
  credit: string | null;
  sampleFolders: string[];
}

/** A change from the Settings dialog. A key left out keeps the saved one; an empty key clears it. */
export const SettingsUpdateSchema = z.object({
  provider: z.string(),
  model: z.string(),
  key: z.string().optional(),
  metaKey: z.string().optional(),
  lyrics: z.object({ provider: z.string(), model: z.string(), key: z.string().optional() }).optional(),
  sampleFolders: SampleFoldersSchema.optional(),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

/** Asks the provider which models a key reaches (Modal lists the musician's own endpoints). */
export const ModelListRequestSchema = z.object({
  provider: z.string(),
  key: z.string().optional(),
});
export type ModelListRequest = z.infer<typeof ModelListRequestSchema>;

/** One model a chat provider serves, as Settings lists it. */
export interface ChatModelOption {
  id: string;
  name: string;
  /** The line the model's licence asks Ode to show. */
  credit?: string;
}

/** A chat provider as Settings offers it. */
export interface ChatProviderOption {
  id: string;
  name: string;
  keyHint: string;
  modelHint?: string;
  /** The provider lists the musician's own models once the key is in, as Modal does with its endpoints. */
  listsModels?: boolean;
  /** The provider's key also reaches Meta's models for listening and transcription. */
  servesMetaModels?: boolean;
  models: ChatModelOption[];
}

/** Everything the Settings dialog shows. */
export interface SettingsResponse {
  settings: SettingsView;
  providers: ChatProviderOption[];
  /** The providers and models that can run Lyrics support. */
  lyricsProviders: ChatProviderOption[];
}
