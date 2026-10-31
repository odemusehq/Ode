import { join } from "node:path";
import type { ProviderCatalog } from "../services/provider-catalog";
import { Provider } from "../services/providers";
import {
  ModelSettingsSchema,
  type ModelSettings,
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
      ...current,
      provider: change.provider,
      model: change.model,
      key: change.key ?? (change.provider === current.provider ? current.key : ""),
      metaKey: change.metaKey ?? current.metaKey,
      lyrics: change.lyrics
        ? {
            provider: change.lyrics.provider,
            model: change.lyrics.model,
            key: change.lyrics.key ?? (change.lyrics.provider === current.lyrics.provider ? current.lyrics.key : ""),
          }
        : current.lyrics,
    }));
    return this.toView(next);
  }

  /** The key Lyrics support uses with `provider`: its own, or the key Ode already holds for that provider. */
  static lyricsKey(settings: ModelSettings, provider: string): string {
    if (settings.lyrics.key && settings.lyrics.provider === provider) return settings.lyrics.key;
    if (provider === settings.provider) return settings.key;
    return provider === Provider.Meta ? settings.metaKey : "";
  }

  private initial(): ModelSettings {
    return { ...this.catalog.firstChoice(), key: "", metaKey: "", lyrics: { ...this.catalog.lyricsDefault(), key: "" } };
  }

  private toView(settings: ModelSettings): SettingsView {
    const lyrics = this.catalog.lyricsChoice(settings.lyrics.provider, settings.lyrics.model);
    return {
      provider: settings.provider,
      model: settings.model,
      keySet: settings.key.length > 0,
      metaKeySet: settings.metaKey.length > 0,
      lyrics: {
        provider: lyrics.provider.id,
        model: lyrics.model.id,
        keySet: SettingsStore.lyricsKey(settings, lyrics.provider.id).length > 0,
      },
      credit: this.catalog.credit(settings.provider, settings.model),
    };
  }
}
