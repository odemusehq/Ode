import { t } from "../../shared/i18n";
import { createHash } from "node:crypto";
import { z } from "zod";
import { LyricsChoiceSchema, SyllableBindingSchema } from "../../shared/lyrics-document";
import { NoteSchema } from "../../shared/live-schemas";
import { defineTool, type AnyTool } from "../define";

/** These tools persist explicit artist/model choices; all note values are read through the native SDK. */
export const lyricMelodyTools: AnyTool[] = [
  defineTool({
    name: "lyrics_choose_syllables", changes: "memory",
    description: "Save a deliberate syllable split, word stress and optional IPA for one currently analysed word. Read lyrics_read first and send its songId, revision as baseRevision, notationRevision and absolute line (including headings/blanks), plus the zero-based word index and exact written word in value. Joined syllable spelling must equal that word; this is literal persistence, not a local linguistic analyser. The musician's choice survives subsequent Lyricist checks. A changed syllable count retains existing MIDI and marks its associations stale for Ode to reconcile. No notes or words are rewritten.",
    input: LyricsChoiceSchema.shape,
    run: async (input, ctx) => ctx.lyrics.choose(input),
  }),
  defineTool({
    name: "lyrics_bind_melody", changes: "memory",
    description: "Associate current lyric syllables with actual notes in a tagged native MIDI clip, without changing any music. First read midi_clip_get_notes and retain its notesHash; pass it as expectedNotesHash. Read lyrics_read for text/baseRevision/notationRevision and current word/syllable indices. Each binding gives an absolute lyric line, exact line text, zero-based word and syllable, and the note indices in that SDK read, in time order; one syllable may span several notes and several syllables may share a note. Supplied lines replace their previous associations on this clip; other lines are preserved, but marked stale if their source MIDI changed. Refuses stale text/annotations or changed MIDI. Use existing native MIDI tools to change notes, then bind against a fresh read. No melody fitting or syllable analysis algorithm runs here.",
    input: {
      clip: z.object({ tag: z.string().min(1) }).describe("A durable clip tag, already present in Live; do not invent a new object identity."),
      expectedNotesHash: z.string().regex(/^[a-f0-9]{64}$/),
      baseRevision: z.number().int().min(0), notationRevision: z.number().int().min(0),
      bindings: z.array(SyllableBindingSchema.omit({ stale: true })).min(1),
    },
    async run({ clip, expectedNotesHash, baseRevision, notationRevision, bindings }, ctx) {
      const songId = ctx.song.songId;
      const result = await ctx.live.extension.call<{ notes: unknown }>("midi_clip_get_notes", { clip }, ctx.signal);
      ctx.signal?.throwIfAborted();
      const hash = createHash("sha256").update(JSON.stringify(result.notes)).digest("hex");
      if (hash !== expectedNotesHash) throw new Error(t("lyrics.document.midiChanged"));
      const notes = z.array(NoteSchema).parse(result.notes);
      for (const binding of bindings) {
        if (binding.notes.some((index, at) => {
          const note = notes[index];
          const previous = at > 0 ? notes[binding.notes[at - 1]!] : undefined;
          return !note || at > 0 && (!previous || note.start < previous.start);
        })) {
          throw new Error(t("lyrics.document.noteOrder"));
        }
      }
      const id = "vocal-" + createHash("sha256").update(JSON.stringify(clip)).digest("hex").slice(0, 12);
      return ctx.lyrics.bind(songId, baseRevision, notationRevision, { id, clip, notes, bindings });
    },
  }),
];
