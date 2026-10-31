import { z } from "zod";
import { defineTool } from "../define";

export const midiMaterialTools = [
  defineTool({
    name: "midi_material_list",
    changes: "none",

    description: "List exact MIDI material retained by the main agent and read-only children in this request, optionally from one resultId. Returns bounded whole JSON pages with count/hash/source/path and nextOffset. References expire on Stop, completion or restart; they are neither durable drafts nor current-Set evidence. Reuse a whole reference in declared note inputs rather than reconstructing a part from pages.",
    input: { resultId: z.uuid().optional(), offset: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(100).optional() },
    async run(input, ctx) {
      if (!ctx.midiMaterials) throw new Error("There is no active MIDI material scope. Read or compute the notes in this request first.");
      ctx.midiMaterials.assertActive(ctx.song.songId ?? "", ctx.exchangeId ?? "");
      return ctx.midiMaterials.list(input, ctx.config.limits.toolResultMaxChars);
    },
  }),
  defineTool({
    name: "midi_material_read",
    changes: "none",

    description: "Inspect exact temporary MIDI notes or the complete projected metadata of their tool result. id is a material reference id or resultId for metadata. Notes offset/limit are zero-based note indices (up to512 per page); metadata offset/limit are UTF-16 code units in serialized JSON text, as used by JavaScript slice (up to60000). Later metadata fragments require expectedHash from its first page. Whole response envelopes fit the tool window; nextOffset advances only delivered data. Full metadata includes all retained nested references and exact lyric/pronunciation/alignment details. Inspection pages need not be assembled for an edit: use the immutable whole MIDI reference. These references expire with the request.",
    input: {
      id: z.uuid(), section: z.enum(["notes", "metadata"]).default("notes"),
      offset: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(60000).optional(),
      expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    },
    async run(input, ctx) {
      if (!ctx.midiMaterials) throw new Error("There is no active MIDI material scope. Read or compute the notes in this request first.");
      ctx.midiMaterials.assertActive(ctx.song.songId ?? "", ctx.exchangeId ?? "");
      if (input.section === "notes" && input.limit !== undefined && input.limit > 512) throw new Error("A MIDI note inspection page contains at most 512 notes.");
      return ctx.midiMaterials.read(input, ctx.config.limits.toolResultMaxChars);
    },
  }),
];
