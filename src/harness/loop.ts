import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Services } from "../services/types";
import type { AgentLimits } from "../shared/config";
import type { AgentKind, ToolRegistry } from "../tools";
import type { AnyTool } from "../tools/define";
import { Semaphore } from "./semaphore";
import type { SkillLibrary } from "./skills";
import type { ToolLabels } from "./tool-labels";

/** The tools every agent has from the loop itself. */
export enum LoopTool {
  ToolSearch = "tool_search",
  SkillRead = "skill_read",
  Subagent = "subagent",
}

/** Decides whether a call runs now. */
export interface ToolGate {
  /** Null to run the call, or the text the model reads in its place (the musician skipped the change, for example). */
  check(tool: AnyTool, input: Record<string, unknown>, signal: AbortSignal): Promise<string | null>;
}

/** What a run tells whoever shows Ode's work. */
export interface LoopEvents {
  /** The model's short note about its next step, written before it calls tools. */
  thought(text: string): void;
  toolStarted(id: string, name: string, label: string): void;
  toolFinished(id: string, ok: boolean): void;
  subagentStarted(id: string, task: string): void;
  subagentFinished(id: string): void;
}

/** Subagents work out of sight: only their start and finish show. */
const QUIET: LoopEvents = {
  thought: () => undefined,
  toolStarted: () => undefined,
  toolFinished: () => undefined,
  subagentStarted: () => undefined,
  subagentFinished: () => undefined,
};

export interface LoopDeps {
  /** Where the chat model for each kind of agent comes from. */
  services: Pick<Services, "chat">;
  registry: ToolRegistry;
  skills: SkillLibrary;
  labels: ToolLabels;
  limits: AgentLimits;
  /** The prompt every subagent starts from. */
  subagentPrompt: () => Promise<string>;
}

/** One agent's run: its prompt, the conversation so far, the request, and who hears about it. */
export interface LoopRun {
  agent: AgentKind;
  system: string;
  history: ChatCompletionMessageParam[];
  prompt: string;
  /** Names the conversation, for providers that keep one conversation's requests on the same server. */
  conversation: string;
  /** 0 for the main agent, 1 for its subagents, and so on. */
  depth: number;
  gate: ToolGate;
  events: LoopEvents;
  signal: AbortSignal;
}

/** How a run ended. */
export enum LoopEnd {
  Reply = "reply",
  Cancelled = "cancelled",
  TurnLimit = "turn limit",
  TokenLimit = "token limit",
}

export interface LoopResult {
  /** The model's last words: its reply, or what it had said when the run ended early. */
  reply: string;
  tokens: number;
  end: LoopEnd;
}

/**
 * Ode's agent loop over Chat Completions: the model answers or calls tools, the calls of one turn run at the same
 * time, their results go back to the model, and so on until it replies. Tools beyond the always-loaded ones arrive
 * through tool search; skills and subagents are tools too.
 */
export class AgentLoop {
  /** Subagents running at once, counted per depth, so each depth has places of its own. */
  private readonly slots = new Map<number, Semaphore>();

  constructor(private readonly deps: LoopDeps) {}

  async run(run: LoopRun): Promise<LoopResult> {
    const { limits, registry } = this.deps;
    const model = await this.deps.services.chat(run.agent);
    const messages: ChatCompletionMessageParam[] = [{ role: "system", content: run.system }, ...run.history, { role: "user", content: run.prompt }];
    const loaded = new Set(registry.alwaysLoaded(run.agent));
    let tokens = 0;
    let said = "";
    for (let turn = 0; turn < limits.turnsPerRequest; turn++) {
      if (run.signal.aborted) return { reply: said, tokens, end: LoopEnd.Cancelled };
      let message;
      try {
        const answer = await model.complete({
          messages,
          tools: [...this.builtIns(run), ...registry.functions(loaded)],
          maxTokens: limits.tokensPerTurn,
          conversation: run.conversation,
          signal: run.signal,
        });
        tokens += answer.tokens;
        message = answer.message;
      } catch (error) {
        if (run.signal.aborted) return { reply: said, tokens, end: LoopEnd.Cancelled };
        throw error;
      }
      const text = message.content?.trim() ?? "";
      const calls = message.tool_calls ?? [];
      messages.push({ role: "assistant", content: message.content ?? null, ...(calls.length > 0 ? { tool_calls: calls } : {}) });
      if (text) said = text;
      if (calls.length === 0) return { reply: text, tokens, end: LoopEnd.Reply };
      if (text) run.events.thought(text);
      const answers = await Promise.all(calls.map((call) => this.answer(call, run, loaded)));
      calls.forEach((call, index) => messages.push({ role: "tool", tool_call_id: call.id, content: answers[index] ?? "" }));
      if (tokens >= limits.tokensPerRequest) return { reply: said, tokens, end: LoopEnd.TokenLimit };
    }
    return { reply: said, tokens, end: LoopEnd.TurnLimit };
  }

