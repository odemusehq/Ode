import { z } from "zod";
import { AudioMeasurement, decode, masterCheck } from "../../music/audio";
import { defineTool } from "../define";
import { measurementReport } from "./report";
import type { DeviceOpArgs, DeviceOpResults } from "../../shared/live-ops";

/** Seconds of the Master recorded when no length is given. */
const DEFAULT_MEASURE_SECONDS = 30;
const MS_PER_SECOND = 1000;

export const masterCheckTool = defineTool({
  name: "master_check",
  description: [
    "Measures the Master while the song plays and checks it against the musician's loudness target from Personalisation (for example −14 LUFS integrated and a −1 dBTP true-peak ceiling for streaming).",
    "Use it while building or tuning a mastering chain, and whenever the musician asks if the song is loud enough or ready for release; never judge loudness without it.",
    `It starts playback from \`from\` (beats; leave out to play from the current position), records the Master output for \`seconds\` (default ${DEFAULT_MEASURE_SECONDS}; choose a representative stretch such as the loudest chorus, or the whole song for a final check) through the Ode device, then measures loudness to ITU-R BS.1770-4 and EBU R128, true peak, sample peak and spectrum.`,
    "ok is true when integrated loudness is within ±1 LU of the target and the true peak is at or below the ceiling.",
    "advice holds plain steps: how far to move the limiter's gain or ceiling, notes on loudness range, and tonal-balance hints from the spectrum (compare with a reference track before acting on those).",
    "Returns { ok, advice: string[], target: { integratedLufs, truePeakDbtp }, readings: { durationSeconds, sampleRate, channels, loudness: { integratedLufs, momentaryMaxLufs, shortTermMaxLufs, rangeLu }, truePeakDbtp, samplePeakDbfs, spectrum: { tiltDbPerOctave, strongestBand, regions } } }; readings are null when nothing was heard.",
    "Needs the Ode device on the Master track. Changes nothing in the Set; it only starts playback.",
  ].join(" "),
  input: {
    seconds: z.number().positive().optional().describe(`How long to record the Master, in seconds (default ${DEFAULT_MEASURE_SECONDS}).`),
    from: z.number().min(0).optional().describe("Beat to start playback from; leave out to play from the current position."),
  },
  changes: "none",
  async run(input, ctx) {
    const seconds = input.seconds ?? DEFAULT_MEASURE_SECONDS;
    const timeoutSeconds = ctx.config.liveTimeouts.long / MS_PER_SECOND;
    if (seconds >= timeoutSeconds) {
      throw new Error(
        `a ${seconds} s measurement would run past the ${timeoutSeconds} s Live timeout (ODE_LIVE_LONG_TIMEOUT_SECONDS in .env): measure a shorter stretch`,
      );
    }
    const args: DeviceOpArgs["master_measure"] = { seconds, play: true, from: input.from };
    const recording = await ctx.live.device.call<DeviceOpResults["master_measure"]>("master_measure", args);
    const measurement = new AudioMeasurement(await decode(recording.path));
    const target = (await ctx.prefs.effective(await ctx.song.read())).loudnessTarget;
    const check = masterCheck(measurement.toMasterMeasure(), target);
    return {
      ok: check.ok,
      advice: check.advice,
      target: { integratedLufs: target.lufs, truePeakDbtp: target.truePeak },
      readings: measurementReport(measurement),
    };
  },
});
