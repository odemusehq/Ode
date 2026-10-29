import { z } from "zod";
import { PartChecker } from "../../music/parts/part-checker";
import { Meter } from "../../music/prosody/meter";
import { MIDI_MAX } from "../../shared/notes";
import { defineTool } from "../define";
import { ChordsInput, KeyInput, NotesInput, RangeInput, TimeSignatureInput } from "./schemas";
import { songDefaults } from "./song-defaults";

const MAX_LEAP = 48;

export const notesCheckTool = defineTool({
  name: "notes_check",
  description: [
    "Checks the notes of a part (melody, bassline, chords, drums) and lists exactly what is wrong: notes outside the key;",
    "notes outside a range; notes on strong beats (beats 1 and 3 in 4/4, beat 1 in 3/4 and 6/8) that aren't in the chord",
    "sounding there; onsets that don't line up with another part, such as the kick; notes with no Drum Rack pad; and leaps",
    "wider than a limit. It also gives the lowest, highest and average pitch, to compare how high two sections sit.",
    "Use it after changing notes, on the clip's notes as they are now (midi_clip_get_notes), and fix what it lists before",
    "reporting; only the checks whose inputs you give run (the key check uses Live's key when key is left out and Scale Mode is on).",
    "Inputs: notes; key (optional); range or vocal (true checks the singer's vocal range setting); chords (events in",
    "the same beats as the notes); lockTo with lockPitch (the other part's notes, and the one pitch of them to use, such as",
    "36 for a Drum Rack kick); pads (the Drum Rack's pad notes, from device_get); maxLeap (semitones); timeSignature.",
    "Returns { notes, lowest, highest, averagePitch, key, range, chordTones, lock, pads, leaps, passed }: notes are given",
    "as { beat, pitch (Live's name, C3 = MIDI 60), midi }; lock lists the beats that are apart and the other part's",
    "beats with no note; passed is true when every check that ran found nothing. Changes nothing.",
  ].join(" "),
  input: {
    notes: NotesInput.min(1).describe("The part's notes."),
    key: KeyInput.optional(),
    range: RangeInput.optional(),
    vocal: z.boolean().optional().describe("Check against the singer's vocal range setting (when range is left out)."),
    chords: ChordsInput.optional(),
    lockTo: NotesInput.optional().describe("Notes of the part to line up with, in the same beats."),
    lockPitch: z.number().int().min(0).max(MIDI_MAX).optional().describe("Only this pitch of lockTo counts, such as 36 for the kick."),
    pads: z.array(z.number().int().min(0).max(MIDI_MAX)).optional().describe("The Drum Rack's pad notes."),
    maxLeap: z.number().int().min(1).max(MAX_LEAP).optional().describe("List leaps wider than this many semitones."),
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const signature = input.timeSignature ?? defaults.timeSignature;
    const key = input.key ?? defaults.key;
    const lockTo = input.lockTo?.filter((note) => input.lockPitch === undefined || note.pitch === input.lockPitch);
    const check = new PartChecker(new Meter(signature.numerator, signature.denominator)).check(input.notes, {
      key,
      range: input.range ?? (input.vocal ? defaults.vocalRange : null),
      chords: input.chords,
      lockTo,
      pads: input.pads,
      maxLeap: input.maxLeap,
    });
    return key ? check : { ...check, keyNote: "No key given and Scale Mode is off in Live: pass the key from the project map." };
  },
});
