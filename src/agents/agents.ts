import { readFile } from "node:fs/promises";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { OdeConfig } from "../shared/config";
import type { ToolRegistry } from "../tools";

/** Ode's main agent and its one kind of subagent. Specialisation comes from skills. */
export class OdeAgents {
  static readonly SUBAGENT = "subagent";
  /** The only built-in tools: reading skill files, starting subagents, loading skills, finding tools. */
  static readonly BUILT_IN_TOOLS = ["Read", "Agent", "Skill", "ToolSearch"] as const;

  constructor(
    private readonly config: OdeConfig,
    private readonly registry: ToolRegistry,
  ) {}

  systemPrompt(): Promise<string> {
    return readFile(new URL("./ode.md", import.meta.url), "utf8");
  }

  async subagent(): Promise<AgentDefinition> {
    return {
      description:
        "A focused helper for one task: writing or revising lyrics, melodies, chords, drums, basslines, sounds or mix advice, reviewing a draft with fresh eyes, or updating what Ode knows about the artist. Give it the task, the material it needs, the skills to load and the format to return.",
      prompt: await readFile(new URL("./subagent.md", import.meta.url), "utf8"),
      tools: [...this.registry.namesFor("subagent"), ...OdeAgents.BUILT_IN_TOOLS],
      model: this.config.roles.subagent.model,
    };
  }
}
