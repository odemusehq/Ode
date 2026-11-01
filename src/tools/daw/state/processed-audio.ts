import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { z } from "zod";
import { LocalAudioFiles } from "../../../live/local-audio-files";
import { t } from "../../../shared/i18n";
import { MAX_AUDIO, type MaxAudioSource } from "../../../shared/max-audio";
import { MaxCaptureEvidenceSchema, type MaxCaptureEvidence } from "../../../shared/audio-library";
import { defineTool, type AnyTool, type ToolContext } from "../../define";
import { attachAudioFile } from "../audio/file-evidence";

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
    describe: () => t("toolActivity.audioFindAvailableListeningSources"),
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
      "Record actual stereo audio through the paired Max device, retain a managed Float32 WAV and attach its actual audio to your next turn in this conversation. You assess it yourself; no separate model is called. First call processed_audio_sources; give its exact sourceId and durationSeconds (real-time seconds, maximum 300 and 16 million frames), or sectionRange as described below. Only offered routing stages can be captured; pre-fx/device-input is not final processed output.",
      "sectionRange:{fromSectionId,toSectionId?} selects a contiguous Arrangement passage using exact current lead_sheet_read section IDs, from the first section's actual start through the last section's end; toSectionId defaults to fromSectionId. Repeated names require their distinct IDs. Intervening music is included; disjoint sections need separate calls. With no durationSeconds, seconds are estimated from a fresh observed Live tempo, not from a tempo map. Explicit durationSeconds overrides that estimate. Tempo automation/changes and native scheduler timing can stop before or after the requested end; neither mode promises exact beat coverage. Returns/preserves requested endpoint sections/names/beat bounds, tempo/estimate/override and actual observed capture bounds. A conflicting manual startBeat, missing/ambiguous section ID or reversed range is refused before capture. Oversized estimates require a smaller passage or an explicit bounded seconds override.",
      "Omit startBeat to record the current live output without starting playback. For Arrangement playback, startBeat seeks and starts a stopped, non-recording transport; optional prerollBeats warms processing before recording. Live must already be playing the intended Arrangement rather than Session overrides. Capture restores transport it still owns, and stops/restores on cancellation; human transport changes can prevent restoration. This touches transport and device routing, follows Manual Apply, and cannot run alongside other host edits/captures.",
      "For a selected-track mix, use a Main post-mixer source, startBeat and includeSourceIds containing current track/group post-mixer source ids. The updated device temporarily unmutes selected tracks and their group ancestors, mutes excluded tracks, zeros excluded sends, and clears track/return solos. Automated excluded sends are refused to preserve automation. It restores changed controls after capture, error or cancellation if they still match Ode's values; conflicting human edits are preserved. Selected groups include their children. Existing return mute states, Main processing, shared effect history, routing and sidechain relationships remain relevant: this is a selected-track Main audition, not guaranteed isolated stems. For separate tracks capture their own offered source, sequentially; one device records one stereo take at a time.",
      "Returns retained id, working path, exact hash/frames/rate, source stage, included sources when selected, host, requested timing and observed beat bounds with uncertainty. Reopen by id with library_audio_open later. Seconds are not an exact beat selection, especially with tempo changes; pre-roll does not recreate all plugin history, and post-roll can include later music. Do not manually solo tracks, infer missing routes, claim complete isolated effect tails, or call this a native offline export. Main post-mixer must be explicitly available. Later Set edits require a fresh capture for evaluation.",
    ].join(" "),
    input: { sourceId: z.string().min(1).max(512), durationSeconds: z.number().positive().max(MAX_AUDIO.maxDurationSeconds).optional(),
      sectionRange: z.object({ fromSectionId: z.string().min(1).max(512), toSectionId: z.string().min(1).max(512).optional() }).strict().optional(),
      startBeat: z.number().min(0).optional(), prerollBeats: z.number().min(0).max(64).optional(), includeSourceIds: z.array(z.string().min(1).max(512)).min(1).max(64).optional(), name: z.string().min(1).max(180).optional() },
    describe: ({ sectionRange, startBeat, durationSeconds }, names) => sectionRange
      ? t("toolActivity.captureSectionAudio", { fromSection: names.section(sectionRange.fromSectionId), toSection: names.section(sectionRange.toSectionId ?? sectionRange.fromSectionId), single: !sectionRange.toSectionId || sectionRange.toSectionId === sectionRange.fromSectionId })
      : t("toolActivity.captureAudio", { durationSeconds: durationSeconds, isStartBeat: Boolean(startBeat === undefined), startBeat: startBeat }),
    run: async ({ name, sectionRange: selection, ...input }, ctx) => {
      let durationSeconds = input.durationSeconds;
      let sectionRange: MaxCaptureEvidence["sectionRange"];
      if (selection) {
        const sheet = await ctx.song.read();
        const section = (id: string) => {
          const matches = sheet.sections.filter(item => item.id === id);
          if (matches.length !== 1) throw new Error(`Section ID ${id} is missing or ambiguous; read the current lead sheet and use a unique actual ID.`);
          const { name, startBeat, lengthBeats } = matches[0]!;
          if (!Number.isFinite(startBeat) || startBeat < 0 || !Number.isFinite(lengthBeats) || lengthBeats <= 0) throw new Error("The selected section has invalid beat positions; reconcile the lead sheet before capture.");
          return { id, name, startBeat, lengthBeats };
        };
        const from = section(selection.fromSectionId), to = section(selection.toSectionId ?? selection.fromSectionId);
        const endBeat = to.startBeat + to.lengthBeats;
        if (!Number.isFinite(endBeat) || to.startBeat < from.startBeat || endBeat < from.startBeat + from.lengthBeats) throw new Error("The section range is reversed or does not include the starting section's complete span.");
        if (input.startBeat !== undefined && input.startBeat !== from.startBeat) throw new Error("startBeat conflicts with the current section range; omit it or use the actual section start.");
        const { tempo } = await ctx.live.extension.call<{ tempo: number }>("song_get", {});
        if (!Number.isFinite(tempo) || tempo < 20 || tempo > 999) throw new Error("Live did not return a valid fresh tempo for the section duration estimate.");
        const estimatedDurationSeconds = (endBeat - from.startBeat) * 60 / tempo;
        sectionRange = MaxCaptureEvidenceSchema.shape.sectionRange.parse({ from, to, startBeat: from.startBeat, endBeat,
          observedTempoBpm: tempo, estimatedDurationSeconds, ...(durationSeconds === undefined ? {} : { durationSecondsOverride: durationSeconds }),
          uncertainty: "Seconds are an estimate at one observed tempo; an explicit seconds override replaces that estimate. Tempo automation/changes and native scheduler timing can end before or after the requested beat bounds. Only timing.startedBeat/endedBeat report observed capture coverage." });
        durationSeconds ??= estimatedDurationSeconds;
      }
      if (durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_AUDIO.maxDurationSeconds) throw new Error("Choose durationSeconds within 0..300 seconds, or a section range whose tempo estimate fits that bound. An explicit seconds override does not promise the whole section range.");
      const request = { ...input, ...(sectionRange ? { startBeat: sectionRange.startBeat } : {}), durationSeconds };
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
          bytes, provenance: "max-device-capture", capture: { capturedAt: new Date().toISOString(), ...facts, ...(sectionRange ? { sectionRange } : {}) },
          purpose: captured.source.stage === "post-fx" || captured.source.stage === "post-mixer" ? "processed-bounce" : "reference",
          source: `${captured.source.name}; ${captured.source.stage}; recorded through Ode on ${captured.host.trackName}. ${captured.timing.rangeUncertainty}` }, ctx.signal);
        if (ctx.signal?.aborted) return { ...record, retained: true };
        return attachAudioFile({ ...await library.open(record.id), retained: true,
          availability: "Reopen this id with library_audio_open or audio_read to attach it again after compaction or in a later request." }, ctx.signal);
      } finally {
        await rm(captured.path, { force: true });
      }
    },
  }),
];
