import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import { MidiMaterials, type MidiMaterialScope } from "../harness/midi-materials";
import { isMutationReceipt, type MutationReceipt } from "../shared/mutation-receipt";
import { dawActionTools, dawStateTools } from "./daw";
import { RefNames } from "./daw/ref-names";
import { TOOL_MEDIA, type AnyTool, type ToolMedia, type ToolContext } from "./define";
import { assertUnlocked } from "./locked-material";
import { lyricist } from "./lyrics/lyricist";
import { lyricTextTools, resolveLyricsEdit } from "./lyrics/text";
import { midiDescription, midiInputSchema, midiLabelInput, midiOutputPaths, resolveMidiInput } from "./midi-material-adapter";
import { mnemeTools } from "./mneme";
import { askMusician } from "./operations/questions";
import { referenceTools } from "./operations/references";

/** Who a tool list is for: the main agent gets every tool, subagents the read-only ones. */
export type AgentKind = "main" | "subagent";

/** What one tool call came to, as the model reads it. */
export interface ToolOutcome {
  ok: boolean;
  text: string;
  media?: ToolMedia[];
  receipts?: MutationReceipt[];
  /** Canonical, schema-validated arguments actually executed; raw model extras are not evidence. */
  input?: unknown;
  /** When supplied by a tool definition, replaces inferred request/result tags. */
  targets?: readonly string[];
}

export const TOOL_GROUPS = ["daw_write", "daw_read", "mneme", "lyrics", "operations"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];
const GROUPS: readonly (readonly [ToolGroup, readonly AnyTool[]])[] = [
  ["daw_write", dawActionTools], ["daw_read", dawStateTools], ["mneme", mnemeTools],
  ["lyrics", [...lyricTextTools, lyricist]], ["operations", [askMusician, ...referenceTools]],
];

/** Every Ode tool, offered to the model as a function with a JSON Schema for its input. */
export class ToolRegistry {
  private readonly byName = new Map<string, AnyTool>();
  private readonly groups = new Map<string, ToolGroup>();
  private readonly functionsByName = new Map<string, ChatCompletionTool>();
  private readonly midiMaterials = new MidiMaterials();
  private readonly midiScopes = new Map<string, MidiMaterialScope>();

  constructor(private readonly ctx: ToolContext) {
    for (const [group, definitions] of GROUPS) for (const definition of definitions) {
      if (this.byName.has(definition.name)) throw new Error(`Two tools share the name ${definition.name}.`);
      this.byName.set(definition.name, definition);
      this.groups.set(definition.name, group);
    }
  }

  /** Main request lifetime; children select this same captured-song scope by trusted exchange id. */
  beginMidiMaterials(exchangeId: string): () => void {
    const songId = this.ctx.song?.songId;
    if (!songId) return () => undefined;
    const previous = this.midiScopes.get(exchangeId);
    if (previous) this.midiMaterials.end(previous);
    const scope = this.midiMaterials.begin(songId, exchangeId);
    this.midiScopes.set(exchangeId, scope);
    return () => {
      this.midiMaterials.end(scope);
      if (this.midiScopes.get(exchangeId) === scope) this.midiScopes.delete(exchangeId);
    };
  }

  find(name: string): AnyTool | undefined {
    return this.byName.get(name);
  }

