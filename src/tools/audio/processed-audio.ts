import { readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { LocalAudioFiles } from "../../live/local-audio-files";
import { MAX_AUDIO, type MaxAudioSource } from "../../shared/max-audio";
import { defineTool, type AnyTool, type ToolContext } from "../define";

function device(ctx: ToolContext) {
  if (!ctx.maxAudio) throw new Error("Load the updated Ode Max for Live device to capture processed sound.");
  return ctx.maxAudio;
}

export const processedAudioTools: AnyTool[] = [
  defineTool({
    name: "processed_audio_sources",
    changes: "set",
    mainAgentOnly: true,
    description: "Discover the audio sources actually offered to the paired Ode Max device, with their routing stage and host track. This briefly selects auxiliary input routes to inspect their available stages, then restores them; it touches device routing and follows Manual Apply. Includes device input and available processed MIDI instruments, tracks, groups, returns or Main only when Live exposes those routes. No audio is captured here. sourceId is an opaque Max identity, never an SDK track reference. Use an id from this latest catalogue for processed_audio_capture. query optionally narrows by source/track/stage; results are bounded with an omitted count, so narrow the query when needed. Missing routes remain unavailable; device input on Main is before its mixer/fader and does not prove final Main output.",
    input: { query: z.string().max(512).optional(), limit: z.number().int().min(1).max(50).optional() },
    describe: () => "Audio · find available listening sources",
    run: async ({ query, limit }, ctx) => {
      const catalogue = await device(ctx).sources(ctx.signal);
      const words = query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const matches = catalogue.sources.filter((source) => words.every((word: string) =>
        `${source.name} ${source.trackName ?? ""} ${source.kind} ${source.stage}`.toLowerCase().includes(word)));
      const sources: MaxAudioSource[] = [];
      const result = () => ({ host: catalogue.host, sources, matching: matches.length,
        omitted: matches.length - sources.length, available: catalogue.sources.length });
      for (const source of matches.slice(0, limit ?? 20)) {
        sources.push(source);
        if (JSON.stringify(result()).length > ctx.config.limits.toolResultMaxChars) { sources.pop(); break; }
      }
      if (matches.length && !sources.length) throw new Error("The result window cannot fit one audio source. Increase toolResultMaxChars.");
      return result();
    },
  }),
  defineTool({
    name: "processed_audio_capture",
    changes: "set",
    mainAgentOnly: true,
    description: [
      "Record actual stereo audio through the paired Max device and retain a managed Float32 WAV for audio_describe, audio_analyze and audio_compare. First call processed_audio_sources; give its exact sourceId and durationSeconds (real-time seconds, maximum 300 and 16 million frames). Only offered routing stages can be captured; pre-fx/device-input is not final processed output. No listening model is called here.",
      "Omit startBeat to record the current live output without starting playback. For Arrangement playback, startBeat seeks and starts a stopped, non-recording transport; optional prerollBeats warms processing before recording. Live must already be playing the intended Arrangement rather than Session overrides. Capture restores transport it still owns, and stops/restores on cancellation; human transport changes can prevent restoration. This touches transport and device routing, follows Manual Apply, and cannot run alongside other host edits/captures.",
      "Returns retained id, working path, exact hash/frames/rate, source stage, host, requested timing and observed beat bounds with uncertainty. Reopen by id with library_audio_open later. Seconds are not an exact beat selection, especially with tempo changes; pre-roll does not recreate all plugin history, and post-roll can include later music. Do not solo tracks, infer missing routes, claim complete isolated effect tails, or call this a native offline export. Main post-mixer must be explicitly available. Later Set edits require a fresh capture for evaluation.",
    ].join(" "),
    input: { sourceId: z.string().min(1).max(512), durationSeconds: z.number().positive().max(MAX_AUDIO.maxDurationSeconds),
      startBeat: z.number().min(0).optional(), prerollBeats: z.number().min(0).max(64).optional(), name: z.string().min(1).max(180).optional() },
    describe: ({ startBeat, durationSeconds }) => `Audio · capture ${durationSeconds}s${startBeat === undefined ? " of current playback" : ` from beat ${startBeat}`}`,
    run: async ({ name, ...request }, ctx) => {
      const captured = await device(ctx).capture(request, ctx.signal);
      try {
        ctx.signal?.throwIfAborted();
        const bytes = await readFile(captured.path);
        if (bytes.length !== captured.bytes || createHash("sha256").update(bytes).digest("hex") !== captured.sha256) {
          throw new Error("The Max capture changed before it could be retained. Capture it again.");
        }
        const { path: _path, sha256: _hash, bytes: _size, ...facts } = captured;
        const library = new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir);
        const record = await library.add({ name: `${name ?? "Live capture " + new Date().toISOString().replaceAll(":", "-")}.wav`,
          bytes, provenance: "max-device-capture", capture: { capturedAt: new Date().toISOString(), ...facts },
          purpose: captured.source.stage === "post-fx" || captured.source.stage === "post-mixer" ? "processed-bounce" : "reference",
          source: `${captured.source.name}; ${captured.source.stage}; recorded through Ode on ${captured.host.trackName}. ${captured.timing.rangeUncertainty}` }, ctx.signal);
        return { ...(ctx.signal?.aborted ? record : await library.open(record.id)), retained: true,
          availability: "Reopen this id with library_audio_open when its working path expires." };
      } finally {
        await rm(captured.path, { force: true });
      }
    },
  }),
];
