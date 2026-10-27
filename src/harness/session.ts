import { query, type CanUseTool, type Options, type PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { OdeConfig } from "../shared/config";
import type { LiveConnections, LivePointer } from "../shared/live";
import type { UiEvent } from "../shared/events";
import type { ContextSummary } from "../mneme/summary";
import type { ToolRegistry } from "../tools";
import { OdeAgents } from "../agents/agents";
import { AgentEnvironment } from "./agent-environment";
import { Approvals, Decision } from "./approvals";
import { EventTranslator } from "./event-translator";
import type { Workspace } from "./workspace";

export interface SessionDeps {
  config: OdeConfig;
  workspace: Workspace;
  registry: ToolRegistry;
  agents: OdeAgents;
  approvals: Approvals;
  summary: ContextSummary;
  live: LiveConnections;
  emit: (event: UiEvent) => void;
  pointer: () => LivePointer | null;
}

function allow(input: Record<string, unknown>): PermissionResult {
  return { behavior: "allow", updatedInput: input };
}

function deny(message: string): PermissionResult {
  return { behavior: "deny", message };
}

/**
 * The conversation about one song. Each request runs as its own agent call that resumes the
 * song's saved conversation, so the spending cap applies per request.
 */
export class OdeSession {
  private readonly translator = new EventTranslator();
  private readonly waiting: string[] = [];
  private controller: AbortController | null = null;
  private busy = false;

  constructor(
    private readonly deps: SessionDeps,
    private sessionId: string | null,
    private readonly onSessionId: (id: string) => void,
  ) {}

  get isBusy(): boolean {
    return this.busy;
  }

  async send(text: string): Promise<void> {
    this.waiting.push(text);
    if (!this.busy) await this.drain();
  }

  stop(): void {
    this.waiting.length = 0;
    this.deps.approvals.denyAll();
    this.controller?.abort();
  }

  private async drain(): Promise<void> {
    let text = this.waiting.shift();
    while (text !== undefined) {
      await this.runOnce(text);
      text = this.waiting.shift();
    }
  }

  private async runOnce(text: string): Promise<void> {
    this.setBusy(true);
    this.deps.emit({ type: "message", role: "user", text });
    const controller = new AbortController();
    this.controller = controller;
    try {
      const context = await this.deps.summary.build(this.deps.live.status(), this.deps.pointer());
      const run = query({ prompt: `${context}\n\n${text}`, options: await this.options(controller) });
      for await (const message of run) {
        if (message.type === "system" && message.subtype === "init" && message.session_id !== this.sessionId) {
          this.sessionId = message.session_id;
          this.onSessionId(message.session_id);
        }
        for (const event of this.translator.translate(message)) this.deps.emit(event);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.deps.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      this.controller = null;
      this.setBusy(false);
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
      allowedTools: [...registry.readOnlyNames(), ...OdeAgents.BUILT_IN_TOOLS],
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

  private readonly permit: CanUseTool = async (toolName, input, { signal }) => {
    if (toolName === "Read") {
      const path = typeof input.file_path === "string" ? input.file_path : "";
      return this.deps.workspace.isSkillFile(path) ? allow(input) : deny("Ode only reads its own skill files.");
    }
    const tool = this.deps.registry.find(toolName);
    if (!tool) return deny(`${toolName} is not available in Ode.`);
    if (tool.changes === "none") return allow(input);
    const summary = tool.describe?.(input as never) ?? `${EventTranslator.toolLabel(toolName)} ${JSON.stringify(input).slice(0, 240)}`;
    const decision = await this.deps.approvals.request(tool.name, input, summary, signal);
    return decision === Decision.Allow ? allow(input) : deny("The musician did not approve this change.");
  };

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    this.deps.emit({ type: "busy", busy });
  }
}
