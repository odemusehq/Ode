import type { RoleConfig } from "../shared/config";
import { ElevenLabsSoundGenerator } from "./adapters/elevenlabs-sound";
import { FalStemSeparator } from "./adapters/fal-stem-separator";
import { OpenAiCompatibleAudioUnderstander } from "./adapters/openai-compatible-audio";
import { OpenAiCompatibleImageGenerator } from "./adapters/openai-compatible-images";
import { OpenAiCompatibleText } from "./adapters/openai-compatible-text";
import { SelfHostedSingingVoice, SelfHostedSoundGenerator, SelfHostedStemSeparator } from "./adapters/self-hosted";
import { MetaTranscriber } from "./adapters/transcribers";
import { Capability, type CapabilityAdapters } from "./capabilities";
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
    [Capability.AudioUnderstanding]: {
      [Provider.Meta]: (role, speech) => new OpenAiCompatibleAudioUnderstander(role, speech),
    },
    [Capability.Transcription]: {
      [Provider.Meta]: (role, speech) => new MetaTranscriber(role, speech),
    },
    [Capability.ImageGeneration]: {
      [Provider.Meta]: (role) => new OpenAiCompatibleImageGenerator(role),
    },
    [Capability.StemSeparation]: {
      [Provider.Fal]: (role) => new FalStemSeparator(role),
      [Provider.SelfHosted]: (role) => new SelfHostedStemSeparator(role),
    },
    [Capability.SingingVoice]: {
      [Provider.SelfHosted]: (role) => new SelfHostedSingingVoice(role),
    },
    [Capability.SoundGeneration]: {
      [Provider.ElevenLabs]: (role) => new ElevenLabsSoundGenerator(role),
      [Provider.SelfHosted]: (role) => new SelfHostedSoundGenerator(role),
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
    return factory(role, this.speech);
  }
}
