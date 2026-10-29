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
}
