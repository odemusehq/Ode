import { z } from "zod";
import { LocalAudioFiles } from "../../live/local-audio-files";
import { buildLibraryProfile } from "../../music/audio/library-profile";
import { LibraryAnnotationsPatchSchema, LibraryProfileLevelSchema, LibrarySearchSchema } from "../../shared/audio-library";
import { defineTool, type AnyTool } from "../define";

export const localAudioTools: AnyTool[] = [
  defineTool({
    name: "library_audio_search",
    description: [
      "Find explicitly attached audio and deliberately retained audio_capture files in Ode's managed catalogue. Never scans the native Browser, Packs or arbitrary folders.",
      "query uses case-insensitive AND substrings across filename, declared source, purpose, labels, role, kind, notes and declared key. Use declaredBpm for tempo filtering. labels requires all exact normalised labels; role, kind, purpose and declaredKey are structured filters. declaredBpm/declaredKey are Ode-entered declarations, never measured tempo or key.",
      "durationSeconds, channels, integratedLufs, truePeakDbtp and tiltDbPerOctave filter saved whole-file profiles; bounds are inclusive and use unrounded values. Unknown or unsupported readings cannot match a requested numeric filter. profileDetail is minimum detail: metadata accepts metadata or full profiles; full requires full. No audio is decoded, measured or written during search.",
      "Returns {items,total,offset,nextOffset,coverage}; limit defaults to 20, at most 100. Sorts newest import first with id as tie-breaker; use nextOffset for the next page. Coverage distinguishes unprofiled, unknown-excluded and unreadable records, so no matches need not mean no suitable audio exists.",
      "Cached profiles bind bytes when measured; search does not recheck stored audio integrity. library_audio_open or library_audio_profile verifies the asset before use. Provenance and current processed Set sound remain separate; unchanged bytes do not prove currentness. Read-only.",
    ].join(" "),
    input: LibrarySearchSchema.shape,
    changes: "none",
    run: (input, ctx) => new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).searchRecords(input),
  }),
  defineTool({
    name: "library_audio_update",
    description: [
      "Save durable labels, role, one-shot/loop/recording kind, notes or declared BPM/key on one managed audio id. Use for catalogue organisation or to retain the musician's direction.",
      "Give expectedRevision from annotations.revision (zero when annotations are absent) and patch only the fields to change. labels replaces the whole label list; [] clears it. null clears role, kind, notes, declaredBpm or declaredKey. A conflicting revision refuses the write; reread before choosing a new update.",
      "Values are recorded as Ode-entered declarations with the current conversation exchange id, not audio analysis or independently verified musician assertions. No BPM/key inference runs here. Original filename, source hash, imported provenance and currentness are protected. Returns the updated catalogue record; changes persistent memory and follows Manual Apply.",
    ].join(" "),
    input: { id: z.uuid(), expectedRevision: z.number().int().nonnegative(), patch: LibraryAnnotationsPatchSchema.refine((patch) => Object.keys(patch).length > 0, "Give at least one annotation field to change.") },
    changes: "memory",
    mainAgentOnly: true,
    describe: () => "Audio library · save labels",
    run: ({ id, expectedRevision, patch }, ctx) => new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).annotate(id, expectedRevision, patch, { exchangeId: ctx.exchangeId }, ctx.signal),
  }),
  defineTool({
    name: "library_audio_profile",
    description: [
      "Verify and save a whole-file profile for one explicitly managed audio id. level defaults to metadata: inspect WAV/AIFF headers for exact frames, sample rate, channels, format and duration without examining sample values.",
      "Choose full explicitly to decode finite samples and measure whole-file loudness, peaks, stereo and spectrum using Ode's existing local DSP. Unknown multichannel layout has unsupported loudness; silent or unavailable readings remain null with status. No tempo, key, role or one-shot/loop classification is inferred.",
      "Returns the updated catalogue record with profile level, method/version/time and exact source hash/bytes. The profile covers the complete asset, never an excerpt, and saves no temporary path. Unsupported codecs require a WAV/AIFF export; no provider or Live call runs. Annotation edits are preserved. Changes persistent memory and follows Manual Apply.",
    ].join(" "),
    input: { id: z.uuid(), level: LibraryProfileLevelSchema.optional() },
    changes: "memory",
    mainAgentOnly: true,
    describe: ({ level }) => level === "full" ? "Audio library · measure full file" : "Audio library · inspect file metadata",
    run: async ({ id, level }, ctx) => {
      ctx.signal?.throwIfAborted();
      return new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).profile(id, level ?? "metadata", (bytes, detail) => {
        ctx.signal?.throwIfAborted();
        const profile = buildLibraryProfile(bytes, detail);
        ctx.signal?.throwIfAborted();
        return profile;
      }, ctx.signal);
    },
  }),
  defineTool({
    name: "library_audio_open",
    description: "Open a file id returned by library_audio_search as an exact-byte managed working copy. Returns path for audio_analyze, audio_describe or import_into_project, and the original file hash and user-declared source. WAV/AIFF support local analysis; convert other formats to WAV in the DAW first. A processed-bounce declaration does not establish its routing, effects, range, tails or currentness. This does not capture or export Live audio.",
    input: { id: z.string().uuid() },
    changes: "none",
    run: ({ id }, ctx) => new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).open(id),
  }),
];
