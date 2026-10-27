import { z } from "zod";
import { KeyFinder } from "../../music/harmony/key-finder";
import { MusicalKey } from "../../music/harmony/musical-key";
import { Contour, MAX_DENSITY, MIN_DENSITY, Register, type MelodyPlan } from "../../music/melody/melody-plan";
import { writeMelody } from "../../music/melody/melody-writer";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import type { Note } from "../../shared/live";
import { TYPICAL_VOCAL_RANGE } from "../../shared/personalisation";
import type { ChordEvent } from "../../shared/song";
import { defineTool } from "../define";
import { ChordsInput, KeyInput, RangeInput, SeedInput, TimeSignatureInput } from "./schemas";
import { quarterBeatsPerBar, songDefaults } from "./song-defaults";

const MAX_BARS = 64;
const MAX_MOTIF_BARS = 8;

/** The chords sounding inside a stretch of beats, moved so the stretch starts at beat 0. */
function chordsBetween(chords: ChordEvent[], start: number, length: number): ChordEvent[] {
  const end = start + length;
  return chords
    .filter((chord) => chord.beat < end && chord.beat + chord.lengthBeats > start)
    .map((chord) => {
      const from = Math.max(chord.beat, start);
      const to = Math.min(chord.beat + chord.lengthBeats, end);
      return { beat: from - start, lengthBeats: to - from, symbol: chord.symbol };
    });
}

export const melodyWriteTool = defineTool({
  name: "melody_write",
  description: [
    "Writes a melody (topline) as MIDI notes from a plan described in words. The code places the notes: stressed",
    "syllables and chord tones on strong beats, mostly stepwise motion, leaps followed by a step back, a motif repeated",
    "and varied, inside the singer's range. Use register \"high\" for a chorus so it sits above its verse.",
    "Use it to draft toplines or instrumental hooks; check sung lines with prosody_check and singability_check, then write",
    "the notes into a clip with the MIDI tools.",
    "Inputs: bars; contour (rising, falling, arch, valley, wave, static); register (low, mid, high within the range);",
    "density (notes per beat, 0.5–4); motifBars (optional length of the repeated motif); chords (optional chord events",
    "to fit, from beat 0); lyrics (optional lines to set, each line gets an equal share of the bars and its syllables",
    "decide the note count); range (optional MIDI low/high, defaults to the artist's vocal range); key (optional, defaults",
    "to the song's key or the chords' key); timeSignature (optional); seed (same seed, same melody).",
    "Returns { notes, key, range, beatsPerBar }: notes start at beat 0 of the clip.",
  ].join(" "),
  input: {
    bars: z.number().int().min(1).max(MAX_BARS).describe("Length in bars."),
    contour: z.enum(Contour).describe("Overall shape of the line."),
    register: z.enum(Register).describe("Where the melody sits in the range."),
    density: z.number().min(MIN_DENSITY).max(MAX_DENSITY).describe("Notes per beat."),
    motifBars: z.number().int().min(1).max(MAX_MOTIF_BARS).optional().describe("Bars per motif statement."),
    chords: ChordsInput.optional(),
    lyrics: z.array(z.string()).optional().describe("Lyric lines to set to the melody."),
    range: RangeInput.optional(),
    key: KeyInput.optional(),
    timeSignature: TimeSignatureInput.optional(),
    seed: SeedInput,
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const beatsPerBar = quarterBeatsPerBar(input.timeSignature ?? defaults.timeSignature);
    const range = input.range ?? defaults.vocalRange ?? TYPICAL_VOCAL_RANGE;
    const chords = input.chords ?? [];
    const key = input.key ?? defaults.key ?? new KeyFinder().find(chords).spec;
    const plan: MelodyPlan = {
      bars: input.bars,
      beatsPerBar,
      contour: input.contour,
      register: input.register,
      density: input.density,
      motifBars: input.motifBars,
      seed: input.seed,
      key,
    };
    const lines = (input.lyrics ?? []).map((line) => line.trim()).filter((line) => line.length > 0);
    const notes: Note[] = [];
    if (lines.length === 0) {
      notes.push(...writeMelody(plan, chords, range));
    } else {
      const barsPerLine = Math.max(1, Math.floor(input.bars / lines.length));
      let barOffset = 0;
      lines.forEach((text, index) => {
        const lineBars = index === lines.length - 1 ? Math.max(1, input.bars - barOffset) : barsPerLine;
        const offset = barOffset * beatsPerBar;
        const lineChords = chordsBetween(chords, offset, lineBars * beatsPerBar);
        const written = writeMelody({ ...plan, bars: lineBars }, lineChords, range, analyzeLine(text, defaults.accent));
        notes.push(...written.map((note) => ({ ...note, start: note.start + offset })));
        barOffset += lineBars;
      });
    }
    return { notes, key: { ...key, name: MusicalKey.from(key).label }, range, beatsPerBar };
  },
});
