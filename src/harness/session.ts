import { t } from "../shared/i18n";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { MutationReceipt } from "../shared/mutation-receipt";
import type { ProductionTaskStore } from "../mneme/production-task";
import type { ConversationLog } from "../mneme/conversations";
import type { PreferencesStore } from "../mneme/preferences";
import type { ConversationActivity } from "../shared/conversation";
import type { UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import type { AnyTool, SetReader } from "../tools/define";
import type { OdeAgents } from "../agents/agents";
import { ProductionRun } from "./production-run";
import { Decision, type Approvals } from "./approvals";
import { LoopEnd, type AgentLoop, type LoopEvents, type ToolGate } from "./loop";
import type { ToolLabels } from "./tool-labels";

/** One request to Ode: a typed line, a tapped suggestion or spoken words. */
export interface OdeRequest {
  requestId?: string;
  text: string;
  /** Another take of Ode's last change: the Set has already been put back to the version before it. */
  again?: boolean;
  /** The active task before a conversational correction interrupted it. */
  continuing?: string;
  exchangeId?: string;
  /** Why?: answer about the change with this version id in two or three sentences, leaving the Set as it is. */
  reply?: { versionId: string };
}

/** The server's work around each agent turn. */
export interface RequestLifecycle {
  /** Before the turn: reads the Set, saves the hand edits and builds the hidden context. Throws when the Set is unreadable. */
  recover?(interruptedRequests: readonly string[]): Promise<void>;
  prepare(request: OdeRequest): Promise<{ hiddenContext: string }>;
  /**
   * After the turn: saves Ode's change as a version and shows the result line. Stopped: the musician pressed Stop or
   * the request reached a limit, so the change is saved as cut short. A Why? reply shows only its answer.
   */
  finish(request: OdeRequest, reply: string, stopped: boolean, mutations?: number, receipts?: readonly MutationReceipt[]): Promise<void | { versionId: string | null }>;
}

/** Questions waiting for the musician; they end without an answer when the musician presses Stop. */
export interface OpenQuestions {
  cancelAll(): void;
  reply?(text: string): boolean;
}

/** Deletions beyond a restore's reach; they wait for Apply in every mode. */
export interface DeletionCheck {
  /** True when the call deletes a device or a track that only the musician can add back, or when the target of the deletion is missing. */
  cantBeUndone(tool: string, input: unknown): Promise<boolean>;
}

export interface SessionDeps {
  loop: AgentLoop;
  agents: OdeAgents;
  labels: ToolLabels;
  approvals: Approvals;
  questions: OpenQuestions;
  prefs: PreferencesStore;
  requests: RequestLifecycle;
  production?: Pick<ProductionTaskStore, "read" | "interrupt" | "recover">;
  deletions: DeletionCheck;
  /** Read again before a change waits for Apply, so its card names what the change touches now. */
  snapshots: SetReader;
  emit: (event: UiEvent) => void;
}

/** Ode is already working, so Undo, Again and restores are refused until it has finished. */
export class SessionBusyError extends Error {}

/** Why each early end of a request is shown to the musician. */
const LIMIT_MESSAGES: Partial<Record<LoopEnd, string>> = {
  [LoopEnd.TurnLimit]: t("runtime.modelCallLimit"),
  [LoopEnd.TokenLimit]: t("runtime.tokenLimit"),
  [LoopEnd.EmptyReply]: t("runtime.emptyReply"),
};

/** Ends that cut the work short, so the request is saved the way a Stop saves it. */
const CUT_SHORT: ReadonlySet<LoopEnd> = new Set([LoopEnd.TurnLimit, LoopEnd.TokenLimit]);

/** The conversation about one song. Each request runs as one agent loop that carries on the song's recent exchanges. */
export class OdeSession {
  private readonly waiting: OdeRequest[] = [];
  /** Stops the agent loop of the request that runs now. */
  private controller: AbortController | null = null;
  /** Tells exclusive work that the musician pressed Stop (Again then skips its retake). */
  private exclusiveController: AbortController | null = null;
  /** The request whose agent loop runs now. */
  private running: OdeRequest | null = null;
  /** Requests are being taken from the queue one after another. */
  private draining = false;
  private accepting = 0;
  private stopEpoch = 0;
  private readonly cancelledRequests = new Set<string>();
  private retired = false;
  private activity: ConversationActivity[] = [];
  private rationale = "";
  private acceptance: Promise<unknown> = Promise.resolve();
  private drained: Promise<void> = Promise.resolve();
  /** Exclusive work on the Set is running; requests wait for it. */
  private working = false;
  /** What the UI was last told. */
  private shown = { busy: false, stoppable: false };

  constructor(
    private readonly deps: SessionDeps,
    private readonly conversation: ConversationLog,
    readonly songId = conversation.id,
  ) {}

  /** A request or other work on the Set is running. */
  get isBusy(): boolean {
    return this.draining || this.working || this.accepting > 0;
  }

  /** Stop can interrupt what runs now: only an agent request; exclusive work such as Undo or a restore runs to the end. */
  get isStoppable(): boolean {
    return this.draining && !this.working;
  }

  /** Persist acceptance before replying to HTTP; execution continues independently. */
  async accept(request: OdeRequest): Promise<void> {
    if (this.retired) throw new SessionBusyError(t("runtime.thatSongIsNoLongerActiveSendThe"));
    const epoch = this.stopEpoch;
    this.accepting += 1;
    this.showBusy();
    const accepted = this.acceptance.then(async () => {
      const accepted = await this.conversation.beginOnce(request.text, request.requestId);
      const exchangeId = accepted.id;
      if (!accepted.created) { await this.publishConversation(); return; }
      if (epoch !== this.stopEpoch || (request.requestId && this.cancelledRequests.has(request.requestId))) {
        await this.conversation.finish(exchangeId, t("runtime.stoppedBeforeStarting"), "stopped");
        await this.publishConversation();
        return;
      }
      this.deps.emit({ type: "message", role: "user", text: request.text, id: exchangeId });
      if (this.deps.questions.reply?.(request.text)) {
        await this.conversation.finish(exchangeId, "", "complete");
        await this.publishConversation();
        return;
      }
      const next = { ...request, exchangeId };
      if (this.running && !request.reply) {
        next.continuing = this.running.continuing ?? this.running.text;
        for (let index = this.waiting.length - 1; index >= 0; index--) {
          const earlier = this.waiting[index]!;
          if (earlier.reply) continue;
          this.waiting.splice(index, 1);
          next.continuing += `\nEarlier message: ${earlier.text}`;
          if (earlier.exchangeId) await this.conversation.finish(earlier.exchangeId, t("runtime.continuedWithYourLaterMessage"), "stopped");
        }
        this.controller?.abort();
    if (!this.retired) void this.deps.production?.interrupt("The musician stopped Ode. Inspect any work already issued before continuing.").catch((error: unknown) => this.deps.emit({ type: "error", message: OdeSession.errorText(error) }));
        this.deps.approvals.denyAll();
        this.deps.questions.cancelAll();
        this.deps.emit({ type: "progress", text: t("runtime.updatingTheWorkWithYourMessage") });
      }
      if (epoch !== this.stopEpoch || (request.requestId && this.cancelledRequests.has(request.requestId))) {
        await this.conversation.finish(exchangeId, t("runtime.stoppedBeforeStarting"), "stopped");
      } else this.waiting.push(next);
      await this.publishConversation();
    });
    this.acceptance = accepted.catch(() => undefined);
    try { await accepted; }
    finally {
      this.accepting -= 1;
      void this.drain().catch((error: unknown) => this.deps.emit({ type: "error", message: OdeSession.errorText(error) }));
      this.showBusy();
    }
  }

  async send(request: OdeRequest): Promise<void> {
    await this.accept(request);
    await this.drained;
  }

  transcript() {
    return this.conversation.all();
  }

  async recover(): Promise<void> {
    const interrupted = (await this.conversation.all()).filter((exchange) => exchange.status === "running");
    await this.deps.requests.recover?.(interrupted.map((exchange) => exchange.request));
    await this.deps.production?.recover();
    await this.conversation.recover();
    await this.publishConversation();
  }

  private async publishConversation(): Promise<void> {
    const exchanges = await this.transcript();
    if (!this.retired) this.deps.emit({ type: "conversation", songId: this.songId, exchanges });
  }

  /** Late disk callbacks from a closed song must not replace the current conversation. */
  retire(): void {
    this.retired = true;
    this.stop();
  }

  /** Runs this request before any other waiting one (used by Again, from inside exclusive work). */
  sendFirst(request: OdeRequest): void {
    this.waiting.unshift(request);
    void this.drain();
  }

  /**
   * Runs work on the Set while the agent is idle (a restore, Undo, or putting the Set back for Again).
   * Requests sent meanwhile wait and run afterwards. Throws SessionBusyError while Ode is working.
   * The work runs to its end, and its signal tells it the musician pressed Stop meanwhile.
   */
  async exclusive<T>(work: (stopped: AbortSignal) => Promise<T>): Promise<T> {
    if (this.isBusy) throw new SessionBusyError(t("runtime.odeIsStillWorkingWaitForItTo"));
    const controller = new AbortController();
    this.exclusiveController = controller;
    this.working = true;
    this.showBusy();
    try {
      return await work(controller.signal);
    } finally {
      this.working = false;
      this.exclusiveController = null;
      void this.drain();
      this.showBusy();
    }
  }

  stop(requestIds: readonly string[] = []): void {
    for (const id of requestIds) this.cancelledRequests.add(id);
    while (this.cancelledRequests.size > 256) this.cancelledRequests.delete(this.cancelledRequests.values().next().value!);
    this.stopEpoch += 1;
    for (const request of this.waiting.splice(0)) {
      if (request.exchangeId) void this.conversation.finish(request.exchangeId, t("runtime.stoppedBeforeStarting"), "stopped").then(() => this.publishConversation()).catch((error: unknown) => this.deps.emit({ type: "error", message: OdeSession.errorText(error) }));
    }
    this.deps.approvals.denyAll();
    this.deps.questions.cancelAll();
    // Only a running request can leave work half issued, so only then does the production task wait for inspection.
    const running = this.controller !== null;
    this.controller?.abort();
    if (running && !this.retired) void this.deps.production?.interrupt("The musician stopped Ode. Inspect any work already issued before continuing.").catch((error: unknown) => this.deps.emit({ type: "error", message: OdeSession.errorText(error) }));
    this.exclusiveController?.abort();
  }

  /** Runs the waiting requests one at a time, whenever the session is free. */
  private drain(): Promise<void> {
    if (this.draining) return this.drained;
    if (this.working || this.waiting.length === 0) return Promise.resolve();
    this.draining = true;
    this.showBusy();
    this.drained = this.runWaiting();
    return this.drained;
  }

  private async runWaiting(): Promise<void> {
    try {
      let request = this.waiting.shift();
      while (request !== undefined) {
        await this.runOnce(request);
        request = this.waiting.shift();
      }
    } finally {
      this.draining = false;
      this.showBusy();
    }
  }

  private async runOnce(request: OdeRequest): Promise<void> {

    const controller = new AbortController();
    this.controller = controller;
    this.running = request;
    const beganHere = request.exchangeId === undefined;
    const exchangeId = request.exchangeId ?? await this.conversation.begin(request.text);
    request.exchangeId = exchangeId;
    this.activity = [];
    this.rationale = "";
    let status: "complete" | "stopped" | "failed" = "failed";
    let savedReply = "";
    let mutations = 0;
    const receipts: MutationReceipt[] = [];
    const production = !request.reply && this.deps.production ? new ProductionRun(this.deps.production, exchangeId, request.text, controller.signal) : undefined;
    let versionId: string | null = null;
    try {
      if (beganHere) await this.publishConversation();
      let hiddenContext: string;
      try {
        hiddenContext = (await this.deps.requests.prepare(request)).hiddenContext;
      } catch (error) {
        savedReply = OdeSession.errorText(error);
        this.deps.emit({ type: "error", message: savedReply });
        return;
      }
      let reply = "";
      let tokens = 0;
      let cutShort = false;
      if (!controller.signal.aborted) {
        try {
          const result = await this.deps.loop.run({
            agent: "main",
            system: await this.deps.agents.systemPrompt(),
            history: await this.history(),
            prompt: `${hiddenContext}\n\n${request.continuing ? `Continue the task with the latest correction. Earlier work may have partially changed the Set; inspect it before editing. Original task: ${request.continuing}\nLatest message: ` : ""}${request.text}`,
            request: request.continuing ? `${request.continuing}\nLatest correction: ${request.text}` : request.text,
            conversation: this.conversation.id,
            depth: 0,
            gate: this.gate,
            events: this.events,
            signal: controller.signal,
            exchangeId,
            production,
            onMutation: () => { mutations += 1; },
            onReceipts: (saved) => { receipts.push(...saved); },
          });
          reply = result.reply;
          tokens = result.tokens;
          cutShort = CUT_SHORT.has(result.end);
          const limit = LIMIT_MESSAGES[result.end];
          if (limit) this.deps.emit({ type: "error", message: limit });
          status = result.end === LoopEnd.Reply ? "complete" : "stopped";
          savedReply = reply || limit || (controller.signal.aborted ? t("runtime.stoppedPendingWork") : t("runtime.incompleteAnswer"));
        } catch (error) {
          savedReply = OdeSession.errorText(error);
          if (!controller.signal.aborted) this.deps.emit({ type: "error", message: savedReply });
        }
      }
      try {
        const receipt = await this.deps.requests.finish(request, reply, controller.signal.aborted || cutShort || status === "failed", mutations, receipts);
        versionId = receipt?.versionId ?? null;
      } catch (error) {
        status = "failed";
        const message = t("runtime.couldNotRecordChanges", { error: OdeSession.errorText(error) });
        savedReply = [reply, message].filter(Boolean).join("\n\n");
        this.deps.emit({ type: "error", message });
      }
      this.deps.emit({ type: "done", tokens });
    } finally {
      if (controller.signal.aborted) status = "stopped";
      try {
        try { await production?.finish(status !== "complete"); }
        catch (error) {
          status = "failed";
          savedReply = [savedReply, t("runtime.couldNotSaveCheckpoint", { error: OdeSession.errorText(error) })].filter(Boolean).join("\n\n");
          this.deps.emit({ type: "error", message: OdeSession.errorText(error) });
        }
        await this.conversation.finish(exchangeId, savedReply || (status === "stopped" ? t("runtime.stopped") : t("runtime.theRequestFailedBeforeCompletion")), status, versionId);
        await this.publishConversation();
      } finally {
        this.controller = null;
        this.running = null;
      }
    }
  }

  /** The song's recent requests and Ode's replies, as the conversation so far. */
  private async history(): Promise<ChatCompletionMessageParam[]> {
    return (await this.conversation.recent()).flatMap((exchange): ChatCompletionMessageParam[] => [
      { role: "user", content: exchange.request },
      { role: "assistant", content: [exchange.reply || (exchange.status === "complete" ? "Understood." : "Interrupted; inspect the current Set before continuing."),
        ...(exchange.status === "stopped" || exchange.status === "failed" ? ["Saved activity (not proof of the current Set):", ...(exchange.activity ?? []).map((step) => `${step.status}: ${step.label}`)] : []),
      ].join("\n") },
    ]);
  }

  /**
   * Whether a call runs now. Why? answers only explain; a change that needs the musician's Apply waits for it.
   */
  private readonly gate: ToolGate = {
    check: async (tool, input, signal) => {
      if (this.running?.reply && tool.changes !== "none") return "This request only answers Why?: explain, and leave the Set as it is.";
      if (tool.name === "lead_sheet_update" && Array.isArray(input.locked)) {
        const requested = input.locked;
        const current = (await this.deps.snapshots.read()).sheet?.locked ?? [];
        const removed = current.filter((part) => !requested.includes(part));
        if (removed.length > 0) {
          const decision = await this.deps.approvals.request(tool.name, input, `Unlock ${removed.join(", ")} · ${this.deps.labels.for(tool.name, input)}`, signal);
          return decision === Decision.Allow ? null : "The musician kept the material locked.";
        }
      }
      if (!(await this.needsApproval(tool, input))) return null;
      await this.deps.snapshots.read().catch(() => undefined);
      const decision = await this.deps.approvals.request(tool.name, input, this.deps.labels.for(tool.name, input), signal);
      return decision === Decision.Allow ? null : "The musician skipped this change.";
    },
  };

  /** Ode's work as the UI shows it: the excerpt of its thinking, a progress line per tool, and subagents. */
  private readonly events: LoopEvents = {
    thought: (text) => {
      this.rationale = text.trim().slice(0, 400);
      this.checkpoint();
      this.deps.emit({ type: "thought", text });
    },
    toolStarted: (id, name, label) => {
      this.activity.push({ id, label, status: "running", ...(this.rationale ? { reason: this.rationale } : {}) });
      this.checkpoint();
      this.deps.emit({ type: "tool", id, name, status: "started", summary: label });
      this.deps.emit({ type: "progress", text: label });
    },
    toolFinished: (id, ok) => {
      this.activity = this.activity.map((step) => step.id === id ? { ...step, status: ok ? "done" : "error" } : step);
      this.checkpoint();
      this.deps.emit({ type: "tool", id, name: "", status: ok ? "done" : "error" });
    },
    subagentStarted: (id, task) => {
      this.activity.push({ id, label: task, status: "running" });
      this.checkpoint();
      this.deps.emit({ type: "subagent", id, task, status: "started" });
      this.deps.emit({ type: "progress", text: task });
    },
    subagentFinished: (id) => {
      this.activity = this.activity.map((step) => step.id === id ? { ...step, status: "done" } : step);
      this.checkpoint();
      this.deps.emit({ type: "subagent", id, task: "", status: "done" });
    },
  };

  /** Public activity doubles as a durable checkpoint when Live or the browser closes. */
  private checkpoint(): void {
    const id = this.running?.exchangeId;
    if (id) void this.conversation.checkpoint(id, this.activity, this.rationale).catch((error: unknown) => {
      this.deps.emit({ type: "error", message: t("runtime.couldNotSaveTheActivity", { error: OdeSession.errorText(error) }) });
    });
  }

  /**
   * Using the singer's voice always waits for their consent; so does deleting a device or a track that only the
   * musician can add back, in every mode. In Manual, musical changes wait; artist memory is maintained quietly.
   */
  private async needsApproval(tool: AnyTool, input: Record<string, unknown>): Promise<boolean> {
    if (tool.consent) return true;
    if (tool.changes === "memory" && tool.backgroundMemory) return false;
    if (tool.changes === "none" || tool.name === "production_task_update" || tool.name === "production_task_patch") return false;
    if (await this.deps.deletions.cantBeUndone(tool.name, input)) return true;
    return (await this.deps.prefs.mode()) === Mode.Manual;
  }

  /** Tells the UI when Ode starts or stops working, and whether Stop can interrupt it. */
  private showBusy(): void {
    const busy = this.isBusy;
    const stoppable = this.isStoppable;
    if (busy === this.shown.busy && stoppable === this.shown.stoppable) return;
    this.shown = { busy, stoppable };
    this.deps.emit({ type: "busy", busy, stoppable });
  }

  private static errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
