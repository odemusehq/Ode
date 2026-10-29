import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import type { AnyTool, ToolContext } from "./define";
import { RefNames } from "./live/ref-names";
import { liveTools } from "./live";
import { musicTools } from "./music";
import { audioTools } from "./audio";
import { mediaTools } from "./media";
import { songTools } from "./song";

/** Who a tool list is for: the main agent gets every tool, subagents the read-only ones. */
export type AgentKind = "main" | "subagent";

/** What one tool call came to, as the model reads it. */
export interface ToolOutcome {
  ok: boolean;
  text: string;
}

const GROUPS: readonly (readonly AnyTool[])[] = [liveTools, musicTools, audioTools, mediaTools, songTools];

/** Every Ode tool, offered to the model as a function with a JSON Schema for its input. */
export class ToolRegistry {
  private readonly byName = new Map<string, AnyTool>();
  private readonly functionsByName = new Map<string, ChatCompletionTool>();

  constructor(private readonly ctx: ToolContext) {
    for (const definition of GROUPS.flat()) {
      if (this.byName.has(definition.name)) throw new Error(`Two tools share the name ${definition.name}.`);
      this.byName.set(definition.name, definition);
    }
  }

  find(name: string): AnyTool | undefined {
    return this.byName.get(name);
  }

  /** The tools an agent may use. */
  available(agent: AgentKind): AnyTool[] {
    return [...this.byName.values()].filter((definition) => agent === "main" || (definition.changes === "none" && !definition.mainAgentOnly));
  }

  /** The tools whose definitions the model has from the start; it finds the others with tool search. */
  alwaysLoaded(agent: AgentKind): string[] {
    return this.available(agent)
      .filter((definition) => definition.alwaysLoad)
      .map((definition) => definition.name);
  }

  /** The tools whose name and description share the most words with the query, best first. */
  search(query: string, agent: AgentKind, limit: number): AnyTool[] {
    const words = ToolRegistry.words(query);
    return this.available(agent)
      .map((definition) => ({ definition, score: ToolRegistry.score(definition, words) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((match) => match.definition);
  }

  /** The function definitions for these tools, as the model receives them. */
  functions(names: Iterable<string>): ChatCompletionTool[] {
    return [...names].flatMap((name) => {
      const definition = this.byName.get(name);
      return definition ? [this.functionFor(definition)] : [];
    });
  }

  /** Runs a tool with the model's input; a failure comes back as text for the model to read. */
  async run(name: string, input: unknown): Promise<ToolOutcome> {
    const definition = this.byName.get(name);
    if (!definition) return { ok: false, text: `Ode's tools are named in tool search; ${name} is unknown.` };
    const parsed = z.object(definition.input).safeParse(input);
    if (!parsed.success) return { ok: false, text: `The input for ${name} needs fixing: ${z.prettifyError(parsed.error)}` };
    try {
      return { ok: true, text: JSON.stringify((await definition.run(parsed.data, this.ctx)) ?? { done: true }) };
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * The tool's one-line description of a call, with what it touches named from the latest snapshot of the Set:
   * "Bass · EQ Eight · 1 Frequency A to 200". Undefined for a tool without one, or for input the tool wouldn't accept.
   */
  describe(name: string, input: unknown): string | undefined {
    const definition = this.byName.get(name);
    if (!definition?.describe) return undefined;
    const parsed = z.object(definition.input).safeParse(input);
    if (!parsed.success) return undefined;
    const line = definition.describe(parsed.data, new RefNames(this.ctx.snapshots.latest)).trim();
    return line || undefined;
  }

  private functionFor(definition: AnyTool): ChatCompletionTool {
    const known = this.functionsByName.get(definition.name);
    if (known) return known;
    const { $schema: _dialect, ...parameters } = z.toJSONSchema(z.object(definition.input)) as Record<string, unknown>;
    const made: ChatCompletionTool = {
      type: "function",
      function: { name: definition.name, description: definition.description, parameters },
    };
    this.functionsByName.set(definition.name, made);
    return made;
  }

  private static words(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  }

  /** Words of the query found in the tool's name count three times as much as words found in its description. */
  private static score(definition: AnyTool, words: readonly string[]): number {
    const name = new Set(definition.name.split("_"));
    const description = new Set(ToolRegistry.words(definition.description));
    return words.reduce((total, word) => total + (name.has(word) ? 3 : 0) + (description.has(word) ? 1 : 0), 0);
  }
}
