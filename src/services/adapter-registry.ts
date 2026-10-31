import type { RoleConfig } from "../shared/config";
import { OpenAiCompatibleText } from "./adapters/openai-compatible-text";
import { MetaTranscriber } from "./adapters/transcribers";
import { Capability, type CapabilityAdapters } from "./capabilities";
import { KeyGuard } from "./key-guard";
import { Provider, ProviderName } from "./providers";
import type { SpeechAudio } from "./speech-audio";

type Factory<C extends Capability> = (role: RoleConfig, speech: SpeechAudio) => CapabilityAdapters[C];
type FactoryTable = { [C in Capability]: Partial<Record<Provider, Factory<C>>> };

/** Which adapter serves each capability for each provider. Adding a provider means adding a row here. */
export class AdapterRegistry {
  private static readonly TABLE: FactoryTable = {
    [Capability.Text]: {
      [Provider.Meta]: (role) => new OpenAiCompatibleText(role),
      [Provider.Baseten]: (role) => new OpenAiCompatibleText(role),
      [Provider.Modal]: (role) => new OpenAiCompatibleText(role),
    },
    [Capability.Transcription]: {
      [Provider.Meta]: (role, speech) => new MetaTranscriber(role, speech),
    },
  };

  constructor(private readonly speech: SpeechAudio) {}

  create<C extends Capability>(capability: C, role: RoleConfig): CapabilityAdapters[C] {
    const provider = ProviderName.parse(role.provider);
    const factory = provider ? (AdapterRegistry.TABLE[capability][provider] as Factory<C> | undefined) : undefined;
    if (!factory) {
      const supported = Object.keys(AdapterRegistry.TABLE[capability]).join(", ");
      throw new Error(`Provider "${role.provider}" is missing a ${capability} adapter. Supported: ${supported}.`);
    }
    return new KeyGuard(role.apiKey).protect(factory(role, this.speech));
  }
}
