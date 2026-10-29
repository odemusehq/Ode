import { z } from "zod";
import { LyricsText } from "../../mneme/lyrics-text";
import { LineAnalyzer } from "../../music/phonetics/line-analyzer";
import { MelodyFitter } from "../../music/prosody/melody-fitter";
import { Meter } from "../../music/prosody/meter";
import { defineTool } from "../define";
import { AccentInput, NotesInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";

export const lyricsFitMelodyTool = defineTool({
  name: "lyrics_fit_melody",
  description: [
    "Fits lyric lines to a melody, one phrase per line: the melody is cut at its longest rests into as many phrases as",
    "there are lines (into stretches of whole bars when it has too few rests, the last one running to the end), then",
    "each line is set to its phrase and checked for prosody.",
    "Use it to check a section's lyrics against its melody line by line, before and after changing either;",
    "it splits the melody into phrases for you.",
    "Inputs: lines (the sung lines in order; labels such as \"[Chorus]\" and blank lines are left out); notes (the melody",
    "as read from the MIDI clip, in beats from the start of the stretch; chords are reduced to their top note);",
    "lengthBeats (how long the stretch is, in beats); timeSignature (optional, defaults to Live's); accent (optional).",
    "Returns { accent, lines }: each line has line (its place among the lines given, from 1), text, phrase (the notes it",
    "is sung on), syllables (in the pronunciation that fits best), noteCount, score (0–1, 1 = zero issues) and issues",
    "(problem and fix in plain words); a line fits when its issues list is empty. Place a line's syllables on its phrase with",
    "set_lyrics_to_melody.",
  ].join(" "),
  input: {
    lines: z.array(z.string()).min(1).describe("The sung lines, in order."),
    notes: NotesInput.min(1).describe("The melody, in beats from the start of the stretch."),
    lengthBeats: z.number().positive().describe("How long the stretch the melody fills is, in beats."),
    timeSignature: TimeSignatureInput.optional(),
    accent: AccentInput,
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const accent = input.accent ?? defaults.accent;
    const signature = requireTimeSignature(input.timeSignature ?? defaults.timeSignature);
    const analyzer = LineAnalyzer.for(accent);
    // A label or a blank line is analysed as empty text, so only sung lines get a phrase.
    const lines = input.lines.map((text) => ({ text, analysis: analyzer.analyze(LyricsText.isSung(text) ? text : "") }));
    const fitter = new MelodyFitter(new Meter(signature.numerator, signature.denominator));
    return {
      accent,
      lines: fitter.fit(lines, input.notes, input.lengthBeats).map(({ index, ...line }) => ({ line: index + 1, ...line })),
    };
  },
});
