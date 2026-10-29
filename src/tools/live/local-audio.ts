import { z } from "zod";
import { LocalAudioFiles } from "../../live/local-audio-files";
import { defineTool, type AnyTool } from "../define";

export const localAudioTools: AnyTool[] = [
  defineTool({
    name: "library_audio_search",
    description: "Find audio files explicitly attached by the musician to Ode, by filename or their source description. Searches only Ode's managed copies, including library samples, references and supplied processed bounces. Does not scan the native Live Browser, Packs or arbitrary folders. Returns file ids and declared provenance; unchanged bytes do not prove a bounce matches the current Set. If the catalogue is empty, ask the musician to attach audio in chat. Read-only.",
    input: { query: z.string(), limit: z.number().int().min(1).max(100).optional() },
    changes: "none",
    run: ({ query, limit }, ctx) => new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).search(query, limit),
  }),
  defineTool({
    name: "library_audio_open",
    description: "Open a file id returned by library_audio_search as an exact-byte managed working copy. Returns path for audio_analyze, audio_describe or import_into_project, and the original file hash and user-declared source. WAV/AIFF support local analysis; convert other formats to WAV in the DAW first. A processed-bounce declaration does not establish its routing, effects, range, tails or currentness. This does not capture or export Live audio.",
    input: { id: z.string().uuid() },
    changes: "none",
    run: ({ id }, ctx) => new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).open(id),
  }),
];
