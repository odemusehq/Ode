import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ConversationLog } from "../mneme/conversations";
import type { PreferencesStore } from "../mneme/preferences";
import type { UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import type { AnyTool } from "../tools/define";
import type { OdeAgents } from "../agents/agents";
import { Decision, type Approvals } from "./approvals";
import { LoopEnd, type AgentLoop, type LoopEvents, type ToolGate } from "./loop";
import type { ToolLabels } from "./tool-labels";

/** One request to Ode: a typed line, a tapped suggestion or spoken words. */
export interface OdeRequest {
  text: string;
  /** Another take of Ode's last change: the Set has already been put back to the version before it. */
  again?: boolean;
  /** Why?: answer about the change with this version id in two or three sentences, changing nothing. */
  reply?: { versionId: string };
}

/** The server's work around each agent turn. */
export interface RequestLifecycle {
  /** Before the turn: reads the Set, saves the hand edits and builds the hidden context. Throws when the Set can't be read. */
  prepare(request: OdeRequest): Promise<{ hiddenContext: string }>;
  /**
   * After the turn: saves Ode's change as a version, shows the result line and plays the change (aborted: the musician
   * pressed Stop, so the change is saved but not played). A reply only shows its answer.
   */
  finish(request: OdeRequest, reply: string, aborted: boolean): Promise<void>;
}

/** Questions waiting for the musician; they end without an answer when the musician presses Stop. */
export interface OpenQuestions {
  cancelAll(): void;
}

/** Deletions a restore couldn't undo; they wait for Apply in every mode. */
export interface DeletionCheck {
  /** True when the call deletes a device or a track that a restore can't add back, or when what it deletes can't be found. */
  cantBeUndone(tool: string, input: unknown): boolean;
}

export interface SessionDeps {
  loop: AgentLoop;
  agents: OdeAgents;
  labels: ToolLabels;
  approvals: Approvals;
  questions: OpenQuestions;
  prefs: PreferencesStore;
  requests: RequestLifecycle;
  deletions: DeletionCheck;
  emit: (event: UiEvent) => void;
}

/** Ode is already working, so Undo, Again and restores can't run until it has finished. */
export class SessionBusyError extends Error {}

/** Tools that always wait for the musician, in every mode: using the singer's voice needs their consent. */
const CONSENT_TOOLS: ReadonlySet<string> = new Set(["voice_reference_set"]);

/** Why each early end of a request is shown to the musician. */
const LIMIT_MESSAGES: Partial<Record<LoopEnd, string>> = {
  [LoopEnd.TurnLimit]: "Ode stopped: this request reached its limit of model calls. What it changed so far is saved.",
  [LoopEnd.TokenLimit]: "Ode stopped: this request reached its limit of tokens. What it changed so far is saved.",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The conversation about one song. Each request runs as one agent loop that carries on the song's recent exchanges. */
export class OdeSession {
  private readonly waiting: OdeRequest[] = [];
  /** Stops the agent loop of the request that runs now. */
  private controller: AbortController | null = null;
  /** Tells exclusive work that the musician pressed Stop (Again then doesn't start its retake). */
  private exclusiveController: AbortController | null = null;
  /** The request whose agent loop runs now. */
  private running: OdeRequest | null = null;
  /** Requests are being taken from the queue one after another. */
  private draining = false;
  /** Exclusive work on the Set is running; requests wait for it. */
  private working = false;
  /** What the UI was last told. */
  private shown = { busy: false, stoppable: false };

  constructor(
    private readonly deps: SessionDeps,
    private conversation: ConversationLog,
  ) {}

  /** Carries this conversation on under another log (the Set was saved for the first time or under a new name). */
  continueIn(conversation: ConversationLog): void {
    this.conversation = conversation;
  }

  /** A request or other work on the Set is running. */
  get isBusy(): boolean {
    return this.draining || this.working;
  }

  /** Stop can interrupt what runs now: an agent request, not exclusive work such as Undo or a restore. */
  get isStoppable(): boolean {
    return this.draining && !this.working;
  }

  async send(request: OdeRequest): Promise<void> {
    this.waiting.push(request);
    await this.drain();
  }

  /** Runs this request before any other waiting one (used by Again, from inside exclusive work). */
  sendFirst(request: OdeRequest): void {
    this.waiting.unshift(request);
    void this.drain();
  }

  /**
   * Runs work on the Set while no request runs (a restore, Undo, or putting the Set back for Again).
   * Requests sent meanwhile wait and run afterwards. Throws SessionBusyError while Ode is working.
   * The work runs to its end, and its signal tells it the musician pressed Stop meanwhile.
   */
  async exclusive<T>(work: (stopped: AbortSignal) => Promise<T>): Promise<T> {
    if (this.isBusy) throw new SessionBusyError("Ode is still working. Wait for it to finish, or press Stop.");
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

  stop(): void {
    this.waiting.length = 0;
    this.deps.approvals.denyAll();
    this.deps.questions.cancelAll();
    this.controller?.abort();
    this.exclusiveController?.abort();
  }

  /** Runs the waiting requests one at a time, whenever the session is free. */
  private async drain(): Promise<void> {
    if (this.draining || this.working || this.waiting.length === 0) return;
    this.draining = true;
    this.showBusy();
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
    this.deps.emit({ type: "message", role: "user", text: request.text });
    const controller = new AbortController();
    this.controller = controller;
    this.running = request;
    try {
      let hiddenContext: string;
      try {
        hiddenContext = (await this.deps.requests.prepare(request)).hiddenContext;
      } catch (error) {
        this.deps.emit({ type: "error", message: errorText(error) });
        return;
      }
      let reply = "";
      let tokens = 0;
      if (!controller.signal.aborted) {
        try {
          const result = await this.deps.loop.run({
            agent: "main",
            system: await this.deps.agents.systemPrompt(),
            history: await this.history(),
            prompt: `${hiddenContext}\n\n${request.text}`,
            conversation: this.conversation.id,
            depth: 0,
            gate: this.gate,
            events: this.events,
            signal: controller.signal,
          });
          reply = result.reply;
          tokens = result.tokens;
          const limit = LIMIT_MESSAGES[result.end];
          if (limit) this.deps.emit({ type: "error", message: limit });
          if (result.end === LoopEnd.Reply) await this.conversation.add(request.text, reply);
        } catch (error) {
          if (!controller.signal.aborted) this.deps.emit({ type: "error", message: errorText(error) });
        }
      }
      try {
        await this.deps.requests.finish(request, reply, controller.signal.aborted);
      } catch (error) {
        this.deps.emit({ type: "error", message: errorText(error) });
      }
      this.deps.emit({ type: "done", tokens });
    } finally {
      this.controller = null;
      this.running = null;
    }
  }

  /** The song's recent requests and Ode's replies, as the conversation so far. */
  private async history(): Promise<ChatCompletionMessageParam[]> {
    return (await this.conversation.recent()).flatMap((exchange): ChatCompletionMessageParam[] => [
      { role: "user", content: exchange.request },
      { role: "assistant", content: exchange.reply },
    ]);
  }

  /**
   * Whether a call runs now. Why? answers only explain; a change that needs the musician's Apply waits for it.
   */
  private readonly gate: ToolGate = {
    check: async (tool, input, signal) => {
      if (this.running?.reply && tool.changes !== "none") return "This request only answers Why?: explain, and leave the Set as it is.";
      if (!(await this.needsApproval(tool, input))) return null;
      const decision = await this.deps.approvals.request(tool.name, input, this.deps.labels.for(tool.name, input), signal);
      return decision === Decision.Allow ? null : "The musician skipped this change.";
    },
  };

  /** Ode's work as the UI shows it: the excerpt of its thinking, a progress line per tool, and subagents. */
  private readonly events: LoopEvents = {
    thought: (text) => this.deps.emit({ type: "thought", text }),
    toolStarted: (id, name, label) => {
      this.deps.emit({ type: "tool", id, name, status: "started" });
      this.deps.emit({ type: "progress", text: label });
    },
    toolFinished: (id, ok) => this.deps.emit({ type: "tool", id, name: "", status: ok ? "done" : "error" }),
    subagentStarted: (id, task) => {
      this.deps.emit({ type: "subagent", id, task, status: "started" });
      this.deps.emit({ type: "progress", text: task });
    },
    subagentFinished: (id) => this.deps.emit({ type: "subagent", id, task: "", status: "done" }),
  };

  /**
   * Using the singer's voice always waits for their consent; so does deleting a device or a track that a restore
   * can't add back, in every mode. In Manual, every change waits.
   */
  private async needsApproval(tool: AnyTool, input: Record<string, unknown>): Promise<boolean> {
    if (CONSENT_TOOLS.has(tool.name)) return true;
    if (tool.changes === "none") return false;
    if (this.deps.deletions.cantBeUndone(tool.name, input)) return true;
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
}
