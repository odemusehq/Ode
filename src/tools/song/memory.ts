import { z } from "zod";
import { defineTool, type AnyTool } from "../define";

const scope = z.enum(["artist", "song"]);
const kind = z.enum(["preference", "material"]);
const context = z.string().trim().min(1).max(2000).optional().describe("Free-text applicability, such as a section, production situation or performance; not a fixed style category.");

/** Artist memory is maintained during normal turns; musical edits and provider settings have their own tools. */
export const memoryTools: AnyTool[] = [
  defineTool({
    name: "memory_recall",
    changes: "none",
    alwaysLoad: true,
    description: "Read mneme's persistent artist database. Default detail facts returns artist-wide memories and this song's local choices. kind preference reads taste; kind material reads used ideas for comparison, not recipes. detail feedback pages acceptance/rejection counts separately. topic searches free-text content/context in the selected detail. includeOtherSongs explicitly includes other songs' records; their instructions do not apply here. Follow nextOffset for record pages. Each fact includes evidenceTotal and a bounded evidence page; give its id with evidenceOffset/nextEvidenceOffset to read further sources. Current requests override profile defaults; an accepted suggestion alone does not prove a lasting preference.",
    input: { topic: z.string().max(500).optional(), kind: kind.optional(), includeOtherSongs: z.boolean().optional(),
      detail: z.enum(["facts", "feedback"]).optional(), id: z.string().min(1).max(200).optional(),
      evidenceOffset: z.number().int().min(0).optional(), evidenceLimit: z.number().int().min(1).max(10).optional(),
      offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(30).optional() },
    run: async (input, ctx) => {
      const options = { songId: ctx.song.songId || undefined, includeOtherSongs: input.includeOtherSongs, kind: input.kind };
      const feedback = input.detail === "feedback";
      if (feedback && input.id) throw new Error("Read a fact by id, or choose feedback without an id.");
      const all = feedback
        ? (await ctx.mneme.habitStrengths(options)).filter((habit) => !input.topic || `${habit.name} ${habit.context ?? ""} ${habit.note ?? ""}`.toLowerCase().includes(input.topic.toLowerCase()))
        : (await ctx.mneme.recall(input.topic, options)).filter((fact) => !input.id || fact.id === input.id).map((fact) => {
          const offset = input.evidenceOffset ?? 0, limit = input.evidenceLimit ?? 3;
          return { ...fact, evidence: fact.evidence.slice(offset, offset + limit), evidenceTotal: fact.evidence.length, evidenceOffset: offset,
            nextEvidenceOffset: offset + limit < fact.evidence.length ? offset + limit : null };
        });
      if (input.id && !all.length) throw new Error("That memory is not in this view. Recall the relevant song's records or includeOtherSongs when comparing past work.");
      const offset = input.offset ?? 0;
      const page = all.slice(offset, offset + (input.limit ?? 12));
      const result = () => ({ detail: feedback ? "feedback" : "facts", facts: feedback ? [] : page, habits: feedback ? page : [],
        total: all.length, offset, nextOffset: offset + page.length < all.length ? offset + page.length : null });
      while (JSON.stringify(result()).length > ctx.config.limits.toolResultMaxChars && page.length > 1) page.pop();
      if (JSON.stringify(result()).length > ctx.config.limits.toolResultMaxChars) throw new Error("This memory page exceeds the result limit. Reduce evidenceLimit, or increase the limit to read the complete record.");
      return result();
    },
  }),
  defineTool({
    name: "memory_record",
    changes: "memory",
    backgroundMemory: true,
    mainAgentOnly: true,
    alwaysLoad: true,
    description: "Maintain mneme quietly as meaningful feedback or inspected material teaches you something. Topics/values/context are open-ended. New records default to this song; choose scope artist only for an enduring preference supported by the musician or their own material. Use id from memory_recall to correct an existing record; omitted scope/kind/context retain its applicability. source said requires the musician's words in evidence; noticed requires a concrete observation and its authorship, with tentative confidence. Imported/collaborative material does not automatically establish artist taste. Ode-authored drafts can be recorded as kind material to avoid recycling ideas, never as independent evidence of artist preferences. Material records describe what was used, not permission to reproduce it; record exact distinguishing qualities and source references rather than copying old lyrics as templates. Current song/exchange/call are attached automatically. Never store credentials or private reasoning. Use preferences_set for existing typed settings only when their artist-wide scope is clear; use song settings for local genre/range/target choices.",
    input: {
      id: z.string().min(1).max(200).optional(), scope: scope.optional(), kind: kind.optional(), context: context.nullable().describe("Free-text applicability. Omit to retain it on correction, or null to clear it."),
      topic: z.string().trim().min(1).max(200), value: z.string().trim().min(1).max(8000),
      source: z.enum(["said", "noticed"]), confidence: z.number().min(0).max(1).optional(),
      evidence: z.string().trim().min(1).max(2000).describe("The musician's actual statement, or specific inspected notes/lyrics/audio and their source. Do not invent listening or authorship."),
      authorship: z.enum(["artist", "ode", "mixed", "unknown"]).optional(),
    },
    describe: ({ topic }) => `Artist memory · ${topic}`,
    run: ({ evidence, authorship, ...fact }, ctx) => {
      const targetScope = fact.scope ?? (fact.id ? undefined : "song");
      return ctx.mneme.record({ ...fact, scope: targetScope,
        ...(targetScope === "song" ? { songId: ctx.song.songId || undefined } : {}),
        evidence: { note: evidence, song: ctx.song.songId || undefined, exchangeId: ctx.exchangeId, toolCallId: ctx.toolCallId,
          authorship: authorship ?? (fact.source === "said" ? "artist" : "unknown") },
      }, ctx.signal);
    },
  }),
  defineTool({
    name: "memory_forget",
    changes: "memory",
    backgroundMemory: true,
    mainAgentOnly: true,
    description: "Remove an obsolete or unwanted mneme record by id from memory_recall. For a correction prefer memory_record with that id so its useful evidence stays attached. Forgetting preferences never changes the song, Live or provider settings.",
    input: { id: z.string().min(1).max(200) },
    describe: () => "Artist memory · forget",
    run: async ({ id }, ctx) => ({ forgotten: await ctx.mneme.forget(id, ctx.signal) }),
  }),
  defineTool({
    name: "memory_note_outcome",
    changes: "memory",
    backgroundMemory: true,
    mainAgentOnly: true,
    description: "Record the musician's meaningful acceptance or rejection of a suggestion, with the actual feedback as evidence. Default scope song; use artist only when the feedback is enduring. Repeated calls for the same habit/context and accepted exchange count once. A tool succeeding, an Apply click alone or leaving an Ode draft unchanged is not enough to infer taste. Outcome counts are weak context, not rules; current instructions and explicit preferences take priority.",
    input: { habit: z.string().trim().min(1).max(200), kept: z.boolean(), scope: scope.optional(), context, evidence: z.string().trim().min(1).max(2000) },
    describe: ({ habit }) => `Artist feedback · ${habit}`,
    run: ({ habit, kept, scope: targetScope, context, evidence }, ctx) => {
      if (!ctx.exchangeId) throw new Error("Artist feedback needs the current accepted exchange.");
      return ctx.mneme.noteOutcome(habit, kept, { songId: targetScope === "artist" ? undefined : ctx.song.songId || undefined,
        context, exchangeId: ctx.exchangeId, note: evidence, signal: ctx.signal });
    },
  }),
];
