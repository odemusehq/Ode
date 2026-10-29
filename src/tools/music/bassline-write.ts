import { z } from "zod";
import { bassline, BassStyle } from "../../music/rhythm/bassline-writer";
import { defineTool } from "../define";
import { ChordsInput, NotesInput, SeedInput, TimeSignatureInput } from "./schemas";
import { quarterBeatsPerBar, songDefaults } from "./song-defaults";

export const basslineWriteTool = defineTool({
  name: "bassline_write",
  description: [
    "Writes a bassline as MIDI notes that follows the chords and locks with the kick drum.",
    'Styles: "root" (root notes on the chord changes and kick hits), "root-fifth" (root and fifth on beats 1 and 3),',
    '"octave" (eighth-note octaves), "walking" (quarter notes through chord tones with an approach note into each',
    'chord), "syncopated" (kick-locked notes, anticipations of the next chord, ghost notes), "808" (long sub-bass notes',
    'on the kick hits with slides written as overlapping notes; set the instrument to glide on legato notes) and',
    '"arpeggio" (chord tones up and down in eighths). Slash chords put their bass note in the bassline.',
    "Use it after the chords and drums exist; pass the drum notes so the bass locks with the kick (MIDI note 36).",
    "Inputs: chords (events from beat 0); kick (optional drum or kick notes); style; seed (optional).",
    "Returns { style, notes }: notes in bass range (E1–G3; C1–D3 for 808) from beat 0.",
  ].join(" "),
  input: {
    chords: ChordsInput.min(1),
    kick: NotesInput.optional().describe("Kick drum notes, or the whole drum clip (kick = MIDI note 36)."),
    style: z.enum(BassStyle).describe("Bass style."),
    seed: SeedInput,
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run({ chords, kick, style, seed, timeSignature }, ctx) {
    const barBeats = quarterBeatsPerBar(timeSignature ?? (await songDefaults(ctx)).timeSignature);
    return { style, notes: bassline(chords, kick ?? [], style, seed, barBeats) };
  },
});
