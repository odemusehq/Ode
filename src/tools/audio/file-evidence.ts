import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { audioProvenance } from "../../live/local-audio-files";
import { AudioFileDecoder } from "../../music/audio/decode";

/** Call only after managed-path validation, or for an SDK render in the extension's temp folder. */
export async function audioFileEvidence(path: string) {
  const bytes = await readFile(path);
  const format = new AudioFileDecoder().inspect(bytes, path);
  return { path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, ...format, provenance: await audioProvenance(path), currentness: "unknown", note: "Exact file metadata; declared origin and signal stage are not independently verified. Matching durations do not prove a common stem origin or effect tails." };
}
