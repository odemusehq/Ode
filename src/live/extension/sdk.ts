import type { DataModelObject, ExtensionContext } from "@ableton-extensions/sdk";
import { NotFoundError } from "./errors";

/** The Extensions API version Ode is written against. */
export const API_VERSION = "1.0.0";
export type Version = typeof API_VERSION;

/** What the SDK gives Ode when Live activates it. */
export type Live = ExtensionContext<Version>;

/** Whether two SDK objects stand for the same object in Live. */
export function sameObject(a: DataModelObject<Version>, b: DataModelObject<Version>): boolean {
  return a.handle.id === b.handle.id;
}

/** Position of `object` in `list`. A miss throws NotFoundError, since -1 already stands for a track's mixer. */
export function indexOfObject(list: readonly DataModelObject<Version>[], object: DataModelObject<Version>): number {
  const index = list.findIndex((item) => sameObject(item, object));
  if (index < 0) throw new NotFoundError("the object in its list, which changed while Ode looked");
  return index;
}
