import { audioProvenance } from "../../live/local-audio-files";
import { MusicAudio, type FrozenMusicAudio } from "../../services/music-audio";

/** Call only after managed-path validation, or for an SDK render in the extension's temp folder. */
export async function audioFileEvidence(path: string, frozen?: FrozenMusicAudio) {
  const source = frozen ?? await MusicAudio.freeze(path);
  return { path, ...MusicAudio.inspect(source), provenance: await audioProvenance(path, source.bytes), currentness: "unknown", note: "Exact captured bytes; an uploaded origin/stage is declared, while SDK captures cover pre-FX source audio only. Neither proves the current processed Set, common stem origin or complete effect tails." };
}
