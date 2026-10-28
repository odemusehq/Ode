import { z } from "zod";
import { drumMap } from "../../music/rhythm/drum-kit";
import { drumGroove } from "../../music/rhythm/drum-groove-writer";
import { ALL_GENRES, isKnownGenre, parseGenre } from "../../music/rhythm/genre";
import { SECTION_KINDS } from "../../shared/song";
import { defineTool } from "../define";
import { SeedInput } from "./schemas";
import { songDefaults } from "./song-defaults";

const MAX_BARS = 64;

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
    "Returns { genre, recognised, section, notes, drumMap }: recognised is false when the genre name was not known and",
    "pop was used; notes start at beat 0.",
  ].join(" "),
  input: {
    genre: z.string().optional().describe("Genre name."),
    section: z.enum(SECTION_KINDS).describe("Song section the groove is for."),
    bars: z.number().int().min(1).max(MAX_BARS).describe("Length in bars."),
    energy: z.number().min(0).max(1).describe("Intensity from 0 (gentle) to 1 (full)."),
    seed: SeedInput,
  },
  changes: "none",
  async run({ genre, section, bars, energy, seed }, ctx) {
    const name = genre ?? (await songDefaults(ctx)).genre;
    return {
      genre: parseGenre(name),
      recognised: isKnownGenre(name),
      section,
      notes: drumGroove(name ?? "", section, bars, energy, seed),
      drumMap: drumMap(),
    };
  },
});
