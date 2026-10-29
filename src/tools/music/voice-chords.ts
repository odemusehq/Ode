import { z } from "zod";
import { ChordVoicer, DEFAULT_VOICING_REGISTER } from "../../music/harmony/chord-voicer";
import { defineTool } from "../define";
import { ChordsInput, RangeInput } from "./schemas";

const MIN_VOICES = 3;
const MAX_VOICES = 4;

export const voiceChordsTool = defineTool({
  name: "voice_chords",
  description: [
    "Drafts sustained simultaneous chord voicings as MIDI notes for keys or pads: 3–4 upper voices inside a register",
    "with smooth voice leading (least movement between chords, wide spacing low down, few parallel fifths and octaves),",
    "plus a bass note that uses roots and inversions for a smooth bass line.",
    "Use it to turn a chord chart into a playable part; write the notes into a clip with the MIDI tools.",
    `Inputs: chords (events from beat 0); register (optional MIDI low/high for the upper voices, default E3–G5,`,
    "MIDI 52–79); voices (optional 3 or 4); bass (optional, default true).",
    'Returns { notes, voicings }: voicings lists each chord\'s symbol (with "/bass" added when an inversion was chosen),',
    "beat, length, bass note and upper pitches.",
  ].join(" "),
  input: {
    chords: ChordsInput.min(1),
    register: RangeInput.optional(),
    voices: z.number().int().min(MIN_VOICES).max(MAX_VOICES).optional().describe("Upper voices per chord."),
    bass: z.boolean().optional().describe("Add a bass note under each chord."),
  },
  changes: "none",
  async run({ chords, register, voices, bass }) {
    return new ChordVoicer(register ?? DEFAULT_VOICING_REGISTER, { voices, bass }).voice(chords);
  },
});
