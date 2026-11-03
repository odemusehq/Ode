import type { ProductionTaskStore } from "../mneme/production-task";

/** Execution intent belongs to one live request, never to a saved plan or a restarted session. */
export class ProductionRun {
  private taskId: string | null = null;
  private reviewedTools = -1;
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
    return "Continue the current musician-authorised task within this request's existing limits. Replies may receive bounded completion checks after new tool work. This intent ends with this request.";
  }

  /** Questions hand control back to the musician; the next action must interpret their answer again. */
  pause(): void { this.intentEpoch++; this.taskId = null; }

  async afterReply(toolUses = 0): Promise<string | null> {
    if (this.signal.aborted || toolUses <= this.reviewedTools || !toolUses && !this.taskId) return null;
    const task = this.taskId ? await this.tasks.read() : null;
    if (this.signal.aborted) return null;
    const unfinished = task?.id === this.taskId && task?.status === "working" && !task.blocker &&
      !task.steps.some((step) => step.status === "blocked" || step.status === "needs-inspection");
    if (!toolUses && !unfinished) return null;
    this.reviewedTools = toolUses;
    const remaining = unfinished ? task.steps.filter((step) => step.status !== "complete").map((step) => ({ action: step.action, targetTags: step.targetTags, status: step.status })) : [];
    return `Before finishing, review the current request against the actual work and tool results in this conversation. For an authorised action request, finish any remaining required work and checks within the same budget; a progress sentence promising the next action is not completion. If the request was a question, explanation or status check, answer it without starting unrequested edits. Earlier plans and this review are not new authorisation. If finished, give the result; do not invent extra work. If blocked, state the concrete blocker and preserve completed work. ${remaining.length ? `The declared current task has these unfinished steps: ${JSON.stringify(remaining)}. ` : ""}Do not replay completed edits. Give the actual final outcome rather than another promise to act.`;
  }

  async finish(interrupted = false): Promise<void> {
    const task = await this.tasks.read();
    if (task && (task.id === this.taskId || task.exchangeIds.includes(this.exchangeId)) &&
      (task.status === "working" || (interrupted || this.taskId !== null) && task.status === "planned")) {
      await this.tasks.interrupt("This request ended with unfinished production work. Inspect the saved targets before continuing.");
    }
  }
}
