import { z } from "zod";
import { LyricsText } from "../../mneme/lyrics-text";
import { validateMelodyPhrases } from "../../music/melody/lyric-phrases";
import { LineAnalyzer } from "../../music/phonetics/line-analyzer";
import { MelodyFitter } from "../../music/prosody/melody-fitter";
import { Meter } from "../../music/prosody/meter";
import { defineTool } from "../define";
import { MelodyPhraseInput, describeSyllables } from "./line-on-notes";
import { AccentInput, NotesInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";

export const lyricsFitMelodyTool = defineTool({
  name: "lyrics_fit_melody",
  description: [
    "Fits lyric lines to a melody, one phrase per line: the melody is cut at its longest rests into as many phrases as",
    "there are lines (into stretches of whole bars when it has too few rests, the last one running to the end), then",
    "each line is set to its phrase and checked for prosody.",
    "Use it to check a section's lyrics against its melody line by line, before and after changing either;",
    "it splits the melody into phrases for you unless explicit phrases are supplied.",
    "Inputs: lines (the sung lines in order; labels such as \"[Chorus]\" and blank lines are left out); notes (the melody",
    "as read from the MIDI clip, in beats from the start of the stretch; chords are reduced to their top note);",
    "lengthBeats (how long the stretch is, in beats); phrases (optional {line,startBeat,lengthBeats} clip-relative spans for unequal phrases/pickups; these override inferred cuts); beatOffset (optional metrical position of clip zero); timeSignature (optional, defaults to Live's); accent (optional).",
    "Returns { accent, lines }: each line has line (its place among the lines given, from 1), text, phrase (the notes it",
    "is sung on), syllables (in the pronunciation that fits best), noteCount, score (0–1, 1 = zero issues) and issues",
    "(problem and fix in plain words); a line fits when its issues list is empty. Place a line's syllables on its phrase with",
    "set_lyrics_to_melody. Each line also retains notes (the adjusted setting), syllableDetails and alignment (indices into that line's notes), so a later stage need not guess the setting again. phrase remains the original notes. Explicit spans refuse notes held across their boundary rather than silently cutting them; unassignedNotes reports source notes outside sung spans. These are advisory prosody checks, not a reason to erase intentional phrasing.",
  ].join(" "),
  input: {
    lines: z.array(z.string()).min(1).describe("The sung lines, in order."),
    notes: NotesInput.min(1).describe("The melody, in beats from the start of the stretch."),
    lengthBeats: z.number().positive().describe("How long the stretch the melody fills is, in beats."),
    phrases: z.array(MelodyPhraseInput.omit({ motifId: true, hookId: true })).min(1).optional(),
    beatOffset: z.number().optional().describe("Metrical position of the stretch's beat zero, in quarter-note beats."),
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
    // Meter offsets affect the check; source and returned notes retain their clip coordinates.
    const offset = input.beatOffset ?? 0;
    const meter = new Meter(signature.numerator, signature.denominator, offset);
    const fitter = new MelodyFitter(meter);
    const describe = ({ index, ...line }: ReturnType<MelodyFitter["fit"]>[number]) => ({ ...line, line: index + 1, syllableDetails: describeSyllables(line.syllableDetails) });
    if (input.phrases) {
      if (lines.some((line) => line.analysis.words.length === 0)) throw new Error("Explicit phrase lines must address sung lines only; leave out labels and blank lines.");
      validateMelodyPhrases(input.phrases, lines.length, input.lengthBeats);
      const assigned = new Set<number>();
      const fitted = input.phrases.map((span) => {
        if (input.notes.some((note) => !note.muted && note.start < span.startBeat - 1e-6 && note.start + note.duration > span.startBeat + 1e-6)) {
          throw new Error(`A held note crosses into lyric line ${span.line}'s declared entrance; revise the span or the note explicitly.`);
        }
        const phrase = input.notes.filter((note, index) => {
          if (note.muted) return false;
          if (note.start < span.startBeat - 1e-6 || note.start >= span.startBeat + span.lengthBeats - 1e-6) return false;
          if (note.start + note.duration > span.startBeat + span.lengthBeats + 1e-6) throw new Error(`A note in lyric line ${span.line} extends past its declared phrase; revise the span or the note explicitly.`);
          assigned.add(index);
          return true;
        });
        const [checked] = fitter.fit([lines[span.line - 1]!], phrase, input.lengthBeats);
        return { ...describe(checked!), ...span };
      });
      return { accent, lines: fitted, unassignedNotes: input.notes.filter((_note, index) => !assigned.has(index)) };
    }
    return {
      accent,
      lines: fitter.fit(lines, input.notes, input.lengthBeats).map(describe),
    };
  },
});
