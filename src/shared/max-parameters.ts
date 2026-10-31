/** Native Max DeviceParameter values complement the SDK's raw controls; no unit conversion runs in Ode. */
export const MAX_PARAMETERS = {
  version: 1,
  messagePath: "/max-parameters/message",
  timeoutMs: 8_000,
  maxPending: 8,
  maxBodyBytes: 16_384,
} as const;

export interface MaxParameterAddress {
  readonly path: string;
  /** Native names are compared before a positional SDK address can be used in Max. */
  readonly guards: readonly { readonly path: string; readonly name?: string }[];
}

export interface MaxParameterReading {
  readonly token: string;
  readonly path: string;
  readonly name: string;
  readonly rawValue: number;
  readonly displayValue: number | null;
  readonly formattedValue: string | null;
  readonly isEnabled: boolean | null;
  readonly state: number | null;
  readonly automationState: number | null;
}

export interface MaxParameterWrite {
  readonly before: MaxParameterReading;
  readonly after: MaxParameterReading;
}

export type MaxParameterCommand =
  | { readonly kind: "read"; readonly id: string; readonly scope: string; readonly address: MaxParameterAddress }
  | { readonly kind: "set"; readonly id: string; readonly scope: string; readonly address: MaxParameterAddress;
      readonly token: string; readonly value: number; readonly allowAutomationOverride: boolean };

export type MaxParameterMessage = { readonly id: string } & (
  | { readonly kind: "read"; readonly result: MaxParameterReading }
  | { readonly kind: "set"; readonly result: MaxParameterWrite }
  | { readonly kind: "error"; readonly error: string }
);

export interface MaxParameters {
  read(address: MaxParameterAddress, scope: string, signal?: AbortSignal): Promise<MaxParameterReading>;
  set(address: MaxParameterAddress, scope: string, token: string, value: number,
    allowAutomationOverride: boolean, signal?: AbortSignal): Promise<MaxParameterWrite>;
}
