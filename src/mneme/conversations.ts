import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { ConversationActivity, ConversationExchange } from "../shared/conversation";
import { JsonFile } from "./json-file";

export const ExchangeSchema = z.object({
  id: z.string().optional(), request: z.string(), reply: z.string(), at: z.string(),
  activity: z.array(z.object({ id: z.string(), label: z.string(), status: z.enum(["running", "done", "error"]), reason: z.string().optional() })).optional(),
  rationale: z.string().optional(),
  versionId: z.string().nullable().optional(),
  status: z.enum(["running", "complete", "stopped", "failed"]).optional(),
});
export type Exchange = z.infer<typeof ExchangeSchema>;

/** The complete song conversation on disk, with a bounded window for the model. */
export class ConversationLog {
  constructor(readonly id: string, private readonly file: JsonFile<Exchange[]>, private readonly keep: number) {}

  async all(): Promise<ConversationExchange[]> {
    return (await this.file.read()).map((entry) => ({ ...entry,
      id: entry.id ?? createHash("sha256").update(entry.at + entry.request).digest("hex").slice(0, 24),
      status: entry.status ?? "complete",
    }));
  }

  async recent(): Promise<Exchange[]> {
    const exchanges = (await this.all()).filter((entry) => entry.status !== "running");
    return this.keep > 0 ? exchanges.slice(-this.keep) : [];
  }

  async begin(request: string): Promise<string> {
    const id = randomUUID();
    await this.file.update((entries) => [...entries, { id, request, reply: "", at: new Date().toISOString(), status: "running" }]);
    return id;
  }

  async finish(id: string, reply: string, status: ConversationExchange["status"], versionId?: string | null): Promise<void> {
    await this.file.update((entries) => entries.map((entry) => entry.id === id ? { ...entry, reply, status, ...(versionId === undefined ? {} : { versionId }),
      activity: entry.activity?.map((step) => step.status === "running" ? { ...step, status: "error" as const } : step) } : entry));
  }

  async checkpoint(id: string, activity: ConversationActivity[], rationale: string): Promise<void> {
    const saved = structuredClone(activity);
    await this.file.update((entries) => entries.map((entry) => entry.id === id ? { ...entry, activity: saved, rationale } : entry));
  }

  /** A process restart preserves interrupted work rather than silently resuming edits. */
  async recover(): Promise<void> {
    await this.file.update((entries) => entries.map((entry) => entry.status === "running"
      ? { ...entry, status: "stopped", reply: entry.reply || "Interrupted. Check the current Set before continuing.",
          activity: entry.activity?.map((step) => step.status === "running" ? { ...step, status: "error" as const } : step) } : entry));
  }

  async add(request: string, reply: string): Promise<void> {
    const id = await this.begin(request);
    await this.finish(id, reply, "complete");
  }
}

/** Every song keeps its own transcript; settings and artist memory are separate. */
export class ConversationStore {
  constructor(private readonly folder: string, private readonly keep: number) {}
  log(key: string): ConversationLog {
    const id = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return new ConversationLog(id, new JsonFile(join(this.folder, `${id}.json`), z.array(ExchangeSchema), () => []), this.keep);
  }
}