  group(name: string): ToolGroup | undefined { return this.groups.get(name); }

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
  search(query: string, agent: AgentKind, limit: number, group?: ToolGroup): AnyTool[] {
    const words = ToolRegistry.words(query);
    return this.available(agent)
      .filter((definition) => !group || this.groups.get(definition.name) === group)
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
  async run(name: string, input: unknown, signal?: AbortSignal, execution: { exchangeId?: string; toolCallId?: string } = {}): Promise<ToolOutcome> {
    signal?.throwIfAborted();
    const definition = this.byName.get(name);
    if (!definition) return { ok: false, text: `Ode's tools are named in tool search; ${name} is unknown.` };
    const parsed = midiInputSchema(name, definition.input).safeParse(input);
    if (!parsed.success) return { ok: false, text: `The input for ${name} needs fixing: ${z.prettifyError(parsed.error)}` };
    const receipts: MutationReceipt[] = [];
    try {
      const scope = execution.exchangeId ? this.midiScopes.get(execution.exchangeId) : undefined;
      scope?.assertActive(this.ctx.song.songId ?? "", execution.exchangeId ?? "");
      let actual: Record<string, unknown>;
      let noteOrigins: string[] = [];
      // Group arguments are otherwise parsed only by the batch runner. Mediation must see the same canonical
      // references, including union ordering/stripped fields, before it decides what material a call affects.
      if (name === "apply_as_one_undo_step") {
        const group = parsed.data as { calls: { op: string; args: Record<string, unknown> }[] };
        const calls: { op: string; args: Record<string, unknown> }[] = [];
        for (const call of group.calls) {
          const operation = this.byName.get(call.op);
          if (!operation) throw new Error(`Unknown grouped operation: ${call.op}`);
          call.args = midiInputSchema(call.op, operation.input).parse(call.args);
          const resolved = resolveMidiInput(call.op, call.args, scope);
          const args = z.object(operation.input).parse(resolved.input);
          if (call.op === "midi_clip_set_notes" && resolved.noteOrigins.length) args.originReadTokens = resolved.noteOrigins;
          calls.push({ op: call.op, args });
        }
        actual = { ...parsed.data, calls };
      } else {
        const resolved = resolveMidiInput(name, parsed.data, scope);
        noteOrigins = resolved.noteOrigins;
        actual = z.object(definition.input).parse(resolved.input);
        if (name === "midi_clip_set_notes" && noteOrigins.length) actual.originReadTokens = noteOrigins;
      }
      if (name === "lyrics_write" && actual.startLine !== undefined) {
        actual = resolveLyricsEdit(actual as unknown as Parameters<typeof resolveLyricsEdit>[0], await this.ctx.lyrics.read()) as unknown as Record<string, unknown>;
      }
      if (definition.changes === "set" || name === "lyrics_write" || name === "lead_sheet_update") {
        const sheet = await this.ctx.song.read();
        if (sheet.locked.length > 0) assertUnlocked(name, name === "lyrics_write" ? actual : parsed.data, await this.ctx.snapshots.read());
      }
      signal?.throwIfAborted();
      scope?.assertActive(this.ctx.song.songId ?? "", execution.exchangeId ?? "");
      const extension = this.ctx.live.extension;
      const live = signal ? { extension: { call: <R>(op: string, args: unknown) => extension.call<R>(op, args, signal) } } : this.ctx.live;
      const result = (await definition.run(actual, { ...this.ctx, live, signal, ...execution, midiMaterials: scope })) ?? { done: true };
      const covered = new Set(["midi_clip_set_notes", "lyrics_write", "lead_sheet_update", "hook_retain"]);
      const clean = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(clean);
        if (!value || typeof value !== "object") return value;
        const object = value as Record<string, unknown>;
        if ((covered.has(name) || name === "apply_as_one_undo_step") && Array.isArray(object.__odeReceipts)) receipts.push(...object.__odeReceipts.filter(isMutationReceipt));
        return Object.fromEntries(Object.entries(object).filter(([key]) => key !== "__odeReceipts").map(([key, item]) => [key, clean(item)]));
      };
      const cleaned = clean(result);
      const unverified = (tool: string) => receipts.push({ kind: "unverified", tool, reason: "The SDK operation has no scoped writer receipt." });
      if (name === "apply_as_one_undo_step") {
        const calls = (parsed.data as { calls: { op: string }[] }).calls;
        for (const call of calls) if (this.byName.get(call.op)?.changes === "set" && !covered.has(call.op)) unverified(call.op);
        const expectedReceipts = calls.filter((call) => covered.has(call.op)).length;
        if (receipts.filter((receipt) => receipt.kind !== "unverified").length < expectedReceipts) unverified(name);
      } else if (definition.changes === "set" && !covered.has(name)) unverified(name);
      if (covered.has(name) && !Array.isArray((result as Record<string, unknown>).__odeReceipts)) unverified(name);
      const outputs = midiOutputPaths(name, cleaned, parsed.data, noteOrigins);
      let projected = cleaned;
      if (scope && outputs.length) {
        try {
          scope.assertActive(this.ctx.song.songId ?? "", execution.exchangeId ?? "");
          projected = scope.capture({ result: cleaned, outputs, sourceTool: name, signal, maxResultChars: this.ctx.config.limits.toolResultMaxChars });
        } catch (error) {
          if (definition.changes === "none") throw error;
          // The host returned success already. A temporary transport failure cannot turn it into a failed write.
          const materialWarning = `Calls completed, but temporary MIDI material is unavailable: ${(error instanceof Error ? error.message : String(error)).slice(0, 300)} Read the actual Set before continuing; do not replay these completed calls.`;
          const nativeTransactions = (cleaned as { nativeTransactions?: number })?.nativeTransactions;
          const completed = { completed: true, materialWarning, ...(nativeTransactions === undefined ? {} : { nativeTransactions }) };
          const withActualResult = cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) ? { ...cleaned, ...completed } : completed;
          const limit = this.ctx.config.limits.toolResultMaxChars;
          projected = JSON.stringify(withActualResult).length <= limit ? withActualResult
            : JSON.stringify(completed).length <= limit ? completed
            : JSON.stringify({ completed: true }).length <= limit ? { completed: true } : limit >= 4 ? true : 1;
        }
      }
      return { ok: true, text: JSON.stringify(projected), input: parsed.data,
        ...((result as { [TOOL_MEDIA]?: ToolMedia[] })[TOOL_MEDIA]?.length ? { media: (result as { [TOOL_MEDIA]: ToolMedia[] })[TOOL_MEDIA] } : {}),
        ...(definition.observationTargets ? { targets: definition.observationTargets(cleaned) } : {}),
        ...(receipts.length ? { receipts } : {}) };
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error), input: parsed.data,
        ...(receipts.length ? { receipts } : (definition.changes === "set" || name === "lyrics_write" || name === "lead_sheet_update" || name === "hook_retain")
          ? { receipts: [{ kind: "unverified" as const, tool: name, reason: "The operation failed; any partial write has unknown scope." }] } : {}) };
    }
  }

  /**
   * The tool's one-line description of a call, with what it touches named from the latest snapshot of the Set:
   * "Bass · EQ Eight · 1 Frequency A to 200". Undefined for a tool without one, or for input the tool would refuse.
   */
  describe(name: string, input: unknown): string | undefined {
    const definition = this.byName.get(name);
    if (!definition?.describe) return undefined;
    const parsed = midiInputSchema(name, definition.input).safeParse(input);
    if (!parsed.success) return undefined;
    if (name === "apply_as_one_undo_step") {
      return (parsed.data as { calls: { op: string; args: unknown }[] }).calls.map((call) => this.describe(call.op, call.args) ?? call.op).join("; ");
    }
    const line = definition.describe(midiLabelInput(name, parsed.data), new RefNames(this.ctx.snapshots.latest)).trim();
    return line || undefined;
  }

  /** The validated target of a read whose definition has no custom progress line. */
  target(name: string, input: unknown): string | undefined {
    const definition = this.byName.get(name);
    if (!definition) return undefined;
    const parsed = midiInputSchema(name, definition.input).safeParse(input);
    if (!parsed.success) return undefined;
    const args = parsed.data as Record<string, unknown>;
    const names = new RefNames(this.ctx.snapshots.latest);
    if (args.parameter) return names.parameter(args.parameter as Parameters<RefNames["parameter"]>[0]);
    if (args.device) return names.device(args.device as Parameters<RefNames["device"]>[0]);
    if (args.clip) return names.clip(args.clip as Parameters<RefNames["clip"]>[0]);
    if (args.track) return names.track(args.track as Parameters<RefNames["track"]>[0]);
    if (args.slot) return names.slot(args.slot as Parameters<RefNames["slot"]>[0]);
    if (args.scene) return names.scene(args.scene as Parameters<RefNames["scene"]>[0]);
    return undefined;
  }

  private functionFor(definition: AnyTool): ChatCompletionTool {
    const known = this.functionsByName.get(definition.name);
    if (known) return known;
    const { $schema: _dialect, ...parameters } = z.toJSONSchema(midiInputSchema(definition.name, definition.input)) as Record<string, unknown>;
    const made: ChatCompletionTool = {
      type: "function",
      function: { name: definition.name, description: midiDescription(definition.name, definition.description), parameters },
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
