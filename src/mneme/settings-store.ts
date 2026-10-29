import { join } from "node:path";
import type { ProviderCatalog } from "../services/provider-catalog";
import {
  ModelSettingsSchema,
  OPTIONAL_ROLES,
  type ModelSettings,
  type ServiceSettings,
  type SettingsUpdate,
  type SettingsView,
} from "../shared/settings";
import { JsonFile } from "./json-file";

/** The musician's model settings, kept as settings.json in Ode's storage folder and read at every request. */
export class SettingsStore {
  private readonly file: JsonFile<ModelSettings>;

  constructor(
    folder: string,
    private readonly catalog: ProviderCatalog,
  ) {
    // The file holds the musician's keys, so only its owner reads it.
    this.file = new JsonFile(join(folder, "settings.json"), ModelSettingsSchema, () => this.initial(), { mode: 0o600 });
  }

  read(): Promise<ModelSettings> {
    return this.file.read();
  }

  async view(): Promise<SettingsView> {
    return this.toView(await this.file.read());
  }

  async update(change: SettingsUpdate): Promise<SettingsView> {
    // A saved key stays with the provider it belongs to: choosing another provider starts with that provider's key.
    const next = await this.file.update((current) => ({
      provider: change.provider,
      model: change.model,
      key: change.key ?? (change.provider === current.provider ? current.key : ""),
      metaKey: change.metaKey ?? current.metaKey,
      services: Object.fromEntries(
        OPTIONAL_ROLES.flatMap((role) => {
          const service = change.services[role];
          if (!service?.provider) return [];
          const saved = current.services[role];
          const sameService = saved?.provider === service.provider && saved.baseUrl === service.baseUrl;
          const apiKey = service.apiKey ?? (sameService ? saved.apiKey : "");
          const kept: ServiceSettings = { ...service, apiKey };
          return [[role, kept]];
        }),
      ),
    }));
    return this.toView(next);
  }

  private initial(): ModelSettings {
    return { ...this.catalog.firstChoice(), key: "", metaKey: "", services: {} };
  }

  private toView(settings: ModelSettings): SettingsView {
    return {
      provider: settings.provider,
      model: settings.model,
      keySet: settings.key.length > 0,
      metaKeySet: settings.metaKey.length > 0,
      services: Object.fromEntries(
        OPTIONAL_ROLES.flatMap((role) => {
          const service = settings.services[role];
          return service
            ? [[role, { provider: service.provider, baseUrl: service.baseUrl, model: service.model, keySet: service.apiKey.length > 0 }]]
            : [];
        }),
      ),
      credit: this.catalog.credit(settings.provider, settings.model),
    };
  }
}
