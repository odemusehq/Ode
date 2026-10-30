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

export class RequestIdentityError extends Error {}

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
    return (await this.beginOnce(request)).id;
  }

  /** The same accepted request never starts twice, including after a lost HTTP acknowledgement or restart. */
  async beginOnce(request: string, requestId: string = randomUUID()): Promise<{ id: string; created: boolean }> {
    let created = false;
    await this.file.update((entries) => {
      const existing = entries.find((entry) => entry.id === requestId);
      if (existing) {
        if (existing.request !== request) throw new RequestIdentityError("This request id already belongs to different words. Send the edited request with a new id.");
        return entries;
      }
      created = true;
      return [...entries, { id: requestId, request, reply: "", at: new Date().toISOString(), status: "running" }];
    });
    return { id: requestId, created };
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
  private readonly logs = new Map<string, ConversationLog>();

  constructor(private readonly folder: string, private readonly keep: number) {}
  log(key: string): ConversationLog {
    const id = createHash("sha256").update(key).digest("hex").slice(0, 32);
    const log = this.logs.get(id) ?? new ConversationLog(id, new JsonFile(join(this.folder, `${id}.json`), z.array(ExchangeSchema), () => []), this.keep);
    this.logs.set(id, log);
    return log;
  }
}
