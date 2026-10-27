import { z } from "zod";
import type { StressLevel } from "../../music/phonetics/pronunciation";
import { isFunctionWord } from "../../music/phonetics/function-words";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import { defineTool } from "../define";
import { AccentInput } from "./schemas";
import { resolveAccent } from "./song-defaults";

/** The usual way songwriters say a stress pattern aloud: DUM for primary stress, dum for secondary, da for unstressed. */
const SPOKEN_STRESS: Readonly<Record<StressLevel, string>> = { 0: "da", 1: "DUM", 2: "dum" };

export const stressTool = defineTool({
  name: "stress",
  description: [
    "Shows the stress pattern of a word or lyric line in UK or US English: content words keep their dictionary stress,",
    "short function words (articles, pronouns, auxiliaries, prepositions, conjunctions) are weakened unless they stand alone.",
    "Use it to match a line's natural stresses to a melody or to another line (meter).",
    "Inputs: text (a word or one line); accent (optional, defaults to the Pronunciation setting).",
    'Returns { accent, stresses, spoken, words }. stresses is the pattern of the usual pronunciation, e.g. "0 1 0 1" (1 primary,',
    '2 secondary, 0 unstressed); spoken says it as "da DUM da DUM". Each word has text, functionWord, certain (false = best',
    "guess in this accent) and options, each with syllables { text, stress }.",
  ].join(" "),
  input: {
    text: z.string().min(1).describe("A word or one lyric line."),
    accent: AccentInput,
  },
  changes: "none",
  async run({ text, accent }, ctx) {
    const chosen = await resolveAccent(ctx, accent);
    const line = analyzeLine(text, chosen);
    const usual = line.words.flatMap((word) => word.options[0]?.syllables ?? []);
    return {
      accent: chosen,
      stresses: usual.map((syllable) => syllable.stress).join(" "),
      spoken: usual.map((syllable) => SPOKEN_STRESS[syllable.stress]).join(" "),
      words: line.words.map((word) => ({
        text: word.text,
        functionWord: isFunctionWord(word.text),
        certain: word.certain,
        options: word.options.map((option) => ({
          syllables: option.syllables.map((syllable) => ({ text: syllable.text, stress: syllable.stress })),
        })),
      })),
    };
  },
});
