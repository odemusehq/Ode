import { setLyricsToMelody } from "../../music/prosody/lyric-setter";
import { defineTool } from "../define";
import { describeSyllables, LINE_ON_NOTES_INPUT, prepareLineOnNotes } from "./line-on-notes";

export const setLyricsToMelodyTool = defineTool({
  name: "set_lyrics_to_melody",
  description: [
    "Sets a lyric line to melody notes: picks the pronunciation whose syllable count fits the notes (e.g. \"every\" as 2",
    "or 3 syllables), then aligns syllables to notes so stressed syllables land on stronger notes. When there are more",
    "syllables than notes it splits notes; when there are fewer it sings melismas (one syllable over several notes).",
    "Use it to put words under a melody or to prepare a demo vocal; write the returned notes to the clip with the MIDI",
    "note tools if they changed.",
    "Inputs: line; notes (the melody for that line); timeSignature (optional, defaults to Live's); accent (optional).",
    "Returns { accent, count, syllables, notes, alignment, splitSyllables, melismaSyllables }: notes is the melody",
    "after any splits; alignment pairs each syllable index with the note index it is sung on (a melisma syllable",
    "appears once per note); syllables gives the spelling, word and stress for display under the notes.",
  ].join(" "),
  input: LINE_ON_NOTES_INPUT,
  changes: "none",
  async run(input, ctx) {
    const { accent, line, notes, signature } = await prepareLineOnNotes(ctx, input);
    const setting = setLyricsToMelody(line, notes, signature.numerator, signature.denominator);
    return {
      accent,
      count: setting.syllables.length,
      syllables: describeSyllables(setting.syllables),
      notes: setting.notes,
      alignment: setting.alignment,
      splitSyllables: setting.splitSyllables,
      melismaSyllables: setting.melismaSyllables,
    };
  },
});
