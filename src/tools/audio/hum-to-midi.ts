import { z } from "zod";
import { GridDivision, HumTranscriber } from "../../music/audio";
import { MusicAudio, type MusicAudioSource } from "../../services/music-audio";
import { RoleCheck } from "../../services/roles";
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
/** Decimal places for word timings, beats. */
const WORD_TIME_DIGITS = 3;
/** Grid names as Live shows them. */
const GRID_NAMES: Readonly<Record<GridDivision, string>> = {
  [GridDivision.Eighth]: "1/8",
  [GridDivision.Sixteenth]: "1/16",
};

interface SungWords {
  text: string;
  detectionSeconds: Transcript["turns"];
  evidence?: Transcript["evidence"];
  lines: { text: string; start: number | null; end: number | null; notes: number[] }[];
}

export const humToMidiTool = defineTool({
  name: "hum_to_midi",
  description: [
    "Turns a hummed, sung or whistled idea recorded on an Arrangement audio track into MIDI notes, and optionally the sung words.",
    "Use it when the musician records a melody, bassline or riff with their voice and wants it as MIDI.",
    "It renders pre-effects source audio, estimates pitch/note events and velocity, and preserves estimated performance timing and chromatic notes by default. Global tuning correction, key snapping, fragment cleanup and eighth/sixteenth quantization are separate opt-in transformations. Source audio and observed fractional pitches remain the evidence; MIDI semitone rounding cannot preserve vibrato or bends.",
    "Inputs: `track` (the audio track holding the recording), `start` and `end` (the recording's range in the Arrangement, in beats), `withWords` (true to also transcribe sung words).",
    "Returns notes, originalNotes with fractional MIDI pitches and estimated seconds, transformations, suggestedClip, tempo, key, grid (null unless quantized), tuningOffsetCents and tuningCorrected. Optional words retain approximate speech-detection timing without assigning notes; a transcript is not verified musical alignment.",
    "The notes are a draft: show them to the musician before creating a clip. Read-only.",
  ].join(" "),
  input: {
    track: TrackRefSchema.describe("Arrangement audio track holding the hummed or sung recording."),
    start: z.number().min(0).describe("Start of the recording in the Arrangement, in beats."),
    end: z.number().min(0).describe("End of the recording in the Arrangement, in beats."),
    withWords: z.boolean().optional().describe("Also transcribe the sung words and match them to the notes."),
    quantize: z.boolean().optional().describe("Explicitly fit timing to an eighth/sixteenth grid; false preserves estimated performance timing."),
    snapToKey: z.boolean().optional().describe("Explicitly snap MIDI pitches to the Set key; false preserves chromatic notes."),
    correctTuning: z.boolean().optional().describe("Explicitly remove estimated global detuning; false keeps the source interpretation."),
    cleanFragments: z.boolean().optional().describe("Explicitly join/drop short fragments; false preserves estimated note events."),
  },
  changes: "none",
  async run(input, ctx) {
    requireRange(input.start, input.end);
    const arrangement = new ArrangementAudio(ctx);
    const lookup = await arrangement.resolve(input.track);
    if ("skipped" in lookup) throw new Error(`the recording on ${lookup.skipped.track} is unreadable: ${lookup.skipped.reason}`);
    const song = await arrangement.song();
    const key: MusicalKey | undefined = input.snapToKey && song.scaleMode ? { root: song.rootNote, intervals: song.scaleIntervals } : undefined;
    if (input.snapToKey && !key) throw new Error("Key snapping needs a known Set scale. Leave it off to preserve the recorded pitches.");
    return arrangement.withRender(lookup.track.ref, input.start, input.end, async (path) => {
      const frozen = await MusicAudio.freeze(path);
      const transcription = new HumTranscriber(song.tempo, key, { quantize: input.quantize ?? false, snapToKey: input.snapToKey ?? false, correctTuning: input.correctTuning ?? false, cleanFragments: input.cleanFragments ?? false }).analyze(MusicAudio.decode(frozen).audio);
      const result = {
        notes: transcription.notes,
        suggestedClip: { start: input.start, length: input.end - input.start },
        tempo: song.tempo,
        key: key ? keyName(song) : null,
        grid: transcription.grid === null ? null : GRID_NAMES[transcription.grid],
        tuningOffsetCents: rounded(transcription.tuningOffsetCents, 0),
        originalNotes: transcription.originalNotes,
        transformations: transcription.transformations,
        tuningCorrected: input.correctTuning ?? false,
      };
      return input.withWords ? { ...result, ...(await transcribeWords(ctx, frozen, transcription.notes, song.tempo)) } : result;
    });
  },
});

function keyName(song: SongInfo): string {
  const pitchClass = ((song.rootNote % NOTE_NAMES.length) + NOTE_NAMES.length) % NOTE_NAMES.length;
  return `${NOTE_NAMES[pitchClass] ?? ""} ${song.scaleName}`.trim();
}

async function transcribeWords(
  ctx: ToolContext,
  audio: MusicAudioSource,
  notes: Note[],
  tempo: number,
): Promise<{ words: SungWords } | { wordsNote: string }> {
  if (!(await ctx.services.available()).transcription) {
    return { wordsNote: `The words stay untranscribed (${RoleCheck.setupMessage("transcription")}); the notes are complete.` };
  }
  try {
    return { words: matchWords(await ctx.services.transcribe(audio, ctx.signal), notes, tempo) };
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const message = error instanceof Error ? error.message : String(error);
    return { wordsNote: `The words stay untranscribed (${message}); the notes are complete.` };
  }
}

/** Transcript lines with times in beats and the indexes of the notes that start within each line. */
function matchWords(transcript: Transcript, notes: Note[], tempo: number): SungWords {
  const beatsPerSecond = tempo / SECONDS_PER_MINUTE;
  return {
    text: transcript.text,
    detectionSeconds: transcript.turns,
    ...(transcript.evidence ? { evidence: transcript.evidence } : {}),
    lines: transcript.turns.map((turn) => {
      const start = turn.start * beatsPerSecond;
      const end = turn.end * beatsPerSecond;
      // Speech-detection progress times are not acoustic lyric-to-note alignment.
      return { text: turn.text, start: rounded(start, WORD_TIME_DIGITS), end: rounded(end, WORD_TIME_DIGITS), notes: [], timing: transcript.timing ?? "speech-detection-approximate", note: "Approximate speech detection under one constant tempo; no note assignment or editing authority." };
    }),
  };
}
