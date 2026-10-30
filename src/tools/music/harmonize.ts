import { z } from "zod";
import { Harmonizer } from "../../music/harmony/harmonizer";
import { KeyFinder } from "../../music/harmony/key-finder";
import { MusicalKey } from "../../music/harmony/musical-key";
import { defineTool } from "../define";
import { KeyInput, NotesInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";

const MAX_PROGRESSIONS = 8;
const MAX_HARMONIC_RHYTHM_BEATS = 16;

export const harmonizeTool = defineTool({
  name: "harmonize",
  description: [
    "Suggests chord progressions for a melody. Candidate chords are the key's triads and sevenths, borrowed iv, bIII, bVI",
    "and bVII, secondary dominants (V/ii, V/IV, V/V, V/vi) and sus2, sus4 and add9 colours, weighted by style; each",
    "sequence is scored on fit with the melody, normal chord movement, cadences at phrase ends, variety and the artist's",
    "favoured chords, and the k best are returned.",
    "Use it to harmonise a topline or reharmonise a section; voice the chosen progression with voice_chords.",
    "This functional vocabulary requires the actual pitch set to match one of the seven diatonic modes. Nonmodal names such as Harmonic Minor or Whole Tone and other custom sets still work for melody and pitch checks; choose their harmony through an explicit chord chart with voice_chords or direct MIDI. A custom label with modal intervals uses those authoritative intervals. Borrowed and secondary chromatic chords remain intentional candidates within the supported modal vocabulary.",
    "Inputs: melody (notes); key (optional, defaults to Live's key when Scale Mode is on, else found from the melody); k (how many",
    "progressions, default 3); style (genre or style such as pop, rock, jazz, soul, folk; defaults to the genre setting);",
    "Without an explicit or observed key, inference needs pitched active notes; muted/probability-zero notes do not establish one. For a new draft choose its key explicitly from the musical brief rather than calling an empty input C major.",
    "harmonicRhythmBeats (beats per chord, default one bar); favour (Roman numerals or chord symbols the artist likes);",
    "timeSignature (optional).",
    'Returns { key, progressions }: each progression has chords (events { beat, lengthBeats, symbol } from beat 0) and',
    'romans (Roman numerals, e.g. "IV", "V7/vi", "bVII").',
  ].join(" "),
  input: {
    melody: NotesInput.min(1).describe("The melody to harmonise."),
    key: KeyInput.optional(),
    k: z.number().int().min(1).max(MAX_PROGRESSIONS).optional().describe("How many progressions to return."),
    style: z.string().optional().describe("Genre or style."),
    harmonicRhythmBeats: z.number().positive().max(MAX_HARMONIC_RHYTHM_BEATS).optional().describe("Beats per chord."),
    favour: z.array(z.string()).optional().describe("Chords the artist likes, as Roman numerals or symbols."),
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const keySpec = input.key ?? defaults.key ?? new KeyFinder().find([], input.melody).spec;
    const key = MusicalKey.from(keySpec);
    const progressions = new Harmonizer(key, {
      k: input.k,
      style: input.style ?? defaults.genre ?? undefined,
      harmonicRhythmBeats: input.harmonicRhythmBeats,
      signature: requireTimeSignature(input.timeSignature ?? defaults.timeSignature),
      favour: input.favour,
    }).progressions(input.melody);
    return { key: { ...key.spec, name: key.label }, progressions };
  },
});
