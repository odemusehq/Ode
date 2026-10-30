import { z } from "zod";
import { GridDivision, HumTranscriber } from "../../music/audio";
import { MusicAudio, type FrozenMusicAudio, type MusicAudioSource } from "../../services/music-audio";
import { RoleCheck } from "../../services/roles";
import { defineTool } from "../define";
import { TrackRefSchema } from "../live/schemas";
import { ArrangementAudio, requireRange } from "./arrangement-audio";
import { rounded } from "./report";
import { audioFileEvidence } from "./file-evidence";
import { audioExcerpt } from "../../music/audio/excerpt";
import type { MusicalKey } from "../../music/audio";
import type { Transcript } from "../../services/types";
import { LIVE_TEMPO } from "../../shared/live";
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

interface TranscriptionOptions {
  withWords?: boolean;
  quantize?: boolean;
  snapToKey?: boolean;
  correctTuning?: boolean;
  cleanFragments?: boolean;
}

const FileKey = z.object({
  root: z.number().int().min(0).max(11),
  intervals: z.array(z.number().int().min(0).max(11)).min(1).max(12),
}).strict();

export const humToMidiTool = defineTool({
  name: "hum_to_midi",
  description: [
    "Turns a hummed, sung or whistled idea from a whole supported WAV/AIFF file or an Arrangement audio track into MIDI notes, and optionally the sung words.",
    "Use it when the musician records a melody, bassline or riff with their voice and wants it as MIDI.",
    "It estimates monophonic pitch/note events and velocity after an arithmetic-mean channel mix, and preserves estimated performance timing and chromatic notes by default. Global tuning correction, key snapping, fragment cleanup and eighth/sixteenth quantization are separate opt-in transformations. Source audio and observed fractional pitches remain the evidence; MIDI semitone rounding cannot preserve vibrato or bends.",
    "Choose exactly one source: path (from library_audio_open or another supported temporary output) with an explicit assumedTempoBpm, or track with start/end Arrangement beats. The file branch reads no Live state. assumedTempoBpm is a chosen constant conversion from seconds to clip-local beats, not measured recording tempo or a claim of Set alignment. File key snapping requires explicit key:{root,intervals}; without snapping no key is inferred. File-only tempo/key arguments are refused on the Arrangement branch, which keeps its observed Set tempo/scale and renders pre-FX, pre-fader source audio.",
    "The file branch analyses the whole opened file. To choose a passage, first retain it with library_audio_excerpt and open that exact derived asset. It returns an explicitly unplaced suggestedClip length covering both the source duration and every resulting note end, with no inferred Arrangement start; choose placement separately. Source duration stays exact in analyzedRange. Arrangement suggestedClip keeps the requested start/length and reports notesExceedRequestedLength, still under one constant-tempo assumption with tempo automation unknown.",
    "Returns notes, originalNotes with fractional MIDI pitches and estimated seconds, transformations, suggestedClip, tempo, key, grid (null unless quantized), tuningOffsetCents, tuningCorrected, exact source hash/frames/provenance, analyzedRange and explicit timing/analysis scope. withWords uses those same frozen whole-file/capture bytes. Optional words retain approximate speech-detection timing without assigning notes; a transcript is not verified musical alignment.",
    "The notes are an estimated draft: inspect and preserve the intended material, then apply it through the ordinary main-agent MIDI writer and its existing approval/lock/native guards. This tool stays read-only.",
  ].join(" "),
  input: {
    path: z.string().min(1).optional().describe("A whole supported audio file inside Ode's temporary folder, such as the path from library_audio_open; requires assumedTempoBpm."),
    fromSeconds: z.number().min(0).optional().describe("Unsupported here: first create a deliberate passage with library_audio_excerpt, then open and transcribe that whole derived file."),
    toSeconds: z.number().positive().optional().describe("Unsupported here: use library_audio_excerpt before this whole-file transcription tool."),
    assumedTempoBpm: z.number().min(LIVE_TEMPO.min).max(LIVE_TEMPO.max).optional().describe("File only: explicit constant tempo assumption for converting seconds to clip-local beats, never a detected BPM or Set placement."),
    key: FileKey.optional().describe("File only, with snapToKey: explicit tonic pitch class and nonempty scale intervals above it. No named-scale inference."),
    track: TrackRefSchema.optional().describe("Arrangement audio track holding the hummed or sung recording; give start/end, not path."),
    start: z.number().min(0).optional().describe("Start of the recording in the Arrangement, in beats."),
    end: z.number().min(0).optional().describe("End of the recording in the Arrangement, in beats."),
    withWords: z.boolean().optional().describe("Also transcribe approximate sung words from the same frozen recording; no lyric-to-note assignment is inferred."),
    quantize: z.boolean().optional().describe("Explicitly fit timing to an eighth/sixteenth grid; false preserves estimated performance timing."),
    snapToKey: z.boolean().optional().describe("Explicitly snap MIDI pitches to the supplied file key or observed Set key; false preserves chromatic notes."),
    correctTuning: z.boolean().optional().describe("Explicitly remove estimated global detuning; false keeps the source interpretation."),
    cleanFragments: z.boolean().optional().describe("Explicitly join/drop short fragments; false preserves estimated note events."),
  },
  changes: "none",
  async run(input, ctx) {
    ctx.signal?.throwIfAborted();
    if (input.fromSeconds !== undefined || input.toSeconds !== undefined) throw new Error("hum_to_midi analyses a whole file. Choose a passage with library_audio_excerpt, open it, then transcribe that whole derived file; fromSeconds/toSeconds were not ignored.");
    if (input.path !== undefined) {
      if (input.track !== undefined || input.start !== undefined || input.end !== undefined) throw new Error("Choose one source: path with assumedTempoBpm, or an Arrangement track with start/end beats.");
      if (input.assumedTempoBpm === undefined) throw new Error("A file needs an explicit assumedTempoBpm to convert its seconds to clip-local beats; no recording tempo or placement was inferred.");
      if (input.snapToKey && !input.key) throw new Error("File key snapping needs explicit key:{root,intervals}. Leave it off to preserve chromatic pitches.");
      if (input.key && !input.snapToKey) throw new Error("The file key is only used with snapToKey:true. Omit it to keep the recorded pitches.");
      const path = await ctx.temp.inside(input.path);
      ctx.signal?.throwIfAborted();
      const frozen = await MusicAudio.freeze(path);
      ctx.signal?.throwIfAborted();
      const source = await audioFileEvidence(path, frozen);
      ctx.signal?.throwIfAborted();
      const result = await analyzeRecording(ctx, frozen, input.assumedTempoBpm, input.snapToKey ? input.key : undefined, input);
      ctx.signal?.throwIfAborted();
      return { ...result, source: { ...source, signalStage: "supplied file; stage depends on declared provenance" },
        analyzedRange: { ...result.analyzedRange, timeOrigin: "source file start" },
        suggestedClip: { placement: "unplaced", length: Math.max(result.analyzedRange.sourceDurationSeconds * input.assumedTempoBpm / SECONDS_PER_MINUTE, result.noteEndBeats) },
        timing: timing(input.assumedTempoBpm, "explicit assumption", "source file start", "unplaced") };
    }
    if (input.assumedTempoBpm !== undefined || input.key !== undefined) throw new Error("assumedTempoBpm and explicit key belong to the file branch. Arrangement capture uses its observed Set tempo and scale.");
    if (!input.track || input.start === undefined || input.end === undefined) throw new Error("Give path with assumedTempoBpm, or track with start/end Arrangement beats.");
    const { start, end } = input;
    requireRange(start, end);
    const arrangement = new ArrangementAudio(ctx);
    const lookup = await arrangement.resolve(input.track);
    ctx.signal?.throwIfAborted();
    if ("skipped" in lookup) throw new Error(`the recording on ${lookup.skipped.track} is unreadable: ${lookup.skipped.reason}`);
    const song = await arrangement.song();
    ctx.signal?.throwIfAborted();
    const key: MusicalKey | undefined = input.snapToKey && song.scaleMode ? { root: song.rootNote, intervals: song.scaleIntervals } : undefined;
    if (input.snapToKey && !key) throw new Error("Key snapping needs a known Set scale. Leave it off to preserve the recorded pitches.");
    return arrangement.withRender(lookup.track.ref, start, end, async (path) => {
      ctx.signal?.throwIfAborted();
      const frozen = await MusicAudio.freeze(path);
      ctx.signal?.throwIfAborted();
      const { path: _removedPath, ...evidence } = await audioFileEvidence(path, frozen);
      ctx.signal?.throwIfAborted();
      const result = await analyzeRecording(ctx, frozen, song.tempo, key, input);
      ctx.signal?.throwIfAborted();
      return { ...result,
        source: { ...evidence, track: lookup.track, range: { start, end }, retained: false,
          availability: "Temporary capture removed after transcription; no reusable path is retained.",
          signalStage: "pre-effects, pre-fader Arrangement source audio", currentness: "captured during this call; later Set currentness unknown" },
        analyzedRange: { ...result.analyzedRange, timeOrigin: "capture start" },
        suggestedClip: { start, length: end - start },
        notesExceedRequestedLength: result.noteEndBeats > end - start,
        key: key ? keyName(song) : null,
        timing: timing(song.tempo, "observed Set tempo", "capture start", "requested Arrangement start"),
      };
    });
  },
});