  private builtIns(run: LoopRun): ChatCompletionTool[] {
    const tools: ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: LoopTool.ToolSearch,
          description:
            "Finds Ode's tools for a job by what they do, such as \"set the notes of a MIDI clip\", \"insert a device\" or \"render audio\". The tools found are yours from the next step on, for the rest of this request.",
          parameters: { type: "object", properties: { query: { type: "string", description: "What the tool should do, in a few words." } }, required: ["query"] },
        },
      },
      {
        type: "function",
        function: {
          name: LoopTool.SkillRead,
          description:
            'Reads a skill: its SKILL.md by name ("rhymes", or a sub-skill such as "rhymes/pop"), or a file its SKILL.md points to (file: "references/meter.md").',
          parameters: {
            type: "object",
            properties: { name: { type: "string" }, file: { type: "string", description: "A file inside the skill's folder." } },
            required: ["name"],
          },
        },
      },
    ];
    if (run.depth < this.deps.limits.subagentDepth) {
      tools.push({
        type: "function",
        function: {
          name: LoopTool.Subagent,
          description:
            "Starts a subagent for one focused task: writing or revising lyrics, melodies, chords, drums, basslines, sounds or mix advice, reviewing a draft with fresh eyes, or updating what Ode knows about the artist. It sees only this brief, so give the task, the material it needs, the constraints, the skills to load and the format to return. Returns its answer. Several subagents called in one step run at the same time.",
          parameters: { type: "object", properties: { task: { type: "string", description: "The whole brief." } }, required: ["task"] },
        },
      });
    }
    return tools;
  }

  private async answer(call: ChatCompletionMessageToolCall, run: LoopRun, loaded: Set<string>): Promise<string> {
    if (call.type !== "function") return "Ode's tools are functions; call one by name with JSON arguments.";
    const name = call.function.name;
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      return `The arguments for ${name} need to be one JSON object.`;
    }
    switch (name) {
      case LoopTool.ToolSearch:
        return this.search(input, run, loaded);
      case LoopTool.SkillRead:
        return this.readSkill(call.id, input, run);
      case LoopTool.Subagent:
        return this.subagent(call.id, input, run);
    }
    const tool = this.deps.registry.find(name);
    if (!tool) return `Find Ode's tools with ${LoopTool.ToolSearch}; ${name} is unknown.`;
    if (!this.deps.registry.available(run.agent).includes(tool)) return "Subagents return material; the main agent applies it to the Set.";
    const refusal = await run.gate.check(tool, input, run.signal);
    if (refusal !== null) return refusal;
    run.events.toolStarted(call.id, name, this.deps.labels.for(name, input));
    const outcome = await this.deps.registry.run(name, input);
    run.events.toolFinished(call.id, outcome.ok);
    return outcome.ok ? outcome.text : `${name} stopped: ${outcome.text}`;
  }

  private search(input: Record<string, unknown>, run: LoopRun, loaded: Set<string>): string {
    const query = typeof input.query === "string" ? input.query : "";
    const found = this.deps.registry.search(query, run.agent, this.deps.limits.toolSearchResults);
    if (found.length === 0) return "Try other words: the ones Live uses for the thing (track, clip, notes, device, parameter, scene, locator).";
    for (const tool of found) loaded.add(tool.name);
    return `${found.map((tool) => `${tool.name}: ${AgentLoop.firstSentence(tool.description)}`).join("\n")}\nThese tools are yours from the next step on.`;
  }

  private async readSkill(id: string, input: Record<string, unknown>, run: LoopRun): Promise<string> {
    const name = typeof input.name === "string" ? input.name : "";
    const file = typeof input.file === "string" ? input.file : undefined;
    run.events.toolStarted(id, LoopTool.SkillRead, `Reading the ${name} skill`);
    try {
      const text = await this.deps.skills.read(name, file);
      run.events.toolFinished(id, true);
      return text;
    } catch (error) {
      run.events.toolFinished(id, false);
      return error instanceof Error ? error.message : String(error);
    }
  }

  private async subagent(id: string, input: Record<string, unknown>, run: LoopRun): Promise<string> {
    const task = typeof input.task === "string" ? input.task.trim() : "";
    if (!task) return "Give the subagent its brief: the task, the material, the constraints, the skills to load and what to return.";
    if (run.depth >= this.deps.limits.subagentDepth) return "Subagents at this depth do the task themselves.";
    const depth = run.depth + 1;
    let slots = this.slots.get(depth);
    if (!slots) {
      slots = new Semaphore(this.deps.limits.subagentsAtOnce);
      this.slots.set(depth, slots);
    }
    run.events.subagentStarted(id, AgentLoop.firstSentence(task));
    try {
      const result = await slots.use(async () =>
        this.run({
          agent: "subagent",
          system: await this.deps.subagentPrompt(),
          history: [],
          prompt: task,
          conversation: `${run.conversation}/${id}`,
          depth,
          gate: run.gate,
          events: QUIET,
          signal: run.signal,
        }),
      );
      return result.reply || "The subagent finished with an empty answer.";
    } catch (error) {
      return `The subagent stopped: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      run.events.subagentFinished(id);
    }
  }

  private static firstSentence(text: string): string {
    const end = text.search(/[.!?](\s|$)/);
    return (end < 0 ? text : text.slice(0, end + 1)).trim();
  }
}
