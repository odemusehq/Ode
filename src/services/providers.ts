/** Model providers Ode knows how to talk to, chosen in Settings. */
export enum Provider {
  Meta = "meta",
  Baseten = "baseten",
  Modal = "modal",
}

/** Reads a provider's name from settings. */
export class ProviderName {
  /** The provider with this name, or null for a name Ode leaves unknown. */
  static parse(value: string): Provider | null {
    return (Object.values(Provider) as string[]).includes(value) ? (value as Provider) : null;
  }
}
