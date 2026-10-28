import { query, type CanUseTool, type Options, type PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { OdeConfig } from "../shared/config";
import type { UiEvent } from "../shared/events";
import { Mode } from "../shared/personalisation";
import type { PreferencesStore } from "../mneme/preferences";
import type { ToolRegistry } from "../tools";
import { OdeAgents } from "../agents/agents";
import { AgentEnvironment } from "./agent-environment";
import { Approvals, Decision } from "./approvals";
import { EventTranslator } from "./event-translator";
import type { Workspace } from "./workspace";

/** One request to Ode: a typed line, a tapped suggestion or spoken words. */
export interface OdeRequest {
  text: string;
  /** Another take of Ode's last change: the Set has already been put back to the version before it. */
  again?: boolean;
}

/** The server's work around each agent turn. */
export interface RequestLifecycle {
  /** Before the turn: reads the Set, saves the hand edits and builds the hidden context. Throws when the Set can't be read. */
  prepare(request: OdeRequest): Promise<{ hiddenContext: string }>;
  /** After the turn: saves Ode's change as a version, shows the result line and plays the change. */
  finish(request: OdeRequest, reply: string): Promise<void>;
}

/** Questions waiting for the musician; they end without an answer when the musician presses Stop. */
export interface OpenQuestions {
  cancelAll(): void;
}

export interface SessionDeps {
  config: OdeConfig;
  workspace: Workspace;
  registry: ToolRegistry;
  agents: OdeAgents;
  approvals: Approvals;
  questions: OpenQuestions;
  prefs: PreferencesStore;
  requests: RequestLifecycle;
  emit: (event: UiEvent) => void;
}

/** Ode is already working, so Undo, Again and restores can't run until it has finished. */
export class SessionBusyError extends Error {}

/** Tools that always wait for the musician, in every mode: using the singer's voice needs their consent. */
const CONSENT_TOOLS: ReadonlySet<string> = new Set(["voice_reference_set"]);

/** Built-in tools that run without asking. Reading files is checked: only Ode's own skill files. */
const UNCHECKED_BUILT_IN_TOOLS = OdeAgents.BUILT_IN_TOOLS.filter((name) => name !== "Read");

function allow(input: Record<string, unknown>): PermissionResult {
  return { behavior: "allow", updatedInput: input };
}

function deny(message: string): PermissionResult {
  return { behavior: "deny", message };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The conversation about one song. Each request runs as its own agent call that resumes the
 * song's saved conversation, so the spending cap applies per request.
 */
export class OdeSession {
  private readonly waiting: OdeRequest[] = [];
  private controller: AbortController | null = null;
  /** What the UI shows: a request or other work on the Set is running. */
  private busy = false;
  /** Requests are being taken from the queue one after another. */
  private draining = false;
  /** Exclusive work on the Set is running; requests wait for it. */
  private working = false;

  constructor(
    private readonly deps: SessionDeps,
    private sessionId: string | null,
    private onSessionId: (id: string) => void,
  ) {}

  /** Where to record this conversation's id from now on (used when an unsaved Set gets saved). */
  rekey(onSessionId: (id: string) => void): void {
    this.onSessionId = onSessionId;
  }

  get isBusy(): boolean {
    return this.busy || this.draining || this.working;
  }

  /** The agent runtime's id for this conversation, once it has started. */
  get id(): string | null {
    return this.sessionId;
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
   */
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.isBusy) throw new SessionBusyError("Ode is still working. Wait for it to finish, or press Stop.");
    this.working = true;
    this.setBusy(true);
    try {
      return await work();
    } finally {
      this.working = false;
      this.setBusy(false);
      void this.drain();
    }
  }

  stop(): void {
    this.waiting.length = 0;
    this.deps.approvals.denyAll();
    this.deps.questions.cancelAll();
    this.controller?.abort();
  }

  /** Runs the waiting requests one at a time; does nothing while requests or exclusive work already run. */
  private async drain(): Promise<void> {
    if (this.draining || this.working) return;
    this.draining = true;
    try {
      let request = this.waiting.shift();
      while (request !== undefined) {
        await this.runOnce(request);
        request = this.waiting.shift();
      }
    } finally {
      this.draining = false;
    }
  }

  private async runOnce(request: OdeRequest): Promise<void> {
    this.setBusy(true);
    this.deps.emit({ type: "message", role: "user", text: request.text });
    const controller = new AbortController();
    this.controller = controller;
    try {
      let hiddenContext: string;
      try {
        hiddenContext = (await this.deps.requests.prepare(request)).hiddenContext;
      } catch (error) {
        this.deps.emit({ type: "error", message: errorText(error) });
        return;
      }
      const translator = new EventTranslator(this.deps.registry);
      if (!controller.signal.aborted) await this.runAgent(`${hiddenContext}\n\n${request.text}`, translator, controller);
      try {
        await this.deps.requests.finish(request, controller.signal.aborted ? "" : translator.reply);
      } catch (error) {
        this.deps.emit({ type: "error", message: errorText(error) });
      }
      this.deps.emit({ type: "done", costUsd: translator.costUsd });
    } finally {
      this.controller = null;
      this.setBusy(false);
    }
  }

  private async runAgent(prompt: string, translator: EventTranslator, controller: AbortController): Promise<void> {
    try {
      const run = query({ prompt, options: await this.options(controller) });
      for await (const message of run) {
        if (message.type === "system" && message.subtype === "init" && message.session_id !== this.sessionId) {
          this.sessionId = message.session_id;
          this.onSessionId(message.session_id);
        }
        for (const event of translator.translate(message)) this.deps.emit(event);
      }
    } catch (error) {
      if (!controller.signal.aborted) this.deps.emit({ type: "error", message: errorText(error) });
    }
  }

  private async options(controller: AbortController): Promise<Options> {
    const { config, registry, agents, workspace } = this.deps;
    return {
      cwd: await workspace.prepare(),
      systemPrompt: await agents.systemPrompt(),
      agents: { [OdeAgents.SUBAGENT]: await agents.subagent() },
      mcpServers: registry.mcpServers(),
      tools: [...OdeAgents.BUILT_IN_TOOLS],
      allowedTools: [...registry.readOnlyNames(), ...UNCHECKED_BUILT_IN_TOOLS],
      settingSources: ["project"],
      skills: "all",
      env: new AgentEnvironment(config).build(),
      model: config.roles.main.model,
      permissionMode: "default",
      canUseTool: this.permit,
      includePartialMessages: true,
      maxBudgetUsd: config.limits.budgetUsdPerRequest,
      resume: this.sessionId ?? undefined,
      abortController: controller,
    };
  }

  /**
   * The mode decides whether a change waits for the musician: in Manual every change to the Set waits
   * for Apply or Skip; in Auto and Let me hear it changes go straight through. Using the singer's
   * voice always waits for their consent.
   */
  private readonly permit: CanUseTool = async (toolName, input, { signal }) => {
    if (toolName === "Read") {
      const path = typeof input.file_path === "string" ? input.file_path : "";
      return this.deps.workspace.isSkillFile(path) ? allow(input) : deny("Ode only reads its own skill files.");
    }
    const tool = this.deps.registry.find(toolName);
    if (!tool) return deny(`${toolName} is not available in Ode.`);
    const needsConsent = CONSENT_TOOLS.has(tool.name);
    if (!needsConsent && (tool.changes !== "set" || (await this.deps.prefs.mode()) !== Mode.Manual)) return allow(input);
    const summary = tool.describe?.(input as never) ?? `${EventTranslator.toolLabel(toolName)} ${JSON.stringify(input).slice(0, 240)}`;
    const decision = await this.deps.approvals.request(tool.name, input, summary, signal);
    return decision === Decision.Allow ? allow(input) : deny("The musician skipped this change.");
  };

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    this.deps.emit({ type: "busy", busy });
  }
}
