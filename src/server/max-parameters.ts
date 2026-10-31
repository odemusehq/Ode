import { randomUUID } from "node:crypto";
import { z } from "zod";
import { t } from "../shared/i18n";
import { MAX_PARAMETERS, type MaxParameterAddress, type MaxParameterCommand, type MaxParameterMessage, type MaxParameterReading, type MaxParameters, type MaxParameterWrite } from "../shared/max-parameters";
import { MaxWindowError, type MaxWindowBridge } from "./max-window";

const text = z.string().min(1).max(1024);
const addressSchema = z.object({ path: text, guards: z.array(z.object({ path: text, name: z.string().max(512).optional() }).strict()).min(1).max(64) }).strict();
const reading = z.object({ token: text, path: text, name: z.string().max(512), rawValue: z.number(), displayValue: z.number().nullable(),
  formattedValue: z.string().max(1024).nullable(), isEnabled: z.boolean().nullable(), state: z.number().int().nullable(), automationState: z.number().int().nullable() }).strict();
const messageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("read"), id: z.uuid(), result: reading }).strict(),
  z.object({ kind: z.literal("set"), id: z.uuid(), result: z.object({ before: reading, after: reading }).strict() }).strict(),
  z.object({ kind: z.literal("error"), id: z.uuid(), error: z.string().min(1).max(1024) }).strict(),
]);

interface Pending {
  command: MaxParameterCommand;
  resolve: (value: MaxParameterReading | MaxParameterWrite) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort?: () => void;
  session?: string;
}

/** A bounded queue over the paired Max session; the device owns native identities and stale-read guards. */
export class MaxParameterControl implements MaxParameters {
  private readonly pending = new Map<string, Pending>();
  private readonly completed = new Map<string, { session: string; message: string }>();

  constructor(private readonly window: MaxWindowBridge) { window.attachParameters(this); }

  async read(address: MaxParameterAddress, scope: string, signal?: AbortSignal): Promise<MaxParameterReading> {
    return this.queue({ kind: "read", id: randomUUID(), scope, address: addressSchema.parse(address) }, signal) as Promise<MaxParameterReading>;
  }

  async set(address: MaxParameterAddress, scope: string, token: string, value: number, allowAutomationOverride: boolean, signal?: AbortSignal): Promise<MaxParameterWrite> {
    z.number().parse(value);
    return this.queue({ kind: "set", id: randomUUID(), scope, address: addressSchema.parse(address), token: text.parse(token), value, allowAutomationOverride }, signal) as Promise<MaxParameterWrite>;
  }

  poll(session: string): MaxParameterCommand | null {
    const job = this.pending.values().next().value;
    if (!job) return null;
    job.session = session;
    return job.command;
  }

  receive(session: string, input: unknown): void {
    this.window.verifySession(session);
    const parsed = messageSchema.safeParse(input);
    const inputId = input && typeof input === "object" && "id" in input ? input.id : undefined;
    if (!parsed.success) {
      if (typeof inputId === "string") this.fail(this.pending.get(inputId), new Error(t("maxParameters.invalid")));
      throw new MaxWindowError(t("maxParameters.invalid"));
    }
    const message: MaxParameterMessage = parsed.data;
    const repeated = this.completed.get(message.id);
    if (repeated?.session === session && repeated.message === JSON.stringify(message)) return;
    const job = this.pending.get(message.id);
    if (!job || job !== this.pending.values().next().value || job.session !== session) throw new MaxWindowError(t("maxParameters.expired"));
    if (message.kind === "error") {
      this.remember(session, message);
      this.fail(job, new Error(message.error));
      return;
    }
    const command = job.command;
    const result = message.kind === "read" ? message.result : message.result.after;
    const before = message.kind === "set" ? message.result.before : null;
    if (message.kind !== command.kind || result.path !== command.address.path || result.token !== command.id ||
      (before && (command.kind !== "set" || before.path !== command.address.path || before.token !== command.token))) {
      this.fail(job, new Error(t("maxParameters.invalid")));
      throw new MaxWindowError(t("maxParameters.invalid"));
    }
    this.remember(session, message);
    this.clear(job);
    job.resolve(message.result);
  }

  invalidate(): void {
    for (const job of [...this.pending.values()]) this.fail(job, new Error(t("maxParameters.disconnected")));
    this.completed.clear();
  }

  private queue(command: MaxParameterCommand, signal?: AbortSignal): Promise<MaxParameterReading | MaxParameterWrite> {
    signal?.throwIfAborted();
    if (!this.window.supportsParameters) throw new Error(t("maxParameters.unavailable"));
    if (!command.scope.trim()) throw new Error(t("maxParameters.requestRequired"));
    if (this.pending.size >= MAX_PARAMETERS.maxPending) throw new Error(t("maxParameters.busy"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(this.pending.get(command.id), new Error(t("maxParameters.timeout"))), MAX_PARAMETERS.timeoutMs);
      timer.unref?.();
      const job: Pending = { command, resolve, reject, timer, signal };
      this.pending.set(command.id, job);
      if (signal) {
        job.abort = () => this.fail(job, new Error(t("maxParameters.cancelled")));
        signal.addEventListener("abort", job.abort, { once: true });
        if (signal.aborted) job.abort();
      }
    });
  }

  private remember(session: string, message: MaxParameterMessage): void {
    this.completed.set(message.id, { session, message: JSON.stringify(message) });
    while (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value!);
  }

  private fail(job: Pending | undefined, error: Error): void { if (job) { this.clear(job); job.reject(error); } }
  private clear(job: Pending): void {
    clearTimeout(job.timer);
    if (job.abort) job.signal?.removeEventListener("abort", job.abort);
    this.pending.delete(job.command.id);
  }
}
