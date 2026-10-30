import type { ProductionTaskStore } from "../mneme/production-task";

/** Execution intent belongs to one live request, never to a saved plan or a restarted session. */
export class ProductionRun {
  private taskId: string | null = null;
  private reminded = false;
  private intentEpoch = 0;

  constructor(
    private readonly tasks: Pick<ProductionTaskStore, "read" | "interrupt">,
    private readonly exchangeId: string,
    private readonly request: string,
    private readonly signal: AbortSignal,
  ) {}

  async execute(taskId: string, quote: string): Promise<string> {
    this.signal.throwIfAborted();
    const epoch = this.intentEpoch;
    // The quote identifies the source request; interpreting its intention is still the agent's responsibility.
    if (!quote.trim() || quote.trim() !== this.request.trim()) return "Quote the full current musician request exactly. A saved goal is not a new request to execute it.";
    const task = await this.tasks.read();
    if (!task || task.id !== taskId || !task.exchangeIds.includes(this.exchangeId)) return "Read and reconcile the current task, linking it to this exchange before executing it.";
    if (task.status !== "working" || task.blocker || task.steps.some((step) => step.status === "blocked" || step.status === "needs-inspection")) return "The task needs inspection, a working step or a blocker resolved before it can continue.";
    this.signal.throwIfAborted();
    if (epoch !== this.intentEpoch) return "Control returned to the musician while this declaration was being checked. Reconcile their answer before continuing.";
    this.taskId = task.id;
    return "Continue the current musician-authorised task within this request's existing limits. A reply may receive one reminder to finish remaining work or record its concrete blocker. This intent ends with this request.";
  }

  /** Questions hand control back to the musician; the next action must interpret their answer again. */
  pause(): void { this.intentEpoch++; this.taskId = null; }

  async afterReply(): Promise<string | null> {
    if (!this.taskId || this.reminded || this.signal.aborted) return null;
    const task = await this.tasks.read();
    if (this.signal.aborted || !task || task.id !== this.taskId || task.status !== "working" || task.blocker ||
      task.steps.some((step) => step.status === "blocked" || step.status === "needs-inspection")) return null;
    this.reminded = true;
    const remaining = task.steps.filter((step) => step.status !== "complete").map((step) => ({ action: step.action, targetTags: step.targetTags, status: step.status }));
    return `The current request asked you to execute this production goal. The saved task still has unfinished work: ${JSON.stringify(remaining)}. Continue the authorised work within the same budget, or record the concrete blocker/required musician action and give an honest partial result. Do not claim the song is finished from a plan or a successful write alone. This is the only continuation reminder for this request.`;
  }

  async finish(interrupted = false): Promise<void> {
    const task = await this.tasks.read();
    if (task && (task.id === this.taskId || task.exchangeIds.includes(this.exchangeId)) &&
      (task.status === "working" || (interrupted || this.taskId !== null) && task.status === "planned")) {
      await this.tasks.interrupt("This request ended with unfinished production work. Inspect the saved targets before continuing.");
    }
  }
}
