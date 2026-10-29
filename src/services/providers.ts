/** Model providers Ode knows how to talk to. The chat provider is chosen in Settings; optional services each pick one. */
export enum Provider {
  Meta = "meta",
  Baseten = "baseten",
  Modal = "modal",
  Fal = "fal",
  ElevenLabs = "elevenlabs",
  SelfHosted = "self-hosted",
}

export function asProvider(value: string): Provider | null {
  return (Object.values(Provider) as string[]).includes(value) ? (value as Provider) : null;
}
