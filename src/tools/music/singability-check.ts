import { singabilityCheck } from "../../music/prosody/singability-checker";
import { defineTool } from "../define";
import { describeSyllables, LINE_ON_NOTES_INPUT, prepareLineOnNotes } from "./line-on-notes";

export const singabilityCheckTool = defineTool({
  name: "singability_check",
  description: [
    "Checks how easy a lyric line is to sing on its melody: open vowels (as in \"ah\", \"oh\", \"eye\") suit long or",
    "high notes; closed vowels (\"ee\", \"oo\") and \"er\" on high sustained notes are flagged; clusters of consonants",
    "on very short notes are flagged; phrases longer than eight beats without a rest are flagged.",
    "Use it with prosody_check after writing or changing a topline, or new words for an existing melody, and fix what it flags before reporting.",
    "Inputs: line; notes (the melody for that line); timeSignature (optional, defaults to Live's); accent (optional).",
    "Returns { accent, score (0–1, 1 = zero issues), issues, syllables, alignment, notes }: each issue has syllable",
    "(index into syllables), problem and fix in plain words.",
  ].join(" "),
  input: LINE_ON_NOTES_INPUT,
  changes: "none",
  async run(input, ctx) {
    const { accent, line, notes, signature } = await prepareLineOnNotes(ctx, input);
    const report = singabilityCheck(line, notes, signature.numerator, signature.denominator);
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
