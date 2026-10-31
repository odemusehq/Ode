import { t } from "../../../shared/i18n";

import { z } from "zod";

import { LocalAudioFiles } from "../../../live/local-audio-files";
import { MusicAudio } from "../../../services/music-audio";
import type { TrackRef } from "../../../shared/live";
import { defineTool, type AnyTool, type ToolContext } from "../../define";
import { ArrangementAudio } from "../audio/arrangement-audio";
import { audioFileEvidence } from "../audio/file-evidence";
import { TrackRefSchema } from "../schemas";
const fileRange = {
  fromSeconds: z.number().min(0).optional(),
  toSeconds: z.number().positive().optional(),
};
const audioSource = {
  path: z.string().min(1).optional().describe("An audio file Ode made in its temp folder; or give track, start and end to render it from the Arrangement"),
  track: TrackRefSchema.optional(),
  start: z.number().min(0).optional().describe("Beats"),
  end: z.number().positive().optional().describe("Beats"),
};
interface AudioInput {
  path?: string;
  track?: unknown;
  start?: number;
  end?: number;
}
async function withAudio<T>(input: AudioInput, ctx: ToolContext, use: (path: string) => Promise<T>): Promise<T> {
  if (input.path) {
    if (input.track !== undefined || input.start !== undefined || input.end !== undefined) throw new Error("Choose one source: path alone, or track with start and end. Mixed selectors are not a capture of that track.");
    return use(await ctx.temp.inside(input.path));
  }
  if (input.track === undefined || input.start === undefined || input.end === undefined) {
    throw new Error("Give either path, or track with start and end.");
  }
  return new ArrangementAudio(ctx).withRender(input.track as TrackRef, input.start, input.end, use);
}
export const listeningTools: AnyTool[] = [
  defineTool({
    name: "audio_describe",
    changes: "none",
    description:
      "Listen to a supported WAV/AIFF recording and answer a musical question. File-only fromSeconds/toSeconds select the passage physically sent to the model, with exact source-frame bounds retained in evidence; omit for the full file. These are file seconds, never Arrangement beats. Otherwise give track with start/end beats, never mixed file/track selectors. Returns answer and evidence binding the whole source hash, selected frames, actual payload hash, criterion, model, gain/representation and times. Arrangement listening hears pre-FX, pre-fader audio tracks only; its temporary capture is removed and has no reusable path. Use audio_capture separately to retain a supported capture. For pitch or loudness measurements use an actual supported Live/Max/plugin analyser; this tool asks the configured listening model for an assessment.",
    input: { ...audioSource, ...fileRange, question: z.string().min(1) },
    run: async (input, ctx) => {
      if (!input.path && (input.fromSeconds !== undefined || input.toSeconds !== undefined)) throw new Error("fromSeconds/toSeconds select a file passage. For Arrangement audio use track/start/end in beats.");
      return withAudio(input, ctx, async (path) => {
        const frozen = await MusicAudio.freeze(path);
        const evidence = await audioFileEvidence(path, frozen);
        let source: Record<string, unknown> = evidence;
        if (!input.path) {
          const { path: _deletedPath, ...captured } = evidence;
          source = { ...captured, track: input.track, range: { start: input.start, end: input.end }, retained: false, availability: "Temporary capture removed after listening; no usable path is retained." };
        }
        const result = await ctx.services.describeAudio(frozen, input.question, ctx.signal, input.path ? { fromSeconds: input.fromSeconds, toSeconds: input.toSeconds } : undefined);
        return { ...result, source, signalStage: input.path ? "supplied file; stage depends on declared provenance" : "pre-effects, pre-fader Arrangement audio",
          note: "The selected audio starts at zero in the listening payload; evidence keeps its original file positions. Model musical/stereo judgement is unvalidated; captured bytes do not prove current processed Set state." };
      });
    },
  }),
  defineTool({
    name: "audio_capture",
    changes: "memory",
    mainAgentOnly: true,
    description: "Explicitly retain one Arrangement audio track's pre-FX, pre-fader source capture in Ode's managed audio catalogue. Give track/start/end in quarter-note beats, and an optional name. Returns persistent id, source hash and a managed working path for audio_describe/audio_compare; library_audio_open reopens its id later. This changes persistent memory and follows Manual Apply. No model listening runs here. Only Arrangement audio tracks are supported; this does not capture MIDI instruments, processing, returns or Main, and unchanged bytes do not prove current processed Set sound.",
    input: { track: TrackRefSchema, start: z.number().min(0), end: z.number().positive(), name: z.string().min(1).max(200).optional() },
    describe: ({ track, start, end }, names) => t("toolActivity.keepAnAudioCapture", { track: names.track(track), start: names.span(start, end) }),
    run: (input, ctx) => withAudio(input, ctx, async (path) => {
      ctx.signal?.throwIfAborted();
      const frozen = await MusicAudio.freeze(path);
      ctx.signal?.throwIfAborted();
      MusicAudio.decode(frozen);
      if (!frozen.source.frames) throw new Error("The capture has zero sample frames; no audio was retained.");
      const library = new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir);
      const record = await library.add({ name: `${input.name ?? "Arrangement capture " + new Date().toISOString().replaceAll(":", "-")}.${frozen.source.format === "AIFF" ? "aiff" : "wav"}`,
        bytes: frozen.bytes, purpose: "reference", provenance: "sdk-pre-fx-capture", range: { start: input.start, end: input.end },
        source: `SDK pre-effects, pre-fader Arrangement source audio; track ${JSON.stringify(input.track)}. Current processed Set and effect tails are unverified.` }, ctx.signal);
      // An already-issued publication can finish during Stop. Keep its real acknowledgement without starting a working copy.
      return { ...(ctx.signal?.aborted ? record : await library.open(record.id)), retained: true, signalStage: "pre-effects, pre-fader Arrangement source audio",
        availability: "Managed capture; reopen its id with library_audio_open if this working path expires." };
    }),
  }),
  defineTool({
    name: "audio_compare",
    changes: "none",
    description: "Compare two retained managed WAV/AIFF files for a stated musical criterion. Both recordings are sent as A then B in one WAV with a 0.5 second gap and labelled time ranges, preserving channels/rate. The files retain their levels. levelMatch must be false; level matching needs a supported Live/Max/plugin operation before capture. Optional aRange/bRange select exact file-second excerpts physically sent, with source-frame selections and separate playback positions retained in evidence. Requires matching mono/stereo layouts and sample rates; unknown multichannel layouts are refused. This does not capture the current processed Set or prove common musical alignment/currentness.",
    input: { a: z.string().min(1), b: z.string().min(1), aRange: z.object(fileRange).optional(), bRange: z.object(fileRange).optional(), question: z.string().min(1), levelMatch: z.literal(false).optional().describe("Ode does not implement level matching. Match in Live or a supported plugin before capture.") },
    run: async ({ a, b, aRange, bRange, question, levelMatch }, ctx) => {
      if (!ctx.services.compareAudio) throw new Error("The configured service has no paired-audio comparison path.");
      const [first, second] = await Promise.all([ctx.temp.inside(a), ctx.temp.inside(b)]);
      const [one, two] = await Promise.all([MusicAudio.freeze(first), MusicAudio.freeze(second)]);
      const [firstEvidence, secondEvidence] = await Promise.all([audioFileEvidence(first, one), audioFileEvidence(second, two)]);
      return { ...(await ctx.services.compareAudio(one, two, question, levelMatch ?? false, ctx.signal, { a: aRange, b: bRange })), a: firstEvidence, b: secondEvidence, note: "The listener heard both files sequentially. Artistic preference and model fidelity remain unvalidated; assess the stated criterion in Live." };
    },
  })
];
