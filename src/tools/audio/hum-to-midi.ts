import { z } from "zod";
import { GridDivision, HumTranscriber, decode } from "../../music/audio";
import { notConfiguredMessage } from "../../services/roles";
import { defineTool } from "../define";
import { TrackRefSchema } from "../live/schemas";
import { ArrangementAudio, requireRange } from "./arrangement-audio";
import { rounded } from "./report";
import type { MusicalKey } from "../../music/audio";
import type { Transcript } from "../../services/types";
import type { Note } from "../../shared/live";
import type { SongInfo } from "../../shared/live-ops";
import { NOTE_NAMES } from "../../shared/notes";
import type { ToolContext } from "../define";

const SECONDS_PER_MINUTE = 60;
/** A sung word may start up to a sixteenth note before the quantised note it belongs to, beats. */
const WORD_LEAD_BEATS = 0.25;
/** Decimal places for word timings, beats. */
const WORD_TIME_DIGITS = 3;
/** Grid names as Live shows them. */
const GRID_NAMES: Readonly<Record<GridDivision, string>> = {
  [GridDivision.Eighth]: "1/8",
  [GridDivision.Sixteenth]: "1/16",
};

interface SungWords {
  text: string;
  lines: { text: string; start: number | null; end: number | null; notes: number[] }[];
}

export const humToMidiTool = defineTool({
  name: "hum_to_midi",
  description: [
    "Turns a hummed, sung or whistled idea recorded on an Arrangement audio track into MIDI notes, and optionally the sung words.",
    "Use it when the musician records a melody, bassline or riff with their voice and wants it as MIDI.",
    "It renders the track's audio for the beat range, tracks the pitch, corrects the singer's overall tuning, starts a new note where the pitch settles on a new value or a new syllable begins, joins fragments of the same note, snaps pitches to the Set's key when Live's Scale Mode is on, fits the rhythm to the song's tempo on an eighth- or sixteenth-note grid (whichever fits the performance with less error for its complexity), and sets each note's velocity from how loud it was sung.",
    "Inputs: `track` (the audio track holding the recording), `start` and `end` (the recording's range in the Arrangement, in beats), `withWords` (true to also transcribe sung words).",
    "Returns { notes: [{ pitch, start, duration, velocity }] with times in beats from `start`, suggestedClip: { start, length } (where a MIDI clip lines up with the recording), tempo, key (the key the pitches were snapped to, or null), grid (\"1/8\" or \"1/16\", the grid the rhythm was fitted to), tuningOffsetCents (how sharp or flat the singer was overall, already corrected), words?: { text, lines: [{ text, start, end, notes }] } with line times in beats from `start` and the indexes of the notes each line covers, wordsNote? (why words are missing) }.",
    "The notes are a draft: show them to the musician before creating a clip. Changes nothing.",
  ].join(" "),
  input: {
    track: TrackRefSchema.describe("Arrangement audio track holding the hummed or sung recording."),
    start: z.number().min(0).describe("Start of the recording in the Arrangement, in beats."),
    end: z.number().min(0).describe("End of the recording in the Arrangement, in beats."),
    withWords: z.boolean().optional().describe("Also transcribe the sung words and match them to the notes."),
  },
  changes: "none",
  async run(input, ctx) {
    requireRange(input.start, input.end);
    const arrangement = new ArrangementAudio(ctx);
    const lookup = await arrangement.resolve(input.track);
    if ("skipped" in lookup) throw new Error(`cannot read a recording from ${lookup.skipped.track}: ${lookup.skipped.reason}`);
    const song = await arrangement.song();
    const key: MusicalKey | undefined = song.scaleMode ? { root: song.rootNote, intervals: song.scaleIntervals } : undefined;
    return arrangement.withRender(lookup.track.ref, input.start, input.end, async (path) => {
      const transcription = new HumTranscriber(song.tempo, key).analyze(await decode(path));
      const result = {
        notes: transcription.notes,
        suggestedClip: { start: input.start, length: input.end - input.start },
        tempo: song.tempo,
        key: key ? keyName(song) : null,
        grid: GRID_NAMES[transcription.grid],
        tuningOffsetCents: rounded(transcription.tuningOffsetCents, 0),
      };
      return input.withWords ? { ...result, ...(await transcribeWords(ctx, path, transcription.notes, song.tempo)) } : result;
    });
  },
});

function keyName(song: SongInfo): string {
  const pitchClass = ((song.rootNote % NOTE_NAMES.length) + NOTE_NAMES.length) % NOTE_NAMES.length;
  return `${NOTE_NAMES[pitchClass] ?? ""} ${song.scaleName}`.trim();
}

async function transcribeWords(
  ctx: ToolContext,
  path: string,
  notes: Note[],
  tempo: number,
): Promise<{ words: SungWords } | { wordsNote: string }> {
  if (!(await ctx.services.available()).transcription) {
    return { wordsNote: `Words were not transcribed (${notConfiguredMessage("transcription")}); the notes are complete.` };
  }
  try {
    return { words: matchWords(await ctx.services.transcribe(path), notes, tempo) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { wordsNote: `Words were not transcribed (${message}); the notes are complete.` };
  }
}

/** Transcript lines with times in beats and the indexes of the notes that start within each line. */
function matchWords(transcript: Transcript, notes: Note[], tempo: number): SungWords {
  const beatsPerSecond = tempo / SECONDS_PER_MINUTE;
  return {
    text: transcript.text,
    lines: transcript.turns.map((turn) => {
      const start = turn.start * beatsPerSecond;
      const end = turn.end * beatsPerSecond;
      const covered = notes.flatMap((note, index) => (note.start >= start - WORD_LEAD_BEATS && note.start < end ? [index] : []));
      return { text: turn.text, start: rounded(start, WORD_TIME_DIGITS), end: rounded(end, WORD_TIME_DIGITS), notes: covered };
    }),
  };
}
