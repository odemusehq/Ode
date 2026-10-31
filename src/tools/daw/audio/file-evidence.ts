import { audioProvenance } from "../../../live/local-audio-files";
import { MusicAudio, type FrozenMusicAudio } from "../../../services/music-audio";
import { withAudio } from "../../define";

/** Opening/capturing a file returns audio directly to the same agent, alongside its normal metadata. */
export async function attachAudioFile<T extends { path: string }>(result: T, signal?: AbortSignal) {
  if (signal?.aborted) return result;
  try {
    const read = await new MusicAudio().read(result.path);
    if (signal?.aborted) return result;
    const metadata = { ...result, audioAttached: true, audioPayload: read.payload };
    return withAudio(metadata, [{ description: JSON.stringify(metadata), content: read.content }]);
  } catch (error) {
    // A successful native capture or file copy remains available even if its codec cannot be attached.
    return { ...result, audioAttached: false, audioError: error instanceof Error ? error.message : String(error) };
  }
}

/** Call only after managed-path validation, or for an SDK render in the extension's temp folder. */
export async function audioFileEvidence(path: string, frozen?: FrozenMusicAudio) {
  const source = frozen ?? await MusicAudio.freeze(path);
  const record = await audioProvenance(path, source.bytes);
  // Catalogue organisation and cached DSP reports are not source provenance; selected metadata has its own read tool.
  const provenance = record && { id: record.id, name: record.name, purpose: record.purpose, sha256: record.sha256,
    bytes: record.bytes, declaredSource: record.declaredSource, range: record.range, provenance: record.provenance,
    currentness: record.currentness, analysisSupported: record.analysisSupported, capture: record.capture, derivation: record.derivation, derivationStatus: record.derivationStatus };
  return { path, ...MusicAudio.inspect(source), provenance, currentness: "unknown", note: "Exact captured bytes; Max captures retain their actual selected routing stage and observed host timing, SDK captures cover pre-FX source audio only, and uploaded origin/stage is declared. Local excerpts retain one parent source/frame reference. None proves future Set currentness, common stem alignment, native export equivalence or complete effect tails. Catalogue labels and cached reports are separate metadata, not listening evidence." };
}
