import { z } from "zod";
import { analyzeLyrics } from "../../music/prosody/lyrics-analyzer";
import { defineTool } from "../define";
import { AccentInput } from "./schemas";
import { resolveAccent } from "./song-defaults";

export const lyricsAnalyzeTool = defineTool({
  name: "lyrics_analyze",
  description: [
    "Analyses lyric lines with Ode's pronunciation and rhyme code, in UK or US English.",
    "Use it to check a draft before showing it: syllable counts, stress, rhyme scheme, clichés and uncertain words.",
    "Inputs: lines (the lyric, one string per line, in order); accent (optional, defaults to the Pronunciation setting).",
    "Returns { accent, lines, scheme, notes }. lines[i].words[j].options lists every valid pronunciation as syllables",
    "({ text, phonemes in IPA, stress 1 primary / 2 secondary / 0 unstressed, after phrase stress }); certain is false when the",
    "word's pronunciation is a best guess in this accent (never present it as checked). lines[i].counts is",
    "every possible syllable count of the line, ascending; a line meets a syllable target when one of its counts matches.",
    'scheme has a rhyme letter per line ("A", "B"…) or "-" for a line without a rhyme partner. notes (line = 0-based index,',
    'kind = "cliche" | "rhyme" | "prosody" | "uncertain") explain problems in plain words.',
  ].join(" "),
  input: {
    lines: z.array(z.string()).min(1).describe("Lyric lines in order, one string per line."),
    accent: AccentInput,
  },
  changes: "none",
  async run({ lines, accent }, ctx) {
    const chosen = await resolveAccent(ctx, accent);
    return { accent: chosen, ...analyzeLyrics(lines, chosen) };
  },
});
