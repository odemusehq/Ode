import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ChatReply } from "../services/capabilities";
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
  /** What the request may still spend; subagents share their parent's, and a top-level run starts a fresh one. */
  budget?: RequestBudget;
  onMutation?: () => void;
}

/** How a run ended. */
export enum LoopEnd {
  Reply = "reply",
  /** The model answered with an empty message. */
  EmptyReply = "empty reply",
  Cancelled = "cancelled",
  TurnLimit = "turn limit",
  TokenLimit = "token limit",
}

/** What one request may still spend, shared by the main agent and every subagent it starts. */
export class RequestBudget {
  private turns = 0;
  private spent = 0;
  private subagents = 0;
  private reserved = 0;

  constructor(private readonly limits: AgentLimits) {}

  /** Tokens spent so far, by every run of the request. */
  get tokens(): number {
    return this.spent;
  }

  /** The limit the request has reached, or null while it has room. */
  get reached(): LoopEnd.TurnLimit | LoopEnd.TokenLimit | null {
    if (this.turns >= this.limits.turnsPerRequest) return LoopEnd.TurnLimit;
    if (this.spent >= this.limits.tokensPerRequest) return LoopEnd.TokenLimit;
    return null;
  }

  /** Admission happens synchronously, before any concurrent request starts. */
  reserve(inputTokens: number): { maxTokens: number; settle: (tokens: number) => void } | null {
    if (this.turns >= this.limits.turnsPerRequest) return null;
    const maxTokens = Math.min(this.limits.tokensPerTurn, this.limits.tokensPerRequest - this.spent - this.reserved - inputTokens);
    if (maxTokens < 1) return null;
    const amount = inputTokens + maxTokens;
    this.turns += 1;
    this.reserved += amount;
    let settled = false;
    return { maxTokens, settle: (tokens) => {
      if (settled) return;
      settled = true;
      this.reserved -= amount;
      this.spent += Math.max(0, tokens);
    } };
  }

  /** True when the request may start one more subagent, which it then counts. */
  startSubagent(): boolean {
    if (this.subagents >= this.limits.subagentsPerRequest) return false;
    this.subagents += 1;
    return true;
  }
}

