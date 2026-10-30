import { z } from "zod";
import { AudioMeasurement, levelCheck, maskingCheck } from "../../music/audio";
import { audioExcerpt } from "../../music/audio/excerpt";
import { MusicAudio, type FrozenMusicAudio } from "../../services/music-audio";
import type { TrackRef } from "../../shared/live";
import { defineTool } from "../define";
import { TrackRefSchema } from "../live/schemas";
import { ArrangementAudio, requireRange } from "./arrangement-audio";
import { measurementReport } from "./report";
import type { SkippedTrack } from "./arrangement-audio";

interface MeasuredTrack {
  name: string;
  ref: TrackRef;
  source: FrozenMusicAudio["source"];
  measurement: AudioMeasurement;
}

export const mixCheck = defineTool({
  name: "mix_check",
  description: [
    "Measures pre-effects, pre-fader Arrangement audio sources: peak, loudness and average spectrum. Shared strong bands are candidate spectral overlap, not diagnosed masking. It cannot establish simultaneous competition, processed mix balance or Main headroom, and does not sum independent LUFS into a bus estimate.",
    "Use it to inspect source material. Audition aligned processed material before proposing EQ, panning, sidechain or level corrections; remeasuring these sources cannot verify a device or fader change.",
    "Inputs: `tracks` (the tracks to compare), `start` and `end` (in beats; pick a stretch where the tracks play together, such as a chorus).",
    "Each track is rendered before its devices and fader, so readings show the clips' own level and tone alone, before the fader, EQ and effects.",
    "Only Arrangement audio tracks can be rendered; MIDI, group, return and Main tracks, and tracks that fail to render, are listed in `skipped` with the reason.",
    "Returns { status: complete|partial, range: { start, end }, tracks: [{ name, ref, source, durationSeconds, truePeakDbtp, samplePeakDbfs, loudness: { integratedLufs, momentaryMaxLufs, shortTermMaxLufs, rangeLu }, spectrum: { tiltDbPerOctave, strongestBand, regions } }], masking: [{ tracks, band, advice }] (worst first), levels: [{ track, issue, advice }] (track is null for the tracks as a whole), skipped: [{ track, reason }] }. If no source could be measured the call fails with the skipped reasons. Each measured source has exact captured-byte identity; temporary captures are deleted. Only measured tagged tracks are covered by its saved observation; skipped requests are not evidence.",
    "Track names do not decide which part should give way. Read-only.",
  ].join(" "),
  input: {
    tracks: z.array(TrackRefSchema).min(1).describe("Arrangement audio tracks to compare."),
    start: z.number().min(0).describe("Start of the range, in beats."),
    end: z.number().min(0).describe("End of the range, in beats."),
  },
  changes: "none",
  observationTargets: (result) => (result as { tracks: { ref: TrackRef }[] }).tracks.flatMap(({ ref }) => "tag" in ref ? [ref.tag] : []),
  async run(input, ctx) {
    requireRange(input.start, input.end);
    const arrangement = new ArrangementAudio(ctx);
    const measured: MeasuredTrack[] = [];
    const skipped: SkippedTrack[] = [];
    const seen = new Set<string>();
    for (const ref of input.tracks) {
      ctx.signal?.throwIfAborted();
      const lookup = await arrangement.resolve(ref);
      if ("skipped" in lookup) {
        skipped.push(lookup.skipped);
        continue;
      }
      const identity = JSON.stringify(lookup.track.ref);
      if (seen.has(identity)) {
        skipped.push({ track: lookup.track.name, reason: "duplicate reference to a source already included; it is not an independent track" });
        continue;
      }
      seen.add(identity);
      try {
        const captured = await arrangement.withRender(lookup.track.ref, input.start, input.end, async (path) => {
          const frozen = await MusicAudio.freeze(path);
          const decoded = MusicAudio.decode(frozen);
          return { source: decoded.source, measurement: new AudioMeasurement(audioExcerpt(decoded.audio).audio) };
        });
        ctx.signal?.throwIfAborted();
        measured.push({ ...lookup.track, ...captured });
      } catch (error) {
        ctx.signal?.throwIfAborted();
        skipped.push({ track: lookup.track.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    if (measured.length === 0) throw new Error(`No requested source could be measured. ${JSON.stringify({ skipped })}`);
    return {
      status: skipped.length ? "partial" : "complete",
      range: { start: input.start, end: input.end },
      signalStage: "pre-effects, pre-fader Arrangement source audio",
      limitations: "Spectral overlap is a candidate only. Temporal masking, post-processing levels, bus/Main peaks, routing and audible improvement are unmeasured.",
      tracks: measured.map(({ name, ref, source, measurement }) => {
        const report = measurementReport(measurement);
        return {
          name,
          ref,
          source: { ...source, retained: false, currentness: "captured during this call; later Set currentness unknown" },
          durationSeconds: report.durationSeconds,
          truePeakDbtp: report.truePeakDbtp,
          samplePeakDbfs: report.samplePeakDbfs,
          loudness: report.loudness,
          spectrum: report.spectrum,
        };
      }),
      masking: maskingCheck(measured.map(({ name, measurement }) => measurement.toTrackSpectrum(name))),
      levels: levelCheck(measured.map(({ name, measurement }) => measurement.toTrackLevel(name))),
      skipped,
    };
  },
});
