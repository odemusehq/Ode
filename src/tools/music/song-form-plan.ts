import { z } from "zod";
import { SongFormPlanner } from "../../music/form/song-form-planner";
import { Genre, parseGenre } from "../../music/rhythm/genre";
import { defineTool } from "../define";
import { DEFAULT_TEMPO, quarterBeatsPerBar, songDefaults } from "./song-defaults";

const MIN_TEMPO = 40;
const MAX_TEMPO = 300;
const MAX_PHRASE_BARS = 16;
/** Club genres are built in 8-bar phrases, most others in 4-bar phrases. */
const EIGHT_BAR_GENRES: ReadonlySet<Genre> = new Set([Genre.House, Genre.Techno, Genre.DrumAndBass]);
const LONG_PHRASE_BARS = 8;
const SHORT_PHRASE_BARS = 4;

export const songFormPlanTool = defineTool({
  name: "song_form_plan",
  description: [
    "Plans a song form: the genre's typical sections (intro, verses, pre-choruses, choruses or hooks, bridge,",
    "breakdowns, builds, drops, outro) with start beats and lengths, trimmed or extended so the song lasts about as long",
    "as songs in that genre at the tempo (club genres get long intros and outros).",
    "Use it when starting a song's arrangement; create locators or clips from the result with the Live tools and keep",
    "it in the lead sheet.",
    "Inputs: genre (optional, defaults to the song's genre, else pop); tempo (optional BPM, defaults to the song's);",
    "phraseBars (optional bars per phrase, default 8 for house, techno and drum and bass, else 4); beatsPerBar",
    "(optional quarter-note beats per bar, defaults to the song's time signature, 4/4 if unknown).",
    "Returns { genre, tempo, sections, totalBars, seconds }: sections follow the lead sheet's Section shape",
    "(id, kind, name, startBeat, lengthBeats, empty lines and chords).",
  ].join(" "),
  input: {
    genre: z.string().optional().describe("Genre name."),
    tempo: z.number().min(MIN_TEMPO).max(MAX_TEMPO).optional().describe("Tempo in BPM."),
    phraseBars: z.number().int().min(1).max(MAX_PHRASE_BARS).optional().describe("Bars per phrase."),
    beatsPerBar: z.number().positive().optional().describe("Quarter-note beats per bar (4 in 4/4, 3 in 3/4 or 6/8)."),
  },
  changes: "none",
  async run(input, ctx) {
    const defaults = await songDefaults(ctx);
    const genre = parseGenre(input.genre ?? defaults.genre);
    const tempo = input.tempo ?? defaults.tempo ?? DEFAULT_TEMPO;
    const phraseBars = input.phraseBars ?? (EIGHT_BAR_GENRES.has(genre) ? LONG_PHRASE_BARS : SHORT_PHRASE_BARS);
    const beatsPerBar = input.beatsPerBar ?? quarterBeatsPerBar(defaults.timeSignature);
    const plan = new SongFormPlanner().plan(genre, tempo, phraseBars, beatsPerBar);
    return { genre, tempo, ...plan };
  },
});
