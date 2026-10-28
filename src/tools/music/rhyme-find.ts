import { z } from "zod";
import { findRhymes } from "../../music/rhyme/rhyme-index";
import { RhymeKind } from "../../music/rhyme/rhyme-kind";
import { defineTool } from "../define";
import { AccentInput } from "./schemas";
import { resolveAccent } from "./song-defaults";

const MAX_LIMIT = 200;

export const rhymeFindTool = defineTool({
  name: "rhyme_find",
  description: [
    "Finds rhymes for a word from the pronunciation dictionary of the chosen accent (UK and US differ, e.g. bath/path).",
    "Use it to find rhymes instead of guessing; every result's kind comes from Ode's rhyme code.",
    'Inputs: word; accent (optional, defaults to the Pronunciation setting); kinds (optional filter: "perfect",',
    '"multisyllabic", "near", "assonance", "consonance", "identical"; default all but identical); limit (default 40);',
    "commonOnly (only the most frequent English words).",
    "Returns { accent, word, rhymes }: each rhyme has word, kind, score (0–1, how close the ending sounds),",
    "common (among the most frequent English words) and overused (a pair listeners hear coming, e.g. fire/desire;",
    "labelled, not banned). Sorted strongest kind first, common words first.",
  ].join(" "),
  input: {
    word: z.string().min(1).describe("The word to rhyme with."),
    accent: AccentInput,
    kinds: z.array(z.enum(RhymeKind)).optional().describe("Rhyme kinds to include."),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe("Most results to return."),
    commonOnly: z.boolean().optional().describe("Only common words."),
  },
  changes: "none",
  async run({ word, accent, kinds, limit, commonOnly }, ctx) {
    const chosen = await resolveAccent(ctx, accent);
    return { accent: chosen, word, rhymes: findRhymes(word, chosen, { kinds, limit, commonOnly }) };
  },
});
