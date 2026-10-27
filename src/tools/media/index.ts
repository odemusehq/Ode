import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SongInfo } from "../../shared/live-ops";
import { tempDir, tempFile, userPaths } from "../../mneme/paths";
import { defineTool, type AnyTool, type ToolContext } from "../define";
import { NoteSchema, TrackRefSchema, trackLabel } from "../live/schemas";

const audioSource = {
  path: z.string().min(1).optional().describe("An audio file; or give track, start and end to render it from the Arrangement"),
  track: TrackRefSchema.optional(),
  start: z.number().min(0).optional().describe("Beats"),
  end: z.number().positive().optional().describe("Beats"),
};

async function resolveAudio(input: { path?: string; track?: unknown; start?: number; end?: number }, ctx: ToolContext): Promise<string> {
  if (input.path) return input.path;
  if (input.track === undefined || input.start === undefined || input.end === undefined) {
    throw new Error("Give either path, or track with start and end.");
  }
  const { path } = await ctx.live.extension.call<{ path: string }>("render_track_audio", { track: input.track, start: input.start, end: input.end });
  return path;
}

function voiceFiles(ctx: ToolContext): { reference: string; consent: string } {
  const voice = userPaths(ctx.config.userDir).voice;
  return { reference: join(voice, "reference.wav"), consent: join(voice, "consent.json") };
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
      "Listen to a recording and answer a question about it: what instruments and sounds are in it, the mood, what the musician says or asks in it. For exact pitch or loudness use hum_to_midi or audio_analyze instead.",
    input: { ...audioSource, question: z.string().min(1) },
    run: async (input, ctx) => ({ answer: await ctx.services.describeAudio(await resolveAudio(input, ctx), input.question) }),
  }),
  defineTool({
    name: "vocal_transcribe",
    changes: "none",
    description: "Transcribe the words of a sung or spoken recording, with the start and end time (seconds) of each phrase.",
    input: { ...audioSource },
    run: async (input, ctx) => ctx.services.transcribe(await resolveAudio(input, ctx)),
  }),
  defineTool({
    name: "cover_art_create",
    changes: "memory",
    description:
      "Create the song's cover art from a written brief (subject, mood, colours, style; no text or logos unless asked) and save it as Ode/release/cover.png at 3000 × 3000 pixels, the size release platforms ask for. Base the brief on what the song is about; never imitate another artist's artwork.",
    input: { brief: z.string().min(10) },
    describe: () => "Create cover art for the song and save it in the release folder.",
    run: async ({ brief }, ctx) => ({ path: await ctx.services.generateImage(brief, join(ctx.song.releaseDir, "cover.png")) }),
  }),
  defineTool({
    name: "sample_from_recording",
    changes: "none",
    description:
      'Isolate one sound from a recording by describing it (e.g. "the acoustic guitar", "the snare", "the voice") with stem separation. Returns two files: the isolated sound and the rest. Bring a file into Live with import_into_project, then load it into a Simpler or a Drum Rack pad, or place it as a clip.',
    input: { ...audioSource, describe: z.string().min(2) },
    run: async (input, ctx) => {
      const source = await resolveAudio(input, ctx);
      return ctx.services.separateStem(source, input.describe, await tempDir());
    },
  }),
  defineTool({
    name: "demo_vocal_render",
    changes: "none",
    description:
      "Sing lyrics on a melody in the artist's own voice, so they can hear a demo vocal before recording. Give each lyric line with the notes it is sung on (beats from the start of the demo, in order, one or more notes per syllable after set_lyrics_to_melody). Needs a saved recording of the artist's voice (voice_reference_set). Returns a WAV file to import into the project and place on an audio track.",
    input: {
      lines: z.array(z.object({ text: z.string().min(1), notes: z.array(NoteSchema).min(1) })).min(1),
      tempo: z.number().min(20).max(999).optional().describe("Default: the Set's tempo"),
    },
    run: async ({ lines, tempo }, ctx) => {
      const files = voiceFiles(ctx);
      if (!(await exists(files.consent)) || !(await exists(files.reference))) {
        throw new Error("No recording of the artist's voice with their consent yet. Ask them, then use voice_reference_set.");
      }
      const bpm = tempo ?? (await ctx.live.extension.call<SongInfo>("song_get", {})).tempo;
      const path = await ctx.services.singDemoVocal({ lines, tempo: bpm, voiceModel: files.reference }, await tempFile("wav"));
      return { path, tempo: bpm };
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
    run: async ({ prompt, seconds, loop }, ctx) => ({ path: await ctx.services.generateSound(prompt, seconds, await tempFile("mp3"), loop) }),
  }),
  defineTool({
    name: "voice_reference_set",
    changes: "memory",
    description:
      "Save a recording of the artist's own voice (rendered from an Arrangement audio track, 10–30 seconds of clean singing works best) so demo vocals can be sung in their voice. Only call this after the artist has clearly agreed in this conversation; set consent to true to confirm they did.",
    input: {
      track: TrackRefSchema,
      start: z.number().min(0),
      end: z.number().positive(),
      consent: z.literal(true).describe("The artist agreed to Ode using this recording of their voice for demo vocals"),
    },
    describe: ({ track, start, end }) =>
      `Save your singing on ${trackLabel(track)} (beats ${start}–${end}) as the recording Ode uses to sing demo vocals in your voice.`,
    run: async ({ track, start, end }, ctx) => {
      const files = voiceFiles(ctx);
      const { path } = await ctx.live.extension.call<{ path: string }>("render_track_audio", { track, start, end });
      await mkdir(userPaths(ctx.config.userDir).voice, { recursive: true });
      await copyFile(path, files.reference);
      await writeFile(files.consent, `${JSON.stringify({ agreed: true, time: new Date().toISOString(), source: { track, start, end } }, null, 2)}\n`, "utf8");
      return { saved: files.reference };
    },
  }),
];
