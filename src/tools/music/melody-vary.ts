import { z } from "zod";
import { MelodyVariation } from "../../music/melody/melody-plan";
import { MusicalKey } from "../../music/harmony/musical-key";
import { varyMelody } from "../../music/melody/melody-varier";
import { Meter } from "../../music/prosody/meter";
import { defineTool } from "../define";
import { NotesInput, SeedInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";

export const melodyVaryTool = defineTool({
  name: "melody_vary",
  description: [
    "Makes a variation of a melody that keeps its identity, for a second verse, a final chorus or an answer phrase.",
    'how: "rhythm" (same pitches; some notes anticipated by an eighth, even pairs made dotted), "contour" (melodic',
    'inversion by scale steps around the first note), "ending" (resolves an open ending to the tonic, or moves an ending on',
    'the tonic to the third or fifth to leave it open, approached by step and held longer) or "ornament" (passing tones across leaps and a',
    "neighbour-note turn on long notes).",
    "Inputs: notes (the melody); how; seed (optional, same seed, same variation).",
    "Returns { notes }: the varied melody, starting where the original started.",
  ].join(" "),
  input: {
    notes: NotesInput.min(1).describe("The melody to vary."),
    how: z.enum(MelodyVariation).describe("What to vary."),
    seed: SeedInput,
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run({ notes, how, seed, timeSignature }, ctx) {
    const defaults = await songDefaults(ctx);
    const signature = how === MelodyVariation.Rhythm
      ? requireTimeSignature(timeSignature ?? defaults.timeSignature)
      : timeSignature ?? defaults.timeSignature;
    const key = defaults.key ? MusicalKey.from(defaults.key) : undefined;
    return { notes: varyMelody(notes, how, seed, signature ? new Meter(signature.numerator, signature.denominator) : undefined, key) };
  },
});
