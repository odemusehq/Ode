import { z } from "zod";
import { formatIpa } from "../../music/phonetics/ipa";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import { defineTool } from "../define";
import { AccentInput } from "./schemas";
import { resolveAccent } from "./song-defaults";

export const syllablesTool = defineTool({
  name: "syllables",
  description: [
    "Counts and splits syllables of a word or a lyric line in UK or US English, from pronunciation dictionaries.",
    "Use it whenever a syllable count matters (fitting a line to a melody or a target length); never count syllables yourself.",
    "Inputs: text (one word or one line); accent (optional, defaults to the Pronunciation setting).",
    "Returns { accent, counts, words }. counts is every possible syllable count of the whole text, ascending (words such as",
    '"every" or "fire" can be sung with more than one count). Each word has text, certain (false = the pronunciation is',
    "a best guess in this accent and must be marked as not certain), counts, and options: each option is one pronunciation with count,",
    'syllables (the spelling split for display, e.g. ["ev", "ery"]) and ipa (IPA with stress marks, e.g. "ˈɛv.ɹi").',
  ].join(" "),
  input: {
    text: z.string().min(1).describe("A word or one lyric line."),
    accent: AccentInput,
  },
  changes: "none",
  async run({ text, accent }, ctx) {
    const chosen = await resolveAccent(ctx, accent);
    const line = analyzeLine(text, chosen);
    return {
      accent: chosen,
      counts: line.counts,
      words: line.words.map((word) => ({
        text: word.text,
        certain: word.certain,
        counts: [...new Set(word.options.map((option) => option.syllables.length))].sort((a, b) => a - b),
        options: word.options.map((option) => ({
          count: option.syllables.length,
          syllables: option.syllables.map((syllable) => syllable.text),
          ipa: formatIpa(
            option.syllables.map((syllable) => syllable.phonemes),
            option.syllables.map((syllable) => syllable.stress),
          ),
        })),
      })),
    };
  },
});
