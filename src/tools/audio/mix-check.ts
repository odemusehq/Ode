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
    "Checks how Arrangement audio tracks sit together over a range of beats: each track's peak, loudness and spectrum summary; pairs of tracks masking each other (both strong in the same frequency band) with plain EQ or sidechain advice; and gain-staging advice (clipping risk, headroom, very low levels, balance, summed level).",
    "Use it when the mix sounds muddy, crowded or unbalanced, to find which tracks clash and where before making EQ cuts, sidechain compression or level changes, or as a gain-staging check. It hears the clips before their devices, so it can't confirm a device change: check the result with master_check on the same stretch.",
    "Inputs: `tracks` (the tracks to compare), `start` and `end` (in beats; pick a stretch where the tracks play together, such as a chorus).",
    "Each track is rendered before its devices and fader, so readings show the clips' own level and tone, not the fader, EQ or effects (track_meters_get shows post-fader meters).",
    "Only Arrangement audio tracks can be rendered; MIDI, group, return and Main tracks, and tracks that fail to render, are listed in `skipped` with the reason.",
    "Returns { range: { start, end }, tracks: [{ name, truePeakDbtp, samplePeakDbfs, loudness: { integratedLufs, momentaryMaxLufs, shortTermMaxLufs, rangeLu }, spectrum: { tiltDbPerOctave, strongestBand, regions } }], masking: [{ tracks, band, advice }] (worst first), levels: [{ track, issue, advice }] (track is null for the tracks as a whole), skipped: [{ track, reason }] }.",
    "Which track is the kick, bass or vocal is guessed from track names. Changes nothing.",
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
        const path = await arrangement.render(lookup.track.ref, input.start, input.end);
        measured.push({ name: lookup.track.name, measurement: new AudioMeasurement(await decode(path)) });
      } catch (error) {
        skipped.push({ track: lookup.track.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      range: { start: input.start, end: input.end },
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
