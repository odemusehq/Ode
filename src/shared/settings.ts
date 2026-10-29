import { z } from "zod";

/** The services Ode can use beyond the chat model, each set up in Settings. */
export const OPTIONAL_ROLES = ["stem_separation", "singing_voice", "sound_generation"] as const;
export type OptionalRole = (typeof OPTIONAL_ROLES)[number];

export const ServiceSettingsSchema = z.object({
  provider: z.string(),
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string(),
});
export type ServiceSettings = z.infer<typeof ServiceSettingsSchema>;

/** The musician's choice of models and their keys, kept in Ode's storage folder. */
export const ModelSettingsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  key: z.string(),
  /** A Meta key for cover art, transcription and listening when the chat provider is Baseten or Modal. */
  metaKey: z.string(),
  services: z.partialRecord(z.enum(OPTIONAL_ROLES), ServiceSettingsSchema),
});
export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

/** One optional service as the Settings dialog sees it: its key stays with Ode and shows as set. */
export interface ServiceView {
  provider: string;
  baseUrl: string;
  model: string;
  keySet: boolean;
}

/** The settings as the Settings dialog sees them: keys stay with Ode and show as set. */
export interface SettingsView {
  provider: string;
  model: string;
  keySet: boolean;
  metaKeySet: boolean;
  services: Partial<Record<OptionalRole, ServiceView>>;
  /** The line the chosen model's licence asks Ode to show. */
  credit: string | null;
}

/** A change from the Settings dialog. A key left out keeps the saved one; an empty key clears it. */
export const SettingsUpdateSchema = z.object({
  provider: z.string(),
  model: z.string(),
  key: z.string().optional(),
  metaKey: z.string().optional(),
  services: z.partialRecord(
    z.enum(OPTIONAL_ROLES),
    z.object({ provider: z.string(), baseUrl: z.string(), model: z.string(), apiKey: z.string().optional() }),
  ),
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
  models: ChatModelOption[];
}

/** A provider for one of the optional services. */
export interface ServiceProviderOption {
  id: string;
  name: string;
  baseUrl: string;
}

/** Everything the Settings dialog shows. */
export interface SettingsResponse {
  settings: SettingsView;
  providers: ChatProviderOption[];
  services: Record<OptionalRole, ServiceProviderOption[]>;
}
