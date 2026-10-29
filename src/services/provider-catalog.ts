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

/** A Meta model that highlights syllables and rhymes in the Lyrics editor, with the lowest reasoning effort it accepts. */
export interface LyricsCheckModel extends ChatModelOption {
  readonly effort: string;
}

/** The models Settings offers for highlighting syllables and rhymes, and the one Ode uses until the musician picks. */
export interface LyricsCheckModels {
  readonly default: string;
  readonly models: LyricsCheckModel[];
}

/** Meta's models for listening, transcription, cover art and lyrics checks, used with a Meta key whatever the chat provider. */
export interface MetaModels {
  readonly baseUrl: string;
  readonly audioUnderstanding: string;
  readonly transcription: string;
  readonly imageGeneration: string;
  readonly lyricsCheck: LyricsCheckModels;
}

interface CatalogFile {
  chat: ChatProvider[];
  meta: MetaModels;
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

  /** The models Settings offers for highlighting syllables and rhymes. */
  lyricsCheckOptions(): ChatModelOption[] {
    return this.file.meta.lyricsCheck.models.map(({ id, name }) => ({ id, name }));
  }

  /** The model that highlights syllables and rhymes: the musician's pick when the catalog offers it, else the default. */
  lyricsCheckModel(chosen: string): LyricsCheckModel {
    const { default: fallback, models } = this.file.meta.lyricsCheck;
    const model = models.find((each) => each.id === chosen) ?? models.find((each) => each.id === fallback);
    if (!model) throw new Error(`providers.json needs a lyrics check model called ${fallback}.`);
    return model;
  }
}
