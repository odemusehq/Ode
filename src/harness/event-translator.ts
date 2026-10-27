import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { UiEvent } from "../shared/events";

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

/** Turns the agent runtime's messages into the events the UI shows. */
export class EventTranslator {
  private static readonly TOOL_PREFIX = /^mcp__ode-[a-z]+__/;

  translate(message: SDKMessage): UiEvent[] {
    switch (message.type) {
      case "stream_event":
        return this.fromStream(message);
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

  private fromStream(message: Extract<SDKMessage, { type: "stream_event" }>): UiEvent[] {
    if (message.parent_tool_use_id) return [];
    const event = message.event as { type: string; delta?: { type: string; text?: string } };
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
      return [{ type: "text", delta: event.delta.text }];
    }
    return [];
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
      return [{ type: "subagent", id: system.task_id, task: system.description ?? "", status: "started" }];
    }
    if (system.subtype === "task_notification" && system.task_id) {
      return [{ type: "subagent", id: system.task_id, task: "", status: "done" }];
    }
    return [];
  }

  private fromResult(message: Extract<SDKMessage, { type: "result" }>): UiEvent[] {
    const events: UiEvent[] = [{ type: "done", costUsd: message.total_cost_usd }, { type: "busy", busy: false }];
    if (message.subtype !== "success") {
      const reason =
        message.subtype === "error_max_budget_usd"
          ? "Stopped: this request reached its spending cap (ODE_BUDGET_USD_PER_REQUEST)."
          : "Ode stopped because of an error while working on this request.";
      events.unshift({ type: "error", message: reason });
    }
    return events;
  }
}
