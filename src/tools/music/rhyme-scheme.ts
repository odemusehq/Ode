import { z } from "zod";
import { LineAnalyzer } from "../../music/phonetics/line-analyzer";
import { RhymeSchemeBuilder } from "../../music/rhyme/rhyme-scheme";
import { defineTool } from "../define";
import { AccentInput } from "./schemas";
import { resolveAccent } from "./song-defaults";

export const rhymeSchemeTool = defineTool({
  name: "rhyme_scheme",
  description: [
    "Works out the rhyme scheme of lyric lines in UK or US English and labels every rhyme.",
    "Use it to check which lines rhyme and how strongly; to check whether two words rhyme, pass them as two lines.",
    "The rhyming part runs from the last stressed vowel to the end of the line, across word boundaries.",
    "Inputs: lines (one string per line, in order); accent (optional, defaults to the Pronunciation setting).",
    'Returns { accent, scheme, pairs, internal }. scheme has a letter per line ("A", "B"…) or "-" when a line has no',
    'partner. pairs lists each rhyming line with its partner: lines (0-based indexes), kind ("perfect", "multisyllabic",',
    '"near", "assonance", "identical"), score 0–1 and the end words. internal lists rhymes inside a line',
    "(line index, the two words, kind, score).",
  ].join(" "),
  input: {
    lines: z.array(z.string()).min(1).describe("Lyric lines in order."),
    accent: AccentInput,
  },
  changes: "none",
  async run({ lines, accent }, ctx) {
    const chosen = await resolveAccent(ctx, accent);
    const analyzer = LineAnalyzer.for(chosen);
    const analyses = lines.map((line) => analyzer.analyze(line));
    const builder = new RhymeSchemeBuilder();
    const { scheme, pairs } = builder.build(analyses);
    return { accent: chosen, scheme, pairs, internal: builder.internalRhymes(analyses) };
  },
});
