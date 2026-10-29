import type { SettingsStore } from "../mneme/settings-store";
import type { Role, RoleConfig } from "../shared/config";
import type { ChatModelOption, ModelListRequest, ModelSettings } from "../shared/settings";
import { OpenAiCompatibleText } from "./adapters/openai-compatible-text";
import type { ProviderCatalog } from "./provider-catalog";
import { Provider } from "./providers";
import type { RoleSource } from "./types";

/** Each role's provider, endpoint, key and model, worked out from the musician's Settings and the bundled catalog. */
export class ModelRoles implements RoleSource {
  private static readonly UNSET: RoleConfig = { provider: "", baseUrl: "", apiKey: "", model: "" };

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
    return {
      main,
      subagent: main,
      audio_understanding: metaRole(meta.audioUnderstanding),
      transcription: metaRole(meta.transcription),
      image_generation: metaRole(meta.imageGeneration),
      stem_separation: settings.services.stem_separation ?? ModelRoles.UNSET,
      singing_voice: settings.services.singing_voice ?? ModelRoles.UNSET,
      sound_generation: settings.services.sound_generation ?? ModelRoles.UNSET,
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
    const reachable = await new OpenAiCompatibleText({ provider: provider.id, baseUrl: provider.baseUrl, apiKey, model: "" }).models();
    return reachable.map((id) => ({ id, name: id, credit: provider.credit }));
  }
}
