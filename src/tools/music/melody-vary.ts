import { z } from "zod";
import { MelodyVariation } from "../../music/melody/melody-plan";
import { MusicalKey } from "../../music/harmony/musical-key";
import { varyMelodyWithSelection } from "../../music/melody/melody-varier";
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
    "Inputs: notes (the complete material to preserve); how; seed (optional, same seed, same variation); sourceIndices (optional zero-based positions in that original input) selects one unmuted melody line. Without selection all unmuted notes must form one line: simultaneous or near-simultaneous attacks are refused rather than choosing the highest voice. Intentional legato overlaps remain valid.",
    "Returns { notes, selectedSourceIndices, preservedSourceIndices }: notes is the complete supplied material with the selected line varied; every unselected and muted note retains its original fields. Indices refer to the original input, not the time-sorted returned notes. For a polyphonic clip supply its full note list and choose indices, so applying this result preserves the other voices. Duplicate, out-of-range or muted selections are refused, as are variations producing pitches outside MIDI 0–127 rather than silently clamping the contour. No notes are written by this tool.",
  ].join(" "),
  input: {
    notes: NotesInput.min(1).describe("The melody to vary."),
    how: z.enum(MelodyVariation).describe("What to vary."),
    seed: SeedInput,
    sourceIndices: z.array(z.number().int().min(0)).min(1).optional().describe("Zero-based original input note indices for one intended melody line; all other notes are preserved."),
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run({ notes, how, seed, timeSignature, sourceIndices }, ctx) {
    const defaults = await songDefaults(ctx);
    const signature = how === MelodyVariation.Rhythm
      ? requireTimeSignature(timeSignature ?? defaults.timeSignature)
      : timeSignature ?? defaults.timeSignature;
    const key = defaults.key ? MusicalKey.from(defaults.key) : undefined;
    return varyMelodyWithSelection(notes, how, seed, signature ? new Meter(signature.numerator, signature.denominator) : undefined, key, sourceIndices);
  },
});
