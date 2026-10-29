import { z } from "zod";
import { AudioMeasurement, decode, levelCheck, maskingCheck } from "../../music/audio";
import { defineTool } from "../define";
import { TrackRefSchema } from "../live/schemas";
import { ArrangementAudio, requireRange } from "./arrangement-audio";
import { measurementReport } from "./report";
import type { SkippedTrack } from "./arrangement-audio";

interface MeasuredTrack {
  name: string;
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
    "Returns { range: { start, end }, tracks: [{ name, truePeakDbtp, samplePeakDbfs, loudness: { integratedLufs, momentaryMaxLufs, shortTermMaxLufs, rangeLu }, spectrum: { tiltDbPerOctave, strongestBand, regions } }], masking: [{ tracks, band, advice }] (worst first), levels: [{ track, issue, advice }] (track is null for the tracks as a whole), skipped: [{ track, reason }] }.",
    "Track names do not decide which part should give way. Read-only.",
  ].join(" "),
  input: {
    tracks: z.array(TrackRefSchema).min(1).describe("Arrangement audio tracks to compare."),
    start: z.number().min(0).describe("Start of the range, in beats."),
    end: z.number().min(0).describe("End of the range, in beats."),
  },
  changes: "none",
  async run(input, ctx) {
    requireRange(input.start, input.end);
    const arrangement = new ArrangementAudio(ctx);
    const measured: MeasuredTrack[] = [];
    const skipped: SkippedTrack[] = [];
    for (const ref of input.tracks) {
      const lookup = await arrangement.resolve(ref);
      if ("skipped" in lookup) {
        skipped.push(lookup.skipped);
        continue;
      }
      try {
        const audio = await arrangement.withRender(lookup.track.ref, input.start, input.end, decode);
        measured.push({ name: lookup.track.name, measurement: new AudioMeasurement(audio) });
      } catch (error) {
        skipped.push({ track: lookup.track.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      range: { start: input.start, end: input.end },
      signalStage: "pre-effects, pre-fader Arrangement source audio",
      limitations: "Spectral overlap is a candidate only. Temporal masking, post-processing levels, bus/Main peaks, routing and audible improvement are unmeasured.",
      tracks: measured.map(({ name, measurement }) => {
        const report = measurementReport(measurement);
        return {
          name,
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
