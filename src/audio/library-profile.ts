import { createHash } from "node:crypto";
import { LibraryProfileSchema } from "../shared/audio-library";
import type { LibraryProfile, LibraryProfileLevel } from "../shared/audio-library";
import { AudioFileDecoder } from "./decode";

/** Inspect file/header facts only. Audio judgement and signal analysis belong to configured backends. */
export function buildLibraryProfile(bytes: Uint8Array, level: LibraryProfileLevel = "metadata"): LibraryProfile {
  if (level !== "metadata") throw new Error("Signal profiling needs a supported Ableton, Max or plug-in backend; only file metadata is available here.");
  const captured = new Uint8Array(bytes);
  const info = new AudioFileDecoder().inspect(captured, "Library audio");
  return LibraryProfileSchema.parse({
    version: 1, method: "ode-audio-profile-v1", measuredAt: new Date().toISOString(),
    sha256: createHash("sha256").update(captured).digest("hex"), bytes: captured.byteLength,
    level, ...info, durationSeconds: info.frames / info.sampleRate, sampleValues: "unexamined",
  });
}
