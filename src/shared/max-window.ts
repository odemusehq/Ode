import type { DialogView } from "./config";
import type { MaxAudioCommand } from "./max-audio";
import type { MaxParameterCommand } from "./max-parameters";

/** The Max device's bootstrap controls and its authenticated loopback protocol. */
export const MAX_WINDOW = {
  version: 1,
  parameterNames: {
    signature: "Ode Window Version",
    port: "Ode Window Port",
    words: Array.from({ length: 8 }, (_, index) => `Ode Window Key ${index + 1}`),
    latch: "Ode Window Connect",
  },
  api: {
    connect: "/max-window/connect",
    poll: "/max-window/poll",
    ack: "/max-window/ack",
  },
  bootstrapMs: 15_000,
  leaseMs: 4_000,
  openTimeoutMs: 8_000,
  pollMs: 500,
  maxPending: 4,
  errorMaxChars: 256,
} as const;

/** Bootstrap controls are transport state and never musical snapshot or model context. */
export function isMaxWindowParameter(name: string): boolean {
  const names = MAX_WINDOW.parameterNames;
  return name === names.signature || name === names.port || name === names.latch || names.words.includes(name);
}

export interface MaxWindowBinding {
  readonly deviceId: string;
  readonly setId: string;
}

export interface MaxWindowBootstrap {
  readonly capability: string;
  readonly words: readonly number[];
  readonly latch: number;
}

export interface MaxWindowCommand {
  readonly id: string;
  readonly view: DialogView;
  readonly url: string;
}

export interface MaxWindowConnection {
  readonly session: string;
  /** The already authenticated Ask page, for the device's own Open Ode button. */
  readonly url: string;
}

export interface MaxWindowPoll {
  readonly command: MaxWindowCommand | null;
  readonly audio?: MaxAudioCommand | null;
  readonly parameters?: MaxParameterCommand | null;
}

export interface MaxWindowAcknowledgement {
  readonly session: string;
  readonly id: string;
  readonly status: "ready" | "error";
  readonly error?: string;
}
