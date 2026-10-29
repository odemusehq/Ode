import type { LiveConnections, LiveLink, LiveStatus } from "../../shared/live";
import type { OperationRegistry } from "./ops/registry";

/**
 * Ode's way into Live from inside the extension: every operation runs straight away through the SDK, and its result
 * comes back as plain data. The SDK gives some numbers (scale intervals, colours, note numbers of drum pads) as
 * BigInt; they become ordinary numbers, so results can be stored as JSON like everything else Ode keeps.
 */
export class InProcessLive implements LiveConnections {
  readonly extension: LiveLink;

  constructor(operations: OperationRegistry) {
    this.extension = { call: async <R>(op: string, args: unknown) => InProcessLive.plain(await operations.run(op, args)) as R };
  }

  status(): LiveStatus {
    return { extension: true };
  }

  private static plain(value: unknown): unknown {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? Number(item) : item)));
  }
}
