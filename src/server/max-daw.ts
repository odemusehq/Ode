import { randomUUID } from "node:crypto";
import { z } from "zod";
import { t } from "../shared/i18n";
import { DAW_OPERATIONS, MAX_DAW, type DawOperation, type MaxDawAddress, type MaxDaw, type MaxDawCommand, type MaxDawMessage } from "../shared/max-daw";
import { MaxWindowError, type MaxWindowBridge } from "./max-window";

const messageSchema = z.discriminatedUnion("ok", [
  z.object({ id: z.uuid(), ok: z.literal(true), result: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ id: z.uuid(), ok: z.literal(false), error: z.string().min(1).max(2048) }).strict(),
]);
interface Pending {
  command: MaxDawCommand;
  session?: string;
  resolve(value: Record<string, unknown>): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort?: () => void;
}

/** Commands travel only over the paired device session, with bounded replies and cancellation. */
export class MaxDawControl implements MaxDaw {
  private readonly pending = new Map<string, Pending>();
  private readonly completed = new Map<string, { session: string; message: string }>();
  constructor(private readonly window: MaxWindowBridge) { window.attachDaw(this); }

  async run(op: DawOperation, address: MaxDawAddress | null, args: Record<string, unknown>, scope: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    signal?.throwIfAborted();
    if (!this.window.supportsDaw) throw new Error(t("maxDaw.unavailable"));
    if ((op === "midi_notes_read" || op === "midi_notes_modify") && !this.window.supportsDawNoteEdits) throw new Error(t("maxDaw.unavailable"));
    if (!DAW_OPERATIONS.includes(op) || !scope.trim()) throw new Error(t("maxDaw.invalid"));
    if (this.pending.size >= MAX_DAW.maxPending) throw new Error(t("maxDaw.busy"));
    const command = { id: randomUUID(), op, address, args, scope, expiresAt: Date.now() + MAX_DAW.timeoutMs };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(this.pending.get(command.id), new Error(t("maxDaw.timeout"))), MAX_DAW.timeoutMs);
      timer.unref?.();
      const job: Pending = { command, resolve, reject, timer, signal };
      this.pending.set(command.id, job);
      if (signal) {
        job.abort = () => this.fail(job, new Error(t("maxDaw.cancelled")));
        signal.addEventListener("abort", job.abort, { once: true });
        if (signal.aborted) job.abort();
      }
    });
  }

  poll(session: string): MaxDawCommand | null {
    const job = this.pending.values().next().value;
    if (!job) return null;
    job.session = session;
    return job.command;
  }

  receive(session: string, input: unknown): void {
    this.window.verifySession(session);
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) throw new MaxWindowError(t("maxDaw.invalid"));
    const message: MaxDawMessage = parsed.data;
    const repeated = this.completed.get(message.id);
    if (repeated?.session === session && repeated.message === JSON.stringify(message)) return;
    const job = this.pending.get(message.id);
    if (!job || job !== this.pending.values().next().value || job.session !== session) throw new MaxWindowError(t("maxDaw.expired"));
    this.completed.set(message.id, { session, message: JSON.stringify(message) });
    while (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value!);
    this.clear(job);
    if (message.ok) job.resolve(message.result);
    else job.reject(new Error(message.error));
  }

  invalidate(): void {
    for (const job of [...this.pending.values()]) this.fail(job, new Error(t("maxDaw.disconnected")));
    this.completed.clear();
  }
  private fail(job: Pending | undefined, error: Error): void { if (job) { this.clear(job); job.reject(error); } }
  private clear(job: Pending): void {
    clearTimeout(job.timer);
    if (job.abort) job.signal?.removeEventListener("abort", job.abort);
    this.pending.delete(job.command.id);
  }
}
