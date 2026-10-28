import { prosodyCheck } from "../../music/prosody/prosody-checker";
import { defineTool } from "../define";
import { describeSyllables, LINE_ON_NOTES_INPUT, prepareLineOnNotes } from "./line-on-notes";

export const prosodyCheckTool = defineTool({
  name: "prosody_check",
  description: [
    "Checks prosody: whether a lyric line's natural stresses fall on the strong notes of its melody.",
    "Each note gets a weight from its position in the bar (4/4: beat 1 = 1.0, beat 3 = 0.75, beats 2 and 4 = 0.5,",
    "eighth off-beats = 0.25, sixteenths = 0.1; compound meters such as 6/8 use dotted-quarter beats), its length and",
    "whether it is a melodic high point. A stressed syllable on a weaker note than an unstressed neighbour is an inversion.",
    "Use it after setting words to a melody, and fix the issues it reports before reporting the result. The line is set to the notes with the same",
    "pronunciation and alignment as set_lyrics_to_melody.",
    "Inputs: line; notes (the melody for that line); timeSignature (optional, defaults to Live's); accent (optional).",
    "Returns { accent, score (0–1, 1 = no problems), issues, syllables, alignment, notes }: each issue has syllable",
    "(index into syllables), problem and fix in plain words; alignment pairs each syllable with the note it is sung on.",
  ].join(" "),
  input: LINE_ON_NOTES_INPUT,
  changes: "none",
  async run(input, ctx) {
    const { accent, line, notes, signature } = await prepareLineOnNotes(ctx, input);
    const report = prosodyCheck(line, notes, signature.numerator, signature.denominator);
    return {
      accent,
      score: report.score,
      issues: report.issues,
      syllables: describeSyllables(report.syllables),
      alignment: report.alignment,
      notes: report.notes,
    };
  },
});
