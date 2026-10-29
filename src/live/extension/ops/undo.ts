import { describeError } from "../errors";
import type { Live } from "../sdk";
import { GroupedFollowUps } from "./follow-ups";
import {
  operationsByName,
  type AnyOperation,
  type FollowUps,
  type OpArgs,
  type OpRun,
  type OperationTable,
  type RegularOp,
  type Run,
} from "./operation";

type Call = OpArgs<"apply_as_one_undo_step">["calls"][number];

/** apply_as_one_undo_step: several operations as one undo step in Live. */
export class UndoOperations {
  private readonly operations: ReadonlyMap<string, AnyOperation>;

  constructor(
    private readonly live: Live,
    operations: OperationTable<RegularOp>,
  ) {
    this.operations = operationsByName(operations);
  }

  table(): OperationTable<"apply_as_one_undo_step"> {
    return {
      apply_as_one_undo_step: { prepare: (args) => this.applyAsOneUndoStep(args) },
    };
  }

  /**
   * Every call's references are looked up before anything changes: if one fails, the Set stays as it is,
   * and each call refers only to what existed before the step.
   */
  private applyAsOneUndoStep({ calls }: OpArgs<"apply_as_one_undo_step">): OpRun<"apply_as_one_undo_step"> {
    if (!Array.isArray(calls) || calls.length === 0) throw new Error("apply_as_one_undo_step needs at least one call");
    const followUps = new GroupedFollowUps(this.live);
    const runs = calls.map((call, index) => this.prepareCall(call, index, followUps));
    return async () => {
      const settled = this.live.withinTransaction(() => Promise.allSettled(runs.map((run) => run())));
      await followUps.flush();
      const outcomes = await settled;
      const applied = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome.status === "rejected") {
          throw new Error(
            `${UndoOperations.label(calls[index], index)}: ${describeError(outcome.reason)}. ${applied} of ${calls.length} calls were applied.`,
          );
        }
      }
      return { results: outcomes.map((outcome) => (outcome.status === "fulfilled" ? outcome.value : undefined)) };
    };
  }

  private prepareCall(call: Call, index: number, followUps: FollowUps): Run<unknown> {
    if (typeof call !== "object" || call === null) throw new TypeError(`call ${index + 1} must be an operation. The Set is unchanged.`);
    const label = UndoOperations.label(call, index);
    if (call.op === "apply_as_one_undo_step") {
      throw new Error(`${label}: apply_as_one_undo_step holds only other operations. The Set is unchanged.`);
    }
    const operation = this.operations.get(call.op);
    if (!operation) throw new Error(`${label}: unknown operation. The Set is unchanged.`);
    try {
      return operation.prepare(call.args ?? {}, followUps);
    } catch (error) {
      throw new Error(`${label}: ${describeError(error)}. The Set is unchanged.`);
    }
  }

  private static label(call: Call | undefined, index: number): string {
    return call?.op ? `call ${index + 1} (${call.op})` : `call ${index + 1}`;
  }
}
