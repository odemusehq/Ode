import type { DataModelObject, ExtensionContext } from "@ableton-extensions/sdk";

/** The Extensions API version Ode is written against. */
export const API_VERSION = "1.0.0";
export type Version = typeof API_VERSION;

/** What the SDK gives Ode when Live activates it. */
export type Live = ExtensionContext<Version>;

/** Whether two SDK objects stand for the same object in Live. */
export function sameObject(a: DataModelObject<Version>, b: DataModelObject<Version>): boolean {
  return a.handle.id === b.handle.id;
}

/** Position of `object` in `list`, or -1 when it is not there. */
export function indexOfObject(list: readonly DataModelObject<Version>[], object: DataModelObject<Version>): number {
  return list.findIndex((item) => sameObject(item, object));
}
