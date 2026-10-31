import { t } from "../../shared/i18n";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { COVER_CHOICE, COVER_FILE } from "../../shared/api";
import { LIVE_TEMPO } from "../../shared/live";
import type { SongInfo } from "../../shared/live-ops";
import { userPaths } from "../../mneme/paths";
import { VoiceReference } from "../../mneme/voice-reference";
import { defineTool, type AnyTool, type ToolContext } from "../define";
import { NoteSchema, TrackRefSchema } from "../live/schemas";
import { audioFileEvidence } from "../audio/file-evidence";
import { MusicAudio } from "../../services/music-audio";
import { LocalAudioFiles } from "../../live/local-audio-files";
import { ArrangementAudio } from "../audio/arrangement-audio";
import type { TrackRef } from "../../shared/live";

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

/** Runs `use` on the audio: the file given, or a render of the Arrangement, deleted once `use` is done with it. */
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

/** The Set's tempo, from the latest reading of the Set when there is one. */
async function tempoOf(ctx: ToolContext): Promise<number> {
  return ctx.snapshots.latest?.song.tempo ?? (await ctx.live.extension.call<SongInfo>("song_get", {})).tempo;
}

function voiceReference(ctx: ToolContext): VoiceReference {
  return new VoiceReference(userPaths(ctx.config.userDir).voice);
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

export const mediaTools: AnyTool[] = [
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
  }),
  defineTool({
    name: "vocal_transcribe",
    changes: "none",
    description:
      "Requires already-prepared mono 16-bit PCM WAV at 16 or 24 kHz. Ode does not downmix or resample; native captures at other formats need preparation in Ableton, Max or a supported plug-in first. Transcribe sung or spoken words with approximate speech-detection times in seconds, bound to the exact source and unchanged provider-ready speech payload. Give path alone or an Arrangement audio track/start/end; captures hear pre-FX, pre-fader audio and are removed after transcription. Seconds remain canonical, not verified musical boundaries. Optional assumedTempoBpm gives separate constant-tempo beat estimates; tempo automation and current Set alignment are unknown, so these estimates do not authorise positioning notes or lyrics.",
    input: { ...audioSource, assumedTempoBpm: z.number().min(LIVE_TEMPO.min).max(LIVE_TEMPO.max).optional().describe("Explicit constant tempo assumption for separate approximate beat estimates; omit to keep only detection seconds.") },
    run: (input, ctx) =>
      withAudio(input, ctx, async (path) => {
        const transcript = await ctx.services.transcribe(path, ctx.signal);
        const { start } = input;
        const source = input.path ? { kind: "supplied file", currentness: "unknown" } : { kind: "Arrangement capture", track: input.track,
          range: { start, end: input.end }, signalStage: "pre-effects, pre-fader source audio", retained: false,
          availability: "Temporary capture removed after transcription; no usable path is retained.", currentness: "captured during this call; later Set state unknown" };
        if (input.assumedTempoBpm === undefined) return { ...transcript, source };
        const beatsPerSecond = input.assumedTempoBpm / 60;
        const origin = input.path ? 0 : start!;
        return { ...transcript, source, beatEstimates: { assumedTempoBpm: input.assumedTempoBpm, tempoAutomation: "unknown",
          origin: input.path ? "file start at beat zero" : "requested Arrangement start beat",
          turns: transcript.turns.map((turn) => ({ ...turn, startBeat: origin + turn.start * beatsPerSecond, endBeat: origin + turn.end * beatsPerSecond })),
          alignment: "Approximate speech-detection times under an explicit constant-tempo assumption. Tempo automation, current alignment, phrase and note boundaries are unverified; these estimates do not authorise edits." } };
      }),
  }),
  defineTool({
    name: "cover_art_create",
    changes: "memory",
    description:
      `Create cover art choices for the song from a written brief (subject, mood, colours, style; text and logos only when asked): several images at 3000 × 3000 pixels, the size release platforms ask for, saved in the song's release folder as cover-1.png, cover-2.png and so on, numbered after any earlier choices, which stay. Then let the musician pick one with ask_musician (options "Cover 1", "Cover 2"…, images the files returned, in the same order) and keep their pick with cover_art_choose. Base the brief on what the song is about; make only original artwork. Returns { choices }: the new files.`,
    input: { brief: z.string().min(10) },
    describe: () => t("toolActivity.releaseCoverArtChoices"),
    run: async ({ brief }, ctx) => {
      const dir = ctx.song.releaseDir;
      const count = ctx.config.release.coverChoices;
      await mkdir(dir, { recursive: true });
      const earlier = (await readdir(dir)).map((name) => Number(COVER_CHOICE.exec(name)?.[1] ?? 0));
      const first = Math.max(0, ...earlier) + 1;
      const paths = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          ctx.services.generateImage(`${brief}\nVersion ${index + 1} of ${count}: a different composition from the others.`, join(dir, `cover-${first + index}.png`), undefined, ctx.signal),
        ),
      );
      const choices = paths.map((path) => basename(path));
      return { choices, note: "Ask the musician which one with ask_musician (images: these files), then keep it with cover_art_choose." };
    },
  }),
  defineTool({
    name: "cover_art_choose",
    changes: "memory",
    description: `Keep one of the cover art choices made with cover_art_create as the song's cover: the file (such as "cover-2.png") is copied to ${COVER_FILE} in the release folder, replacing the cover there. Returns { cover, from }.`,
    input: { file: z.string().regex(COVER_CHOICE).describe('One of the choices, such as "cover-2.png"') },
    describe: ({ file }) => t("toolActivity.releaseAsTheCover", { file: file }),
    run: async ({ file }, ctx) => {
      const source = join(ctx.song.releaseDir, file);
      if (!(await exists(source))) throw new Error(`${file} is missing from the release folder: make choices with cover_art_create first.`);
      await copyFile(source, join(ctx.song.releaseDir, COVER_FILE));
      return { cover: COVER_FILE, from: file };
    },
  }),
  defineTool({
    name: "sample_from_recording",
    changes: "none",
    description:
      'Isolate one sound from a recording by describing it (e.g. "the acoustic guitar", "the snare", "the voice") with stem separation. Returns two files: the isolated sound and the rest. Bring a file into Live with import_into_project, then load it into a Simpler or a Drum Rack pad, or place it as a clip.',
    input: { ...audioSource, describe: z.string().min(2) },
    run: (input, ctx) => withAudio(input, ctx, async (source) => ctx.services.separateStem(source, input.describe, await ctx.temp.folder(), ctx.signal)),
  }),
  defineTool({
    name: "demo_vocal_render",
    changes: "none",
    description:
      "Sing lyrics on a melody in the artist's own voice, so they can hear a demo vocal before recording. Give each lyric line with only the notes it is sung on (beats from the start of the demo, in order). Ask Lyricist for the intended syllable-to-note alignment against the exact vocal notes. Do not include accompaniment notes or invent a local lyric fitting rule. Needs a saved recording of the artist's voice (voice_reference_set). Returns a WAV file to import into the project and place on an audio track.",
    input: {
      lines: z.array(z.object({ text: z.string().min(1), notes: z.array(NoteSchema).min(1), pronunciation: z.string().optional(), alignment: z.array(z.object({ syllable: z.number().int().min(0), note: z.number().int().min(0) })).optional(), delivery: z.string().optional() })).min(1),
      tempo: z.number().min(LIVE_TEMPO.min).max(LIVE_TEMPO.max).optional().describe("Default: the Set's tempo"),
    },
    run: async ({ lines, tempo }, ctx) => {
      const voice = voiceReference(ctx);
      if (!(await voice.ready())) {
        throw new Error("Demo vocals wait for a recording of the artist's voice with their consent. Ask them, then use voice_reference_set.");
      }
      const bpm = tempo ?? (await tempoOf(ctx));
      const rendered = await voice.withRecording(await ctx.temp.file("wav"), async (recording, reference, signal) => ({
        path: await ctx.services.singDemoVocal({ lines, tempo: bpm, voiceModel: recording }, await ctx.temp.file("wav"), signal), reference,
      }), ctx.signal);
      const { path, reference } = rendered;
      const frozen = await MusicAudio.freeze(path);
      const source = await audioFileEvidence(path, frozen);
      const verification = { status: "not auditioned", note: "The singing service returned this file. Use explicit listening tools for audio assessment and Lyricist for lyric assessment." };
      return { path, tempo: bpm, source, voiceReference: reference, verification };
    },
  }),
  defineTool({
    name: "sound_generate",
    changes: "none",
    description:
      'Generate a sound from a description (e.g. "a short, dusty vinyl kick drum", "a rising white-noise sweep, four bars at 120 BPM", "rain on a window"), 0.5–30 seconds, optionally made to loop. Returns an audio file to import into the project and load into a Simpler, a Drum Rack pad or a clip.',
    input: {
      prompt: z.string().min(3),
      seconds: z.number().min(0.5).max(30),
      loop: z.boolean().optional(),
    },
    run: async ({ prompt, seconds, loop }, ctx) => ({ path: await ctx.services.generateSound(prompt, seconds, await ctx.temp.file("wav"), loop, ctx.signal) }),
  }),
  defineTool({
    name: "voice_reference_set",
    changes: "memory",
    consent: true,
    description:
      "Save a recording of the artist's own voice (rendered from an Arrangement audio track, 10–30 seconds of clean singing works best) so demo vocals can be sung in their voice. Only call this after the artist has clearly agreed in this conversation; set consent to true to confirm they did.",
    input: {
      track: TrackRefSchema,
      start: z.number().min(0),
      end: z.number().positive(),
      consent: z.literal(true).describe("The artist agreed to Ode using this recording of their voice for demo vocals"),
    },
    describe: ({ track, start, end }, names) =>
      t("toolActivity.saveVoiceReference", { track: names.track(track), start: names.span(start, end) }),
    run: async ({ track, start, end }, ctx) => {
      const arrangement = new ArrangementAudio(ctx);
      const lookup = await arrangement.resolve(track);
      if ("skipped" in lookup) throw new Error(`${lookup.skipped.track} stays unrecorded: ${lookup.skipped.reason}`);
      const reference = await arrangement.withRender(lookup.track.ref, start, end, (render) => voiceReference(ctx).save(render, { track: lookup.track.ref, start, end }, ctx.signal));
      return { saved: true, reference, note: "Demo vocals can now use this consent-associated reference; voice_reference_clear removes it and cancels local reference use when consent is withdrawn." };
    },
  }),
  defineTool({
    name: "voice_reference_clear",
    changes: "memory",
    description:
      "Remove the recording of the artist's voice and their consent, as soon as the artist withdraws it. Demo vocals then wait for a new recording and a new consent (voice_reference_set).",
    input: {},
    describe: () => t("toolActivity.removeVoiceReference"),
    run: async (_input, ctx) => {
      await voiceReference(ctx).clear();
      return { cleared: true };
    },
  }),
];
