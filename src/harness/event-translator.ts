import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { UiEvent } from "../shared/events";
import type { ToolRegistry } from "../tools";

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

/** Verbs for the last word of a tool's name, for a plain progress line when the tool has no description of its own. */
const PROGRESS_VERBS: ReadonlyMap<string, string> = new Map([
  ["get", "Reading"],
  ["read", "Reading"],
  ["list", "Reading"],
  ["recall", "Recalling"],
  ["check", "Checking"],
  ["find", "Finding"],
  ["write", "Writing"],
  ["plan", "Planning"],
  ["analyze", "Analysing"],
  ["describe", "Listening to"],
  ["transcribe", "Transcribing"],
  ["measure", "Measuring"],
  ["vary", "Varying"],
  ["search", "Searching"],
]);

/** Words written as musicians write them in a progress line. */
const PROGRESS_WORDS: ReadonlyMap<string, string> = new Map([["midi", "MIDI"]]);

/**
 * Turns the agent runtime's messages into the events the UI shows (one line of progress for each tool
 * Ode starts, subagents, errors) and keeps Ode's final reply and the cost of the turn.
 */
export class EventTranslator {
  private static readonly TOOL_PREFIX = /^mcp__ode-[a-z]+__/;
  private finalReply = "";
  private cost: number | undefined;

  constructor(private readonly registry: ToolRegistry) {}

  /** Ode's final reply for this turn; empty when the turn didn't finish. */
  get reply(): string {
    return this.finalReply;
  }

  get costUsd(): number | undefined {
    return this.cost;
  }

  translate(message: SDKMessage): UiEvent[] {
    switch (message.type) {
      case "assistant":
        return message.parent_tool_use_id ? [] : this.fromAssistant(message.message.content as unknown as ContentBlock[]);
      case "user":
        return message.parent_tool_use_id ? [] : this.fromToolResults(message.message.content);
      case "system":
        return this.fromSystem(message);
      case "result":
        return this.fromResult(message);
      default:
        return [];
    }
  }

  static toolLabel(name: string): string {
    return name.replace(EventTranslator.TOOL_PREFIX, "");
  }

  /** One line about a tool Ode starts: the tool's own description of the call, or a plain label. */
  progressFor(fullName: string, input: Record<string, unknown>): string {
    const described = this.registry.describe(fullName, input);
    if (described) return described.replace(/\.$/, "");
    if (fullName === "Skill") {
      const skill = [input.skill, input.command, input.name].find((value) => typeof value === "string");
      return skill ? `Reading the ${String(skill)} skill` : "Reading a skill";
    }
    if (fullName === "Read") return "Reading a skill file";
    if (fullName === "ToolSearch") return "Finding the right tools";
    return EventTranslator.plainLabel(EventTranslator.toolLabel(fullName));
  }

  /** "midi_clip_get_notes" → "Reading MIDI clip notes"; "prosody_check" → "Checking prosody". */
  static plainLabel(name: string): string {
    const words = name.split("_").map((word) => PROGRESS_WORDS.get(word) ?? word);
    const verbAt = words.findIndex((word) => PROGRESS_VERBS.has(word));
    if (verbAt > 0) {
      const rest = words.filter((_, index) => index !== verbAt);
      return `${PROGRESS_VERBS.get(words[verbAt]!)} ${rest.join(" ")}`;
    }
    const sentence = words.join(" ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  private fromAssistant(blocks: ContentBlock[]): UiEvent[] {
    const events: UiEvent[] = [];
    const text = blocks
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("");
    if (text) events.push({ type: "message", role: "assistant", text });
    for (const block of blocks) {
      if (block.type !== "tool_use" || !block.id || !block.name) continue;
      if (block.name === "Agent" || block.name === "Task") continue;
      events.push({ type: "tool", id: block.id, name: EventTranslator.toolLabel(block.name), status: "started" });
      events.push({ type: "progress", text: this.progressFor(block.name, block.input ?? {}) });
    }
    return events;
  }

  private fromToolResults(content: unknown): UiEvent[] {
    if (!Array.isArray(content)) return [];
    return (content as ContentBlock[])
      .filter((block) => block.type === "tool_result" && block.tool_use_id)
      .map((block) => ({ type: "tool", id: block.tool_use_id!, name: "", status: block.is_error ? "error" : "done" }));
  }

  private fromSystem(message: Extract<SDKMessage, { type: "system" }>): UiEvent[] {
    const system = message as { subtype: string; task_id?: string; description?: string; status?: string };
    if (system.subtype === "task_started" && system.task_id) {
      const task = system.description ?? "";
      const started: UiEvent[] = [{ type: "subagent", id: system.task_id, task, status: "started" }];
      if (task) started.push({ type: "progress", text: task });
      return started;
    }
    if (system.subtype === "task_notification" && system.task_id) {
      return [{ type: "subagent", id: system.task_id, task: "", status: "done" }];
    }
    return [];
  }

  private fromResult(message: Extract<SDKMessage, { type: "result" }>): UiEvent[] {
    this.cost = message.total_cost_usd;
    if (message.subtype === "success") {
      if (!message.is_error) {
        this.finalReply = message.result;
        return [];
      }
      return [{ type: "error", message: message.result || "The model provider rejected this request." }];
    }
    const reason =
      message.subtype === "error_max_budget_usd"
        ? "Stopped: this request reached its spending cap (ODE_BUDGET_USD_PER_REQUEST)."
        : "Ode stopped because of an error while working on this request.";
    return [{ type: "error", message: reason }];
  }
}
