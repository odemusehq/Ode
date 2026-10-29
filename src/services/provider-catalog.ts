import {
  OPTIONAL_ROLES,
  type ChatModelOption,
  type ChatProviderOption,
  type OptionalRole,
  type ServiceProviderOption,
} from "../shared/settings";
import catalogFile from "./providers.json";

/** A provider whose chat model runs Ode's agent, with what Ode needs to reach it. */
export interface ChatProvider extends ChatProviderOption {
  readonly baseUrl: string;
  /** The credit for models the provider lists. */
  readonly credit?: string;
  /** A header that keeps one conversation's requests on the same server. */
  readonly conversationHeader?: string;
}

/** Meta's models for listening, transcription and cover art, used with a Meta key whatever the chat provider. */
export interface MetaModels {
  readonly baseUrl: string;
  readonly audioUnderstanding: string;
  readonly transcription: string;
  readonly imageGeneration: string;
}

/** A model that can run Lyrics support, with the lowest reasoning effort it accepts. */
export interface LyricsModel extends ChatModelOption {
  readonly effort: string;
}

/** Lyrics support as Ode runs it: the provider to reach, and the model with its effort. */
export interface LyricsChoice {
  readonly provider: ChatProvider;
  readonly model: LyricsModel;
}

/** The providers and models offered for Lyrics support, and the pair Ode starts with. */
interface LyricsCatalog {
  readonly default: { readonly provider: string; readonly model: string };
  readonly providers: { readonly id: string; readonly models: LyricsModel[] }[];
}

interface CatalogFile {
  chat: ChatProvider[];
  meta: MetaModels;
  lyrics: LyricsCatalog;
  services: Record<OptionalRole, ServiceProviderOption[]>;
}

/** The providers and models Ode offers in Settings, bundled with Ode as providers.json. */
export class ProviderCatalog {
  static readonly bundled = new ProviderCatalog(catalogFile as CatalogFile);

  private constructor(private readonly file: CatalogFile) {}

  get meta(): MetaModels {
    return this.file.meta;
  }

  chatProvider(id: string): ChatProvider | undefined {
    return this.file.chat.find((provider) => provider.id === id);
  }

  /** The chat providers as the Settings dialog shows them. */
  chatOptions(): ChatProviderOption[] {
    return this.file.chat.map(({ id, name, keyHint, modelHint, listsModels, servesMetaModels, models }) => ({
      id,
      name,
      keyHint,
      modelHint,
      listsModels,
      servesMetaModels,
      models: [...models],
    }));
  }

  serviceOptions(): Record<OptionalRole, ServiceProviderOption[]> {
    return Object.fromEntries(OPTIONAL_ROLES.map((role) => [role, [...this.file.services[role]]])) as Record<OptionalRole, ServiceProviderOption[]>;
  }

  /** The first provider and its first model: what a fresh install starts with. */
  firstChoice(): { provider: string; model: string } {
    const provider = this.file.chat[0];
    return { provider: provider?.id ?? "", model: provider?.models[0]?.id ?? "" };
  }

  /** The credit to show for a chat model, from the model's own entry or its provider's. */
  credit(providerId: string, modelId: string): string | null {
    const provider = this.chatProvider(providerId);
    const model: ChatModelOption | undefined = provider?.models.find((each) => each.id === modelId);
    return model?.credit ?? (provider?.listsModels ? (provider.credit ?? null) : null);
  }

  /** The providers Settings offers for Lyrics support, each with the models that can run it. */
  lyricsOptions(): ChatProviderOption[] {
    return this.file.lyrics.providers.flatMap(({ id, models }) => {
      const provider = this.chatProvider(id);
      if (!provider) return [];
      return [{ id, name: provider.name, keyHint: provider.keyHint, models: models.map((model) => ({ id: model.id, name: model.name })) }];
    });
  }

  /** The provider and model Lyrics support starts with. */
  lyricsDefault(): { provider: string; model: string } {
    return { ...this.file.lyrics.default };
  }

  /** Lyrics support for the musician's choice: their provider and model where the catalog offers them, else the default. */
  lyricsChoice(providerId: string, modelId: string): LyricsChoice {
    const { default: fallback, providers } = this.file.lyrics;
    const entry = providers.find((each) => each.id === providerId) ?? providers.find((each) => each.id === fallback.provider);
    const model = entry?.models.find((each) => each.id === modelId) ?? entry?.models.find((each) => each.id === fallback.model) ?? entry?.models[0];
    const provider = entry ? this.chatProvider(entry.id) : undefined;
    if (!provider || !model) throw new Error("providers.json needs a Lyrics support provider with a model.");
    return { provider, model };
  }
}
