import { createHash } from "node:crypto";
import { LibraryProfileSchema } from "../../shared/audio-library";
import type { LibraryProfile, LibraryProfileLevel } from "../../shared/audio-library";
import { measurementReport } from "../../tools/audio/report";
import { AudioFileDecoder } from "./decode";
import { AudioMeasurement } from "./measurement";

/** Profile one captured whole file. Header inspection never decodes or measures sample values. */
export function buildLibraryProfile(bytes: Uint8Array, level: LibraryProfileLevel = "metadata"): LibraryProfile {
  const captured = new Uint8Array(bytes);
  const decoder = new AudioFileDecoder();
  const info = decoder.inspect(captured, "Library audio");
  const profile = {
    version: 1,
    method: "ode-audio-profile-v1",
    measuredAt: new Date().toISOString(),
    sha256: createHash("sha256").update(captured).digest("hex"),
    bytes: captured.byteLength,
    level,
    ...info,
    durationSeconds: info.frames / info.sampleRate,
    sampleValues: "unexamined",
  };
  if (level !== "full") return LibraryProfileSchema.parse(profile);
  if (info.frames === 0) throw new Error("Library audio has no sample frames to measure.");

  const measurement = new AudioMeasurement(decoder.decode(captured, "Library audio", { rejectNonfinite: true }));
  const report = measurementReport(measurement);
  const finite = (value: number) => Number.isFinite(value) ? value : null;
  return LibraryProfileSchema.parse({
    ...profile,
    sampleValues: "validated-finite",
    measurements: {
      integratedLufs: report.loudness.integratedStatus === "measured" ? finite(measurement.loudness.integrated) : null,
      truePeakDbtp: finite(measurement.truePeak),
      samplePeakDbfs: finite(measurement.samplePeak),
      tiltDbPerOctave: measurement.tone.silent ? null : finite(measurement.tone.summary().tilt),
      loudnessStatus: report.loudness.integratedStatus,
      coverage: report.loudness.coverage,
    },
    report,
  });
}
