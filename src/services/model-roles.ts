import { SettingsStore } from "../mneme/settings-store";
import type { Role, RoleConfig } from "../shared/config";
import type { ChatModelOption, ModelListRequest, ModelSettings } from "../shared/settings";
import { OpenAiCompatibleText } from "./adapters/openai-compatible-text";
import { KeyGuard } from "./key-guard";
import type { ProviderCatalog } from "./provider-catalog";
import { Provider } from "./providers";
import type { RoleSource } from "./types";

/** Each role's provider, endpoint, key and model, worked out from the musician's Settings and the bundled catalog. */
export class ModelRoles implements RoleSource {
  constructor(
    private readonly settings: SettingsStore,
    private readonly catalog: ProviderCatalog,
  ) {}

  async roles(): Promise<Record<Role, RoleConfig>> {
    return this.resolve(await this.settings.read());
  }

  resolve(settings: ModelSettings): Record<Role, RoleConfig> {
    const chat = this.catalog.chatProvider(settings.provider);
    const main: RoleConfig = {
      provider: settings.provider,
      baseUrl: chat?.baseUrl ?? "",
      apiKey: settings.key,
      model: settings.model,
      conversationHeader: chat?.conversationHeader,
    };
    const meta = this.catalog.meta;
    const metaKey = settings.provider === Provider.Meta ? settings.key : settings.metaKey;
    const metaRole = (model: string): RoleConfig => ({ provider: Provider.Meta, baseUrl: meta.baseUrl, apiKey: metaKey, model });
    const lyrics = this.catalog.lyricsChoice(settings.lyrics.provider, settings.lyrics.model);
    return {
      main,
      subagent: main,
      audio_understanding: settings.provider === Provider.Baseten ? main : metaRole(meta.audioUnderstanding),
      transcription: metaRole(meta.transcription),
      lyrics_check: {
        provider: lyrics.provider.id,
        baseUrl: lyrics.provider.baseUrl,
        apiKey: SettingsStore.lyricsKey(settings, lyrics.provider.id),
        model: lyrics.model.id,
        effort: lyrics.model.effort,
      },
    };
  }

  /** The models to offer for a provider: the catalog's list, or the ones the key reaches where the provider lists them. */
  async models(request: ModelListRequest): Promise<ChatModelOption[]> {
    const provider = this.catalog.chatProvider(request.provider);
    if (!provider) return [];
    if (!provider.listsModels) return [...provider.models];
    const saved = await this.settings.read();
    const apiKey = request.key ?? (saved.provider === provider.id ? saved.key : "");
    if (!apiKey) return [];
    const lister = new KeyGuard(apiKey).protect(new OpenAiCompatibleText({ provider: provider.id, baseUrl: provider.baseUrl, apiKey, model: "" }));
    const reachable = await lister.models();
    return reachable.map((id) => ({ id, name: id, credit: provider.credit }));
  }
}