function timing(tempo: number, tempoSource: string, secondsOrigin: string, placement: string) {
  return { assumedTempoBpm: tempo, tempoSource, secondsOrigin, noteBeatOrigin: "recording start at clip-local beat zero",
    tempoAutomation: "unknown", placement,
    note: "Seconds are converted to beats at one constant tempo before any explicit quantization. Recording tempo, tempo automation and musical alignment are not detected." };
}

async function analyzeRecording(ctx: ToolContext, frozen: FrozenMusicAudio, tempo: number, key: MusicalKey | undefined, options: TranscriptionOptions) {
  ctx.signal?.throwIfAborted();
  const decoded = MusicAudio.decode(frozen);
  const whole = audioExcerpt(decoded.audio);
  ctx.signal?.throwIfAborted();
  const transcription = new HumTranscriber(tempo, key, { quantize: options.quantize ?? false, snapToKey: options.snapToKey ?? false,
    correctTuning: options.correctTuning ?? false, cleanFragments: options.cleanFragments ?? false }).analyze(whole.audio);
  ctx.signal?.throwIfAborted();
  const result = { notes: transcription.notes, noteEndBeats: transcription.notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0), tempo, key: key ?? null,
    grid: transcription.grid === null ? null : GRID_NAMES[transcription.grid],
    tuningOffsetCents: rounded(transcription.tuningOffsetCents, 0), originalNotes: transcription.originalNotes,
    transformations: transcription.transformations, tuningCorrected: options.correctTuning ?? false,
    analyzedRange: whole.range,
    analysis: { method: "monophonic YIN pitch tracking and note segmentation", channelMix: "arithmetic mean of all source channels",
      sourceChannels: decoded.audio.channels.length, sampleRate: decoded.audio.sampleRate,
      note: "Pitch, boundaries and velocity are estimates. Polyphonic voices, vibrato, bends and unavailable expression are not preserved as independent MIDI performance." } };
  return options.withWords ? { ...result, ...(await transcribeWords(ctx, frozen, tempo)) } : result;
}

function keyName(song: SongInfo): string {
  const pitchClass = ((song.rootNote % NOTE_NAMES.length) + NOTE_NAMES.length) % NOTE_NAMES.length;
  return `${NOTE_NAMES[pitchClass] ?? ""} ${song.scaleName}`.trim();
}

async function transcribeWords(
  ctx: ToolContext,
  audio: MusicAudioSource,
  tempo: number,
): Promise<{ words: SungWords } | { wordsNote: string }> {
  ctx.signal?.throwIfAborted();
  const available = await ctx.services.available();
  ctx.signal?.throwIfAborted();
  if (!available.transcription) {
    return { wordsNote: `The words stay untranscribed (${RoleCheck.setupMessage("transcription")}); the notes are complete.` };
  }
  try {
    const transcript = await ctx.services.transcribe(audio, ctx.signal);
    ctx.signal?.throwIfAborted();
    return { words: matchWords(transcript, tempo) };
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const message = error instanceof Error ? error.message : String(error);
    return { wordsNote: `The words stay untranscribed (${message}); the notes are complete.` };
  }
}

/** Approximate speech-detection times, with separate constant-tempo estimates and no note assignment. */
function matchWords(transcript: Transcript, tempo: number): SungWords {
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
