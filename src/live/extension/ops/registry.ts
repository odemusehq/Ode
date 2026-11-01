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
  run(op: string, args: unknown, signal?: AbortSignal): Promise<unknown> {
    const next = this.queue.then(async () => {
      signal?.throwIfAborted();
      await this.confirmHost(signal);
      signal?.throwIfAborted();
      const result = await this.prepare(op, args, new DirectFollowUps(this.live))();
      await this.confirmHost(signal);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Cached SDK properties can outlive Live. A callback-based native read must answer before and after work. */
  private async confirmHost(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(2_000);
    const stopped = signal ? AbortSignal.any([signal, timeout]) : timeout;
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal?.aborted ? signal.reason : new Error("Live did not confirm its connection. Reconnect and inspect the Set before continuing; any issued edit is unconfirmed."));
      stopped.addEventListener("abort", abort, { once: true });
      const finish = (error?: unknown) => {
        stopped.removeEventListener("abort", abort);
        if (stopped.aborted) abort();
        else if (error) reject(error);
        else resolve();
      };
      try {
        this.live.application.song.mainTrack.mixer.volume.getValue().then(
          value => finish(Number.isFinite(value) ? undefined : new Error("Live returned no valid connection response.")), finish);
      } catch (error) { finish(error); }
    });
  }
}
