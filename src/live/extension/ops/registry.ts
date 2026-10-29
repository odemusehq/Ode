import type { ExtensionOp } from "../../../shared/live";
import type { Live } from "../sdk";
import { DirectFollowUps } from "./follow-ups";
import { operationsByName, type AnyOperation, type FollowUps, type OperationTable, type Run } from "./operation";

/** Every operation Ode runs on the Set, by name, one at a time. */
export class OperationRegistry {
  private readonly operations: ReadonlyMap<string, AnyOperation>;
  /** The operation running now: the next one looks up its references once this one has settled. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly live: Live,
    table: OperationTable<ExtensionOp>,
  ) {
    this.operations = operationsByName(table);
  }

  /** Looks up the operation and everything it refers to; the Set stays as it is until the run starts. */
  prepare(op: string, args: unknown, followUps: FollowUps): Run<unknown> {
    const operation = this.operations.get(op);
    if (!operation) throw new Error(`unknown operation "${op}"`);
    return operation.prepare(args ?? {}, followUps);
  }

  /** Runs the operation once every operation before it has settled, so its references point where the Set is now. */
  run(op: string, args: unknown): Promise<unknown> {
    const next = this.queue.then(() => this.prepare(op, args, new DirectFollowUps(this.live))());
    this.queue = next.catch(() => undefined);
    return next;
  }
}