/** What the model reads after an answer that stopped at the turn's length limit. */
const CUT_OFF =
  "Your last answer reached the length limit and stopped part-way, so it was set aside. Take a smaller step: fewer notes or lines in each call, and a shorter note.";

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
  private readonly reads = new Semaphore(6);

  constructor(private readonly deps: LoopDeps) {}

  async run(start: LoopRun): Promise<LoopResult> {
    const { limits, registry } = this.deps;
    const run: LoopRun & { budget: RequestBudget } = { ...start, budget: start.budget ?? new RequestBudget(limits) };
    const model = await this.deps.services.chat(run.agent);
    const messages: ChatCompletionMessageParam[] = [{ role: "system", content: run.system }, ...run.history, { role: "user", content: run.prompt }];
    const loaded = new Set(registry.alwaysLoaded(run.agent));
    const spentBefore = run.budget.tokens;
    const result = (reply: string, end: LoopEnd): LoopResult => ({ reply, tokens: run.budget.tokens - spentBefore, end });
    let said = "";
    for (;;) {
      if (run.signal.aborted) return result(said, LoopEnd.Cancelled);
      const limit = run.budget.reached;
      if (limit) return result(said, limit);
      const tools = [...this.builtIns(run), ...registry.functions(loaded)];
      // Providers count tokens differently. Reserve a conservative estimate of input plus the requested output;
      // actual usage replaces it when known. Unknown tokenisation can still exceed an estimate, so no further calls
      // are admitted once reported usage reaches the budget.
      const admission = run.budget.reserve(Math.ceil(JSON.stringify({ messages, tools }).length / 2));
      if (!admission) return result(said, run.budget.reached ?? LoopEnd.TokenLimit);
      let answer: ChatReply;
      try {
        answer = await model.complete({
          messages,
          tools,
          maxTokens: admission.maxTokens,
          conversation: run.conversation,
          signal: run.signal,
        });
      } catch (error) {
        admission.settle(0);
        if (run.signal.aborted) return result(said, LoopEnd.Cancelled);
        throw error;
      }
      admission.settle(answer.tokens);
      if (run.signal.aborted) return result(said, LoopEnd.Cancelled);
      if (answer.finishReason === "length") {
        messages.push({ role: "user", content: CUT_OFF });
        continue;
      }
      const { message } = answer;
      const text = message.content?.trim() ?? "";
      const calls = message.tool_calls ?? [];
      messages.push({ role: "assistant", content: message.content ?? null, ...(calls.length > 0 ? { tool_calls: calls } : {}) });
      if (text) said = text;
      if (calls.length === 0) return result(text, text ? LoopEnd.Reply : LoopEnd.EmptyReply);
      if (text) run.events.thought(text);
      const answers = await this.answerAll(calls, run, loaded);
      calls.forEach((call, index) => messages.push({ role: "tool", tool_call_id: call.id, content: answers[index] ?? "" }));
    }
  }

  /**
   * Answers a turn's calls: read-only calls run together, and a call that changes something waits for the calls
   * before it and runs alone, so changes land in the order the model gave them. A call that throws answers with why.
   */
  private async answerAll(calls: ChatCompletionMessageToolCall[], run: LoopRun & { budget: RequestBudget }, loaded: Set<string>): Promise<string[]> {
    const answers: string[] = [];
    const running: Promise<void>[] = [];
    for (const [index, call] of calls.entries()) {
      const work = () =>
        this.answer(call, run, loaded).then(
          (text) => {
            answers[index] = text;
          },
          (error: unknown) => {
            answers[index] = `${call.type === "function" ? call.function.name : "The call"} stopped: ${error instanceof Error ? error.message : String(error)}`;
          },
        );
      if (this.changesSomething(call)) {
        await Promise.all(running.splice(0));
        await work();
      } else {
        running.push(work());
      }
    }
    await Promise.all(running);
    return answers;
  }

  /** True for a call to a tool that changes the Set or Ode's memory. */
  private changesSomething(call: ChatCompletionMessageToolCall): boolean {
    if (call.type !== "function") return false;
    const tool = this.deps.registry.find(call.function.name);
    return tool !== undefined && tool.changes !== "none";
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

  private async answer(call: ChatCompletionMessageToolCall, run: LoopRun & { budget: RequestBudget }, loaded: Set<string>): Promise<string> {
    if (call.type !== "function") return "Ode's tools are functions; call one by name with JSON arguments.";
    const name = call.function.name;
    if (run.signal.aborted) return `${name} stays undone: the musician pressed Stop.`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments || "{}");
    } catch {
      parsed = undefined;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return `The arguments for ${name} need to be one JSON object.`;
    const input = parsed as Record<string, unknown>;
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
    if (run.signal.aborted) return `${name} stays undone: the musician pressed Stop.`;
    if (tool.changes !== "none") run.onMutation?.();
    run.events.toolStarted(call.id, name, this.deps.labels.for(name, input));
    const work = () => {
      run.signal.throwIfAborted();
      return this.deps.registry.run(name, input, run.signal);
    };
    const outcome = tool.changes === "none" ? await this.reads.use(work) : await work();
    run.events.toolFinished(call.id, outcome.ok);
    return this.capped(outcome.ok ? outcome.text : `${name} stopped: ${outcome.text}`);
  }

  /** A result within the size the model reads; a longer one is cut, with a note to ask for less. */
  private capped(text: string): string {
    const limit = this.deps.limits.toolResultMaxChars;
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}\n… cut at ${limit} characters: ask for less, such as a bar range, one track or a limit.`;
  }

  private search(input: Record<string, unknown>, run: LoopRun & { budget: RequestBudget }, loaded: Set<string>): string {
    const query = typeof input.query === "string" ? input.query : "";
    const found = this.deps.registry.search(query, run.agent, this.deps.limits.toolSearchResults);
    if (found.length === 0) return "Try other words: the ones Live uses for the thing (track, clip, notes, device, parameter, scene, locator).";
    for (const tool of found) loaded.add(tool.name);
    return `${found.map((tool) => `${tool.name}: ${AgentLoop.firstSentence(tool.description)}`).join("\n")}\nThese tools are yours from the next step on.`;
  }

  private async readSkill(id: string, input: Record<string, unknown>, run: LoopRun & { budget: RequestBudget }): Promise<string> {
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

  private async subagent(id: string, input: Record<string, unknown>, run: LoopRun & { budget: RequestBudget }): Promise<string> {
    const task = typeof input.task === "string" ? input.task.trim() : "";
    if (!task) return "Give the subagent its brief: the task, the material, the constraints, the skills to load and what to return.";
    if (run.depth >= this.deps.limits.subagentDepth) return "Subagents at this depth do the task themselves.";
    if (!run.budget.startSubagent()) return "This request has started all the subagents it may: finish the task here.";
    const depth = run.depth + 1;
    let slots = this.slots.get(depth);
    if (!slots) {
      slots = new Semaphore(this.deps.limits.subagentsAtOnce);
      this.slots.set(depth, slots);
    }
    run.events.subagentStarted(id, AgentLoop.firstSentence(task));
    try {
      const result = await slots.use(async () => {
        if (run.signal.aborted) return { reply: "", tokens: 0, end: LoopEnd.Cancelled };
        return this.run({
          agent: "subagent",
          system: await this.deps.subagentPrompt(),
          history: [],
          prompt: task,
          conversation: `${run.conversation}/${id}`,
          depth,
          gate: run.gate,
          events: QUIET,
          signal: run.signal,
          budget: run.budget,
        });
      });
      if (result.end !== LoopEnd.Reply) return `The subagent stopped at its ${result.end} before finishing.${result.reply ? ` Its last words: ${result.reply}` : ""}`;
      return result.reply;
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
