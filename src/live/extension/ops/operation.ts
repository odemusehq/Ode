import type { ExtensionOp } from "../../../shared/live";
import type { ExtensionOpArgs, ExtensionOpResults } from "../../../shared/live-ops";

/** Starts an operation: its changes begin at once, and the promise brings its result. */
export type Run<R> = () => Promise<R>;

/** Changes that have to wait until Live has created an object, such as naming a new clip. */
export interface FollowUps {
  after<T, R>(started: Promise<T>, apply: (value: T) => R): Promise<R>;
}

export interface Operation<K extends ExtensionOp> {
  /** Looks up every reference and checks the arguments; the Set stays as it is until the run starts. */
  prepare(args: ExtensionOpArgs[K], followUps: FollowUps): Run<ExtensionOpResults[K]>;
}

/** An operation with its argument and result types set aside, for looking it up by name. */
export interface AnyOperation {
  prepare(args: unknown, followUps: FollowUps): Run<unknown>;
}

export type OperationTable<K extends ExtensionOp> = { readonly [P in K]: Operation<P> };

/** Every operation except apply_as_one_undo_step, which runs the others. */
export type RegularOp = Exclude<ExtensionOp, "apply_as_one_undo_step">;

export type OpArgs<K extends ExtensionOp> = ExtensionOpArgs[K];
export type OpRun<K extends ExtensionOp> = Run<ExtensionOpResults[K]>;

/** The operations of a table, by name. */
export function operationsByName(table: Readonly<Record<string, AnyOperation>>): ReadonlyMap<string, AnyOperation> {
  return new Map(Object.entries(table));
}
