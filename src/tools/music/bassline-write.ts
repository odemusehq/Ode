import { z } from "zod";
import { bassline, BassStyle } from "../../music/rhythm/bassline-writer";
import { DrumNote } from "../../music/rhythm/drum-kit";
import { MIDI_MAX } from "../../shared/notes";
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
    "Use it after the chords and drums exist; pass the drum notes so the bass follows the kick's exact onset times, including off-grid feel. kickPitch defaults to MIDI 36; give the actual mapped pitch for a custom Drum Rack. Other pitches, muted notes and probability 0 notes are ignored; conditional kicks remain potential triggers, not guaranteed playback events. No reference timing is quantized. Chord-change attacks and the chosen style's deliberate subdivisions/anticipations remain.",
    "Inputs: chords (events from beat 0); kick (optional drum notes); kickPitch (optional); style; seed (optional).",
    "NC/N.C. emits no bass in that span; approaches only lead into a contiguous following pitched chord, never across a gap or no-chord stop. Unsupported symbols and overlapping chord events refuse instead of dropping or guessing them.",
    "Returns { style, kickPitch, notes }: notes in bass range (E1–G3; C1–D3 for 808) from beat 0.",
  ].join(" "),
  input: {
    chords: ChordsInput.min(1),
    kick: NotesInput.optional().describe("Drum notes; only the selected kickPitch contributes reference onsets."),
    kickPitch: z.number().int().min(0).max(MIDI_MAX).optional().describe("Actual kick pad MIDI pitch; defaults to 36. Other pitches are never guessed as kicks."),
    style: z.enum(BassStyle).describe("Bass style."),
    seed: SeedInput,
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run({ chords, kick, kickPitch, style, seed, timeSignature }, ctx) {
    const barBeats = style === BassStyle.RootFifth || style === BassStyle.EightOhEight
      ? quarterBeatsPerBar(timeSignature ?? (await songDefaults(ctx)).timeSignature)
      : undefined;
    return { style, kickPitch: kickPitch ?? DrumNote.Kick, notes: bassline(chords, kick ?? [], style, seed, barBeats, kickPitch) };
  },
});
