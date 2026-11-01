import { randomUUID } from "node:crypto";
import { createSdkMcpServer, tool, type PreToolUseHookInput, type SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk/core";
import { z } from "zod";
import { t } from "../shared/i18n";
import { midiDescription, midiInputSchema } from "../tools/midi-material-adapter";
import type { AnyTool, ToolMedia } from "../tools/define";
import { Semaphore } from "./semaphore";
import type { LoopDeps, LoopRun } from "./loop";

export const SDK_TOOL_PREFIX = "mcp__ode__";

/** Existing Ode tools behind the SDK's MCP transport. Native hooks supply caller identity, never model arguments. */
export class AgentTools {
  private readonly permits = new Map<string, { name: string; input: string; child: boolean }>();
  private readonly reads = new Semaphore(6);
  private readonly reading = new Set<Promise<unknown>>();
  private writing: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: Pick<LoopDeps, "registry" | "skills" | "labels" | "observations" | "limits">, private readonly run: LoopRun) {}

  server() { return createSdkMcpServer({ name: "ode", tools: this.definitions() }); }

  /** Do not finish a request while an already-issued native operation is still settling. */
  async drain(): Promise<void> { await Promise.allSettled([this.writing, ...this.reading]); }

  definitions(): SdkMcpToolDefinition<any>[] {
    const registered: SdkMcpToolDefinition<any>[] = this.deps.registry.available("main").map(definition => tool(
      definition.name, midiDescription(definition.name, definition.description), midiInputSchema(definition.name, definition.input).shape,
      (input, extra) => this.invoke(definition, input, extra),
      { alwaysLoad: definition.alwaysLoad, annotations: { readOnlyHint: definition.changes === "none", destructiveHint: definition.changes === "set" } },
    ));
    registered.push(tool("skill_read", "Read an Ode skill by name, or a file referenced by its SKILL.md. Read only the relevant subskill or reference.",
      { name: z.string().min(1), file: z.string().optional() }, async ({ name, file }) => {
        this.run.signal.throwIfAborted();
        return { content: [{ type: "text", text: await this.deps.skills.read(name, file) }] };
      }, { alwaysLoad: true, annotations: { readOnlyHint: true } }));
    if (this.run.production) registered.push(tool("production_execute", "Declare that the CURRENT musician request asks you to execute the saved production task. Quote the full current request exactly. A saved plan does not authorise execution.",
      { taskId: z.string(), quote: z.string() }, async ({ taskId, quote }) => {
        this.run.signal.throwIfAborted();
        return { content: [{ type: "text", text: await this.run.production!.execute(taskId, quote) }] };
      }));
    return registered;
  }

  /** Runs for every SDK tool call, including calls whose SDK permission rule already allows them. */
  async authorize(input: PreToolUseHookInput): Promise<string | null> {
    this.run.signal.throwIfAborted();
    if (!input.tool_name.startsWith(SDK_TOOL_PREFIX)) return "This tool is not registered by Ode.";
    const name = input.tool_name.slice(SDK_TOOL_PREFIX.length);
    if (name === "skill_read") return null;
    if (name === "production_execute") return input.agent_id ? "Only the main agent can declare production execution." : null;
    const definition = this.deps.registry.find(name);
    const kind = input.agent_id ? "subagent" : "main";
    if (!definition || !this.deps.registry.available(kind).includes(definition)) return "Subagents inspect and propose; only the main agent can change the song or ask the musician.";
    const parsed = midiInputSchema(name, definition.input).safeParse(input.tool_input);
    if (!parsed.success) return z.prettifyError(parsed.error);
    const refusal = await this.run.gate.check(definition, parsed.data, this.run.signal);
    this.run.signal.throwIfAborted();
    if (refusal !== null) return refusal;
    this.permits.set(input.tool_use_id, { name, input: JSON.stringify(parsed.data), child: Boolean(input.agent_id) });
    return null;
  }

  private async invoke(definition: AnyTool, input: Record<string, unknown>, extra: unknown) {
    const id = (extra as { _meta?: Record<string, unknown> })?._meta?.["claudecode/toolUseId"];
    const permit = typeof id === "string" ? this.permits.get(id) : undefined;
    if (typeof id === "string") this.permits.delete(id);
    if (!permit || permit.name !== definition.name || permit.input !== JSON.stringify(input)) {
      return { isError: true, content: [{ type: "text" as const, text: "The SDK did not authorise this exact tool call. Nothing was executed." }] };
    }
    const callId = id as string;
    const work = async () => {
      this.run.signal.throwIfAborted();
      this.run.events.toolStarted(callId, definition.name, this.deps.labels.for(definition.name, input));
      let ok = false;
      try {
        if (definition.changes === "set" || ["lyrics_write", "lead_sheet_update", "hook_retain"].includes(definition.name)) this.run.onMutation?.();
        if (definition.name === "ask_musician") this.run.production?.pause();
        const outcome = await this.deps.registry.run(definition.name, input, this.run.signal, { exchangeId: this.run.exchangeId, toolCallId: callId });
        if (outcome.receipts?.length) {
          this.run.onReceipts?.(outcome.receipts);
          if (definition.changes === "memory") this.run.onMutation?.();
        }
        // An audio MCP block becomes a path inside the stock SDK. It is never listening evidence.
        const audioUnavailable = outcome.media?.some(item => item.content.type === "audio" || item.content.type === "input_audio");
        let media: ReturnType<typeof AgentTools.media> = [];
        let mediaError = audioUnavailable ? t("runtime.sdkAudioUnavailable") : "";
        if (!mediaError) try { media = (outcome.media ?? []).flatMap(item => AgentTools.media(item)); }
        catch (error) { mediaError = error instanceof Error ? error.message : String(error); }
        ok = outcome.ok && !mediaError;
        const text = mediaError || outcome.text;
        let citation = "";
        if (this.run.exchangeId && this.deps.observations) {
          try {
            const saved = await this.deps.observations.record({ exchangeId: this.run.exchangeId,
              toolCallId: `${permit.child ? "subagent" : "main"}:${randomUUID()}`, name: definition.name,
              input: outcome.input ?? {}, ok, text, targets: outcome.targets });
            citation = `\nSaved observation: ${JSON.stringify({ exchangeId: saved.exchangeId, toolCallId: saved.toolCallId, targets: saved.targets })}. This records the outcome, not artistic quality or later currentness.`;
          } catch { citation = "\nThis outcome was not saved as an observation. Do not cite it as saved evidence."; }
        }
        return { isError: !ok, content: [
          { type: "text" as const, text: this.capped(text) + citation },
          ...media,
        ] };
      } finally { this.run.events.toolFinished(callId, ok); }
    };
    // Independent inspections overlap; writes wait for earlier reads and writes. Later reads wait for that write.
    if (definition.changes === "none") {
      const task = this.writing.then(() => this.reads.use(work));
      this.reading.add(task);
      try { return await task; } finally { this.reading.delete(task); }
    }
    const task = Promise.all([this.writing, ...this.reading]).then(work);
    this.writing = task.catch(() => undefined);
    return task;
  }

  private capped(text: string): string {
    const limit = this.deps.limits.toolResultMaxChars;
    return text.length <= limit ? text : `${text.slice(0, limit)}\nResult truncated. Request a smaller range or page.`;
  }

  static media(item: ToolMedia) {
    if (item.content.type === "text") return [{ type: "text" as const, text: `${item.description}\n${item.content.text}` }];
    if (item.content.type === "image_url") {
      const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(item.content.image_url.url);
      if (!match) throw new Error("The reference image must contain its actual bytes.");
      return [{ type: "text" as const, text: item.description }, { type: "image" as const, mimeType: match[1]! as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: match[2]! }];
    }
    throw new Error(t("runtime.sdkAudioUnavailable"));
  }
}
