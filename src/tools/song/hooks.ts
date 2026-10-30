import { t } from "../../shared/i18n";
import { z } from "zod";
import { hookNotesInRange, melodyNoteHash } from "../../music/melody/lyric-phrases";
import { SetLookup } from "../../server/set-lookup";
import type { Note } from "../../shared/live";
import { CompositionSchema, RetainedHookSchema, compositionStatus } from "../../shared/song";
import { defineTool } from "../define";

/** Retain the performance actually present, rather than asking the model to invent a content hash. */
export const hookRetainTool = defineTool({
  name: "hook_retain",
  changes: "memory",
  description: "Retain a chosen hook from the current tagged MIDI clip in the song's composition. Reads the actual full notes, including performance fields, and stores them with a canonical SHA-256 source hash; later melody_write hookId uses those notes and verifies that the selected source span still matches. id names the musical hook; clipTag must identify exactly one MIDI clip; startBeat (default 0) and lengthBeats select a complete phrase within it, including initial rests. Notes crossing the boundary are refused rather than clipped; retained note starts become hook-local. description explains its musical identity or intended use. Replaces only the hook with that id and preserves the rest of the plan; it does not change Live or certify the sound. Use after reading/hearing the chosen performance, and again only after deliberately accepting a revision.",
  input: {
    id: z.string().min(1),
    clipTag: z.string().min(1),
    startBeat: z.number().min(0).optional(),
    lengthBeats: z.number().positive(),
    description: z.string().optional(),
  },
  describe: ({ id }) => t("toolActivity.keepTheChosenHook", { id: id }),
  async run({ id, clipTag, startBeat = 0, lengthBeats, description }, ctx) {
    const snapshot = await ctx.snapshots.read();
    const matches = new SetLookup(snapshot).allTracks.flatMap((track) => SetLookup.clipsOf(track)).filter((clip) => clip.tag === clipTag);
    if (matches.length !== 1 || matches[0]?.kind !== "midi") throw new Error("The hook needs exactly one current tagged MIDI clip; read the intended clip and give its unique tag.");
    const source = await ctx.live.extension.call<{ notes: Note[] }>("midi_clip_get_notes", { clip: { tag: clipTag } });
    const notes = hookNotesInRange(source.notes, startBeat, lengthBeats);
    const hook = RetainedHookSchema.parse({ id, description, lengthBeats, notes, source: { tag: clipTag, ...(startBeat === 0 ? {} : { startBeat }), noteHash: melodyNoteHash(notes) } });
    const sheet = await ctx.song.read();
    const composition = CompositionSchema.parse(sheet.composition ?? {});
    composition.hooks = [...composition.hooks.filter((existing) => existing.id !== id), hook];
    const saved = await ctx.song.updateWithReceipt({ composition });
    return { hook, compositionStatus: compositionStatus(saved), __odeReceipts: saved.__odeReceipts };
  },
});
