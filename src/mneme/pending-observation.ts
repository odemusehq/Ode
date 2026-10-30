import { join } from "node:path";
import { z } from "zod";
import { JsonFile } from "./json-file";

const Schema = z.object({ requests: z.array(z.string()), at: z.string() }).nullable();
export type PendingObservation = z.infer<typeof Schema>;
const files = new Map<string, JsonFile<PendingObservation>>();

/** All request/recovery writers share the same queue for this song's uncertain interval. */
export function pendingObservationFile(dir: string): JsonFile<PendingObservation> {
  const file = files.get(dir) ?? new JsonFile(join(dir, "pending-observation.json"), Schema, () => null);
  files.set(dir, file);
  return file;
}

export function markPendingObservation(dir: string, requests: readonly string[]): Promise<PendingObservation> {
  return pendingObservationFile(dir).update((pending) => ({ requests: [...new Set([...(pending?.requests ?? []), ...requests])], at: pending?.at ?? new Date().toISOString() }));
}
