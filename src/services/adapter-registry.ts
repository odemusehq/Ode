import type { RoleConfig } from "../shared/config";
import { AnthropicCompatibleText } from "./adapters/anthropic-compatible-text";
import { ElevenLabsSoundGenerator } from "./adapters/elevenlabs-sound";
import { FalStemSeparator } from "./adapters/fal-stem-separator";
import { OpenAiCompatibleAudioUnderstander } from "./adapters/openai-compatible-audio";
import { OpenAiCompatibleImageGenerator } from "./adapters/openai-compatible-images";
import { SelfHostedSingingVoice, SelfHostedSoundGenerator, SelfHostedStemSeparator } from "./adapters/self-hosted";
import { MetaTranscriber, OpenAiCompatibleTranscriber } from "./adapters/transcribers";
import { Capability, type CapabilityAdapters } from "./capabilities";
import { Provider, asProvider } from "./providers";
import type { SpeechAudio } from "./speech-audio";

type Factory<C extends Capability> = (role: RoleConfig, speech: SpeechAudio) => CapabilityAdapters[C];
type FactoryTable = { [C in Capability]: Partial<Record<Provider, Factory<C>>> };

/** Which adapter serves each capability for each provider. Adding a provider means adding a row here. */
export class AdapterRegistry {
  private static readonly TABLE: FactoryTable = {
    [Capability.Text]: {
      [Provider.Meta]: (role) => new AnthropicCompatibleText(role),
      [Provider.Anthropic]: (role) => new AnthropicCompatibleText(role),
      [Provider.OpenRouter]: (role) => new AnthropicCompatibleText(role),
      [Provider.SelfHosted]: (role) => new AnthropicCompatibleText(role),
    },
    [Capability.AudioUnderstanding]: {
      [Provider.Meta]: (role, speech) => new OpenAiCompatibleAudioUnderstander(role, speech),
      [Provider.OpenAI]: (role, speech) => new OpenAiCompatibleAudioUnderstander(role, speech),
      [Provider.OpenRouter]: (role, speech) => new OpenAiCompatibleAudioUnderstander(role, speech),
      [Provider.SelfHosted]: (role, speech) => new OpenAiCompatibleAudioUnderstander(role, speech),
    },
    [Capability.Transcription]: {
      [Provider.Meta]: (role, speech) => new MetaTranscriber(role, speech),
      [Provider.OpenAI]: (role, speech) => new OpenAiCompatibleTranscriber(role, speech),
      [Provider.SelfHosted]: (role, speech) => new OpenAiCompatibleTranscriber(role, speech),
    },
    [Capability.ImageGeneration]: {
      [Provider.Meta]: (role) => new OpenAiCompatibleImageGenerator(role),
      [Provider.OpenAI]: (role) => new OpenAiCompatibleImageGenerator(role),
      [Provider.SelfHosted]: (role) => new OpenAiCompatibleImageGenerator(role),
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
    const provider = asProvider(role.provider);
    const factory = provider ? (AdapterRegistry.TABLE[capability][provider] as Factory<C> | undefined) : undefined;
    if (!factory) {
      const supported = Object.keys(AdapterRegistry.TABLE[capability]).join(", ");
      throw new Error(`No ${capability} adapter for provider "${role.provider}". Supported: ${supported}.`);
    }
    return factory(role, this.speech);
  }
}
