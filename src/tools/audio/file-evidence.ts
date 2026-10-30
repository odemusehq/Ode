import { audioProvenance } from "../../live/local-audio-files";
import { MusicAudio, type FrozenMusicAudio } from "../../services/music-audio";

/** Call only after managed-path validation, or for an SDK render in the extension's temp folder. */
export async function audioFileEvidence(path: string, frozen?: FrozenMusicAudio) {
  const source = frozen ?? await MusicAudio.freeze(path);
  const record = await audioProvenance(path, source.bytes);
  // Catalogue organisation and cached DSP reports are not source provenance; selected metadata has its own read tool.
  const provenance = record && { id: record.id, name: record.name, purpose: record.purpose, sha256: record.sha256,
    bytes: record.bytes, declaredSource: record.declaredSource, range: record.range, provenance: record.provenance,
    currentness: record.currentness, analysisSupported: record.analysisSupported };
  return { path, ...MusicAudio.inspect(source), provenance, currentness: "unknown", note: "Exact captured bytes; an uploaded origin/stage is declared, while SDK captures cover pre-FX source audio only. Neither proves the current processed Set, common stem origin or complete effect tails. Catalogue labels and cached reports are separate metadata, not listening evidence." };
}
