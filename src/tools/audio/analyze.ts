import { z } from "zod";
import { AudioMeasurement } from "../../music/audio";
import { defineTool } from "../define";
import { TrackRefSchema } from "../live/schemas";
import { ArrangementAudio, requireRange } from "./arrangement-audio";
import { measurementReport } from "./report";
import { audioFileEvidence } from "./file-evidence";
import { MusicAudio } from "../../services/music-audio";

export const audioAnalyze = defineTool({
  name: "audio_analyze",
  description: [
    "Measures a recording: loudness to ITU-R BS.1770-4 and EBU R128 (integrated loudness, momentary maximum, short-term maximum, loudness range), true peak (four-times oversampled), sample peak, and a short spectrum summary.",
    "Use it to check a bounce, a sample, a reference track or a stretch of an Arrangement audio track before giving advice about level or tone; these numbers always come from a measurement.",
    "Inputs: either `path` (a WAV or AIFF file; other formats need exporting as WAV first), or `track` with `start` and `end` in beats to render that Arrangement audio track (its clips before the track's devices and fader; only audio tracks can be rendered).",
    "Returns { source, durationSeconds, sampleRate, channels, loudness: { integratedLufs, momentaryMaxLufs, shortTermMaxLufs, rangeLu }, truePeakDbtp, samplePeakDbfs, spectrum: { tiltDbPerOctave, strongestBand, regions: [{ region, range, levelDb }] } }.",
    "Region levels are average third-octave band levels in dB relative to full scale; the tilt is the slope of the band levels from 100 Hz to 10 kHz (more negative is darker).",
    "Loudness supports established mono/stereo layouts only: for more channels it remains null with an unsupported-layout status, while peaks and spectrum still use every channel. Other readings are null when silent (integrated loudness also needs at least 0.4 s of audio). Read-only.",
  ].join(" "),
  input: {
    path: z.string().min(1).optional().describe("Audio file to measure. Leave out when rendering a track."),
    track: TrackRefSchema.optional().describe("Arrangement audio track to render and measure (with start and end)."),
    start: z.number().min(0).optional().describe("Start of the range to render, in beats."),
    end: z.number().min(0).optional().describe("End of the range to render, in beats."),
  },
  changes: "none",
  async run(input, ctx) {
    if (input.path && (input.track !== undefined || input.start !== undefined || input.end !== undefined)) throw new Error("Choose one source: path alone, or track with start and end. Mixed selectors are not a capture of that track.");
    if (input.path) {
      const path = await ctx.temp.inside(input.path);
      const frozen = await MusicAudio.freeze(path);
      const measurement = new AudioMeasurement(MusicAudio.decode(frozen).audio);
      return { source: await audioFileEvidence(path, frozen), ...measurementReport(measurement) };
    }
    if (!input.track || input.start === undefined || input.end === undefined) {
      throw new Error("give either path, or track with start and end (beats)");
    }
    requireRange(input.start, input.end);
    const arrangement = new ArrangementAudio(ctx);
    const lookup = await arrangement.resolve(input.track);
    if ("skipped" in lookup) throw new Error(`${lookup.skipped.track} stays unrendered: ${lookup.skipped.reason}`);
    return arrangement.withRender(lookup.track.ref, input.start, input.end, async (path) => {
      const frozen = await MusicAudio.freeze(path);
      return { source: { ...frozen.source, track: lookup.track, range: { start: input.start, end: input.end }, retained: false,
        availability: "Temporary capture is removed after measurement; use audio_capture to retain a chosen capture." },
      signalStage: "pre-effects, pre-fader Arrangement source audio", currentness: "captured during this call; later Set currentness unknown", ...measurementReport(new AudioMeasurement(MusicAudio.decode(frozen).audio)) };
    });
  },
});
