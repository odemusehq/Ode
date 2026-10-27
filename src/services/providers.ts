/** Model providers Ode knows how to talk to. The provider of each role is set in .env. */
export enum Provider {
  Meta = "meta",
  Anthropic = "anthropic",
  OpenRouter = "openrouter",
  OpenAI = "openai",
  Replicate = "replicate",
  Fal = "fal",
  Modal = "modal",
  ElevenLabs = "elevenlabs",
  Stability = "stability",
}

export function asProvider(value: string): Provider | null {
  return (Object.values(Provider) as string[]).includes(value) ? (value as Provider) : null;
}
