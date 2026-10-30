import { z } from "zod";
import { setEditableLyricsToMelody } from "../../music/prosody/editable-lyric-setting";
import { defineTool } from "../define";
import { describeSyllables, LINE_ON_NOTES_INPUT, prepareLineOnNotes } from "./line-on-notes";
import { NotesInput } from "./schemas";

export const setLyricsToMelodyTool = defineTool({
  name: "set_lyrics_to_melody",
  description: [
    "Sets a lyric line to melody notes: picks the pronunciation whose syllable count fits the notes (e.g. \"every\" as 2",
    "or 3 syllables), then aligns syllables to notes so stressed syllables land on stronger notes. When there are more",
    "syllables than notes it splits notes; when there are fewer it sings melismas (one syllable over several notes).",
    "Use it to put words under a melody or prepare a demo vocal. Inputs: line; notes (the complete material to preserve);",
    "sourceIndices (optional zero-based original input positions selecting one unmuted vocal line); timeSignature (optional, defaults to Live's); accent (optional).",
    "Without selection all unmuted notes must form one line: simultaneous or near-simultaneous attacks are refused rather than choosing the highest voice. Intentional legato overlaps remain valid.",
    "Returns { accent, count, syllables, notes, alignment, melody, selectedSourceIndices, preservedSourceIndices, splitSyllables, melismaSyllables }. notes is the complete supplied material with only the selected line split as needed; every unselected and muted note retains its original fields. Write this complete notes list with the guarded MIDI note tool if it changed.",
    "All indices are zero-based: alignment indexes the returned complete notes; selectedSourceIndices and preservedSourceIndices index the original input. melody contains only the selected vocal notes with its own alignment indexing melody.notes. For demo_vocal_render use melody.notes and melody.alignment, so accompaniment and muted notes do not become vocal notes. A melisma syllable appears once per sung note; syllables preserves chosen spelling, word and stress. Oversized results are refused rather than returning an incomplete replacement.",
  ].join(" "),
  input: {
    ...LINE_ON_NOTES_INPUT,
    notes: NotesInput.min(1).describe("The complete supplied material; select one vocal line with sourceIndices to preserve other voices."),
    sourceIndices: z.array(z.number().int().min(0)).min(1).optional().describe("Zero-based original input positions selecting one unmuted vocal line; every other note is preserved."),
  },
  changes: "none",
  async run(input, ctx) {
    const { accent, line, notes, signature } = await prepareLineOnNotes(ctx, input);
    const setting = setEditableLyricsToMelody(line, notes, signature.numerator, signature.denominator, input.sourceIndices);
    const result = {
      accent,
      count: setting.syllables.length,
      syllables: describeSyllables(setting.syllables),
      notes: setting.notes,
      alignment: setting.alignment,
      melody: setting.melody,
      selectedSourceIndices: setting.selectedSourceIndices,
      preservedSourceIndices: setting.preservedSourceIndices,
      splitSyllables: setting.splitSyllables,
      melismaSyllables: setting.melismaSyllables,
    };
    if (!ctx.midiMaterials && JSON.stringify(result).length > ctx.config.limits.toolResultMaxChars) throw new Error("This complete lyric setting exceeds the tool result window. Use a smaller supplied phrase; no incomplete replacement was returned.");
    return result;
  },
});
