import type { ExtensionOp, LiveRequest, LiveResponse } from "../../../shared/live";
import { describeError } from "../errors";
import type { Live } from "../sdk";
import { DirectFollowUps } from "./follow-ups";
import { operationsByName, type AnyOperation, type FollowUps, type OperationKind, type OperationTable, type Run } from "./operation";

export interface PreparedOperation {
  readonly kind: OperationKind;
  readonly run: Run<unknown>;
}

/** Every operation Ode's server can ask the extension for, by name. */
export class OperationRegistry {
  private readonly operations: ReadonlyMap<string, AnyOperation>;

  constructor(
    private readonly live: Live,
    table: OperationTable<ExtensionOp>,
  ) {
    this.operations = operationsByName(table);
  }

  kindOf(op: string): OperationKind | undefined {
    return this.operations.get(op)?.kind;
  }

  /** Looks up the operation and everything it refers to, without changing the Set. */
  prepare(op: string, args: unknown, followUps: FollowUps): PreparedOperation {
    const operation = this.operations.get(op);
    if (!operation) throw new Error(`unknown operation "${op}"`);
    return { kind: operation.kind, run: operation.prepare(args ?? {}, followUps) };
  }

  async run(op: string, args: unknown): Promise<unknown> {
    return this.prepare(op, args, new DirectFollowUps(this.live)).run();
  }

  respond(request: LiveRequest): Promise<LiveResponse> {
    return OperationRegistry.response(request.id, this.run(request.op, request.args));
  }

  /** The answer to a request: its result, or its error in words. */
  static async response(id: string, result: Promise<unknown>): Promise<LiveResponse> {
    try {
      return { id, ok: true, result: await result };
    } catch (error) {
      return { id, ok: false, error: describeError(error) };
    }
  }
}
