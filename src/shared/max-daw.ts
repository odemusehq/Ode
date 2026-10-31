import type { MaxParameterAddress } from "./max-parameters";

/** Explicit native operations, never an arbitrary LiveAPI dispatcher. */
export const MAX_DAW = { version: 1, messagePath: "/max-daw/message", timeoutMs: 8_000, maxPending: 8, maxBodyBytes: 65_536 } as const;
export const DAW_OPERATIONS = ["plugin_read", "plugin_preset", "device_show", "track_routing_read", "track_routing_set", "track_meters", "compressor_routing_read", "compressor_routing_set", "return_create", "clip_read", "clip_set", "clip_warp", "clip_show", "transport_read", "transport_set"] as const;
export type DawOperation = (typeof DAW_OPERATIONS)[number];
export interface MaxDawAddress extends MaxParameterAddress {
  readonly clip?: { readonly startTime?: number; readonly filePath?: string };
}
export interface MaxDawCommand {
  id: string;
  op: DawOperation;
  address: MaxDawAddress | null;
  args: Record<string, unknown>;
  scope: string;
}
export type MaxDawMessage = { id: string } & ({ ok: true; result: Record<string, unknown> } | { ok: false; error: string });
export interface MaxDaw {
  run(op: DawOperation, address: MaxDawAddress | null, args: Record<string, unknown>, scope: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
}
