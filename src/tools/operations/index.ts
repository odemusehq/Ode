import type { ChatCompletionTool } from "openai/resources/chat/completions";

export enum LoopTool {
  ToolSearch = "tool_search",
  SkillRead = "skill_read",
  Subagent = "subagent",
  ProductionExecute = "production_execute",
}

/** Application-provided capabilities exposed as tools, not functions built into the model. */
export function operationalTools(options: { production: boolean; subagents: boolean }): ChatCompletionTool[] {
    const tools: ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: LoopTool.ToolSearch,
          description:
            "Finds Ode's tools for a job by what they do, such as \"set the notes of a MIDI clip\", \"insert a device\" or \"render audio\". Found schemas are available next step. Rediscover older schemas when needed.",
          parameters: { type: "object", properties: { query: { type: "string", description: "What the tool should do." }, names: { type: "array", items: { type: "string" }, maxItems: 8, description: "Exact tool names from a skill, instead of a text query." }, group: { type: "string", enum: ["daw_write", "daw_read", "mneme", "lyrics", "operations"] } } },
        },
      },
      {
        type: "function",
        function: {
          name: LoopTool.SkillRead,
          description:
            'Reads a skill: its SKILL.md by name ("lyrics", or a child such as "lyrics/rhymes"), or a file its SKILL.md points to (file: "references/meter.md").',
          parameters: {
            type: "object",
            properties: { name: { type: "string" }, file: { type: "string", description: "A file inside the skill's folder." } },
            required: ["name"],
          },
        },
      },
    ];
    if (options.production) tools.push({
      type: "function", function: {
        name: LoopTool.ProductionExecute,
        description: "Declare that this CURRENT musician request asks you to execute the reconciled production goal, rather than discuss/status/plan it. First save its working step with production_task_update. Give taskId and the full exact current user request that you interpreted as execution intent; the quote identifies the request, it does not prove semantic permission. This request-local declaration allows one continuation reminder if you reply while work remains; it never starts a new run or budget and is cleared by a question, Stop, steering or restart. Do not use for Why?, status, suggestions or planning-only conversation.",
        parameters: { type: "object", properties: { taskId: { type: "string" }, quote: { type: "string" } }, required: ["taskId", "quote"] },
      },
    });
    if (options.subagents) {
      tools.push({
        type: "function",
        function: {
          name: LoopTool.Subagent,
          description:
            "Starts a subagent for one focused musical task: composing melodies, chords, drums or basslines, proposing sounds or mix moves from available observations, reviewing musical material, or updating artist memory. All lyric writing, rewriting, analysis and word-to-note alignment belong to the configured lyricist tool, not this generic subagent. The subagent makes model decisions and uses exposed SDK, Max or plug-in tools; it cannot invent a local processing engine or exact audio transcription. It sees only this brief, so give the actual material, constraints, relevant skills and requested return format. Returns its answer. Several independent subagents called in one step run at the same time.",
          parameters: { type: "object", properties: { task: { type: "string", description: "The whole brief." } }, required: ["task"] },
        },
      });
    }
    return tools;
  }
