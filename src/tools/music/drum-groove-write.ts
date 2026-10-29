import { z } from "zod";
import { drumMap } from "../../music/rhythm/drum-kit";
import { drumGroove, SectionFeel } from "../../music/rhythm/drum-groove-writer";
import { ALL_GENRES, isKnownGenre, parseGenre } from "../../music/rhythm/genre";
import { SECTION_KINDS } from "../../shared/song";
import { defineTool } from "../define";
import { MAX_BARS, SeedInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";


export const drumGrooveWriteTool = defineTool({
  name: "drum_groove_write",
  description: [
    "Writes a drum groove as MIDI notes for a Drum Rack (36 kick, 38 snare, 39 clap, 42 closed hi-hat, 46 open hi-hat,",
    "49 crash, 51 ride, 45/47/48 low/mid/high toms), in 4/4.",
    `Genres: ${ALL_GENRES.join(", ")} (close relatives such as disco or drill map to the nearest one).`,
    "The section sets the intensity: sparse intros and quiet verses, full choruses and drops with a crash on the",
    "downbeat, half-time bridges, breakdowns without kick, builds with a snare roll that speeds up, an outro ending on",
    "a single hit; most sections end with a fill (tom run, snare roll, hi-hat roll, percussion pickup or a drop-out).",
    "Velocities and timing are humanised and swung where the genre swings.",
    "Inputs: genre (optional, defaults to the genre setting, else pop); section (intro, verse, pre-chorus, chorus,",
    "post-chorus, bridge, breakdown, build, drop, outro, other); bars; energy (0–1, how hard the section hits); seed.",
    "Returns { genre, recognised, section, notes, drumMap }: recognised is false when the genre name was unknown and",
    "pop was used; notes start at beat 0.",
  ].join(" "),
  input: {
    genre: z.string().optional().describe("Genre name."),
    section: z.enum(SECTION_KINDS).describe("Song section the groove is for."),
    bars: z.number().int().min(1).max(MAX_BARS).describe("Length in bars."),
    energy: z.number().min(0).max(1).describe("Intensity from 0 (gentle) to 1 (full)."),
    seed: SeedInput,
    timeSignature: TimeSignatureInput.optional(),
    feel: z.enum(SectionFeel).optional().describe("Override the template feel, e.g. main to retain a bridge's pulse instead of half time."),
    padMap: z.array(z.object({ from: z.number().int().min(0).max(127), to: z.number().int().min(0).max(127) })).optional().describe("Explicit GM-note to inspected Drum Rack pad mapping; must cover each generated drum."),
  },
  changes: "none",
  async run({ genre, section, bars, energy, seed, timeSignature, feel, padMap }, ctx) {
    const defaults = await songDefaults(ctx);
    const signature = requireTimeSignature(timeSignature ?? defaults.timeSignature);
    if (signature.numerator !== 4 || signature.denominator !== 4) throw new Error("This drum helper supports 4/4 only; write an intentional pattern with the MIDI tools for this meter.");
    const name = genre ?? defaults.genre;
    const notes = drumGroove(name ?? "", section, bars, energy, seed, feel);
    const mapping = new Map(padMap?.map(({ from, to }) => [from, to]));
    if (padMap && notes.some((note) => !mapping.has(note.pitch))) throw new Error("The supplied padMap is missing a generated drum; inspect the actual kit and map every used drum note.");
    return {
      genre: parseGenre(name),
      recognised: isKnownGenre(name),
      section,
      notes: notes.map((note) => ({ ...note, pitch: mapping.get(note.pitch) ?? note.pitch })),
      drumMap: Object.fromEntries(Object.entries(drumMap()).filter(([, pitch]) => !padMap || mapping.has(pitch)).map(([name, pitch]) => [name, mapping.get(pitch) ?? pitch])),
      note: "A 4/4 template draft with humanized timing/velocity, not a new groove concept per seed. GM pads are assumptions unless mapped; check the actual kit and vocal gaps before placement.",
    };
  },
});
