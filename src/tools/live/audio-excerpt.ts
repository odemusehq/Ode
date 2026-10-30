import { t } from "../../shared/i18n";
import { z } from "zod";
import { LocalAudioFiles } from "../../live/local-audio-files";
import { extractAudio } from "../../music/audio/extract";
import { AudioExcerptSelectionSchema } from "../../shared/audio-library";
import { defineTool } from "../define";

export const audioExcerptTool = defineTool({
  name: "library_audio_excerpt",
  description: [
    "Create a new managed sample from an explicit passage of one managed WAV/AIFF recording, without a separation provider or any Set edit. Give audioId, a new filename preserving the original audio extension, and selection: {unit:'seconds',from,to} or {unit:'frames',firstFrame,endFrame}. Both bounds are required. Seconds resolve to nearest source-sample boundaries; frame ends are exclusive. These are file positions, never Arrangement beats.",
    "Copies the selected interleaved source sample bytes into a minimal same-format container, preserving sample encoding/depth, channel count/layout, sample rate and float headroom. No normalization, gain, fades, resampling, dither, pitch/key/tempo change or inferred loop occurs. Cue/loop/tempo and other ancillary container metadata are omitted because their old positions may be stale. Unsupported codecs or AIFC version metadata refuse explicitly. Only the selected output samples are checked for nonfinite values.",
    "Returns a new immutable library id/hash/bytes with local-excerpt provenance and one-hop derivation: exact original source id/hash/header facts, selected frame bounds, output facts and the accepted exchange. A small result window may return a compact saved acknowledgement; library_audio_read gives the exact new record's source/derivation fields. The original file, annotations and musical material remain untouched. The excerpt does not inherit processed-Set currentness, musician labels or declared beat range.",
    "Use library_audio_open on the new id, then the existing import_into_project and clip/Simpler tools if the musician asked to place or load it. Those are separate Set changes. Persistent sample creation is main-only, follows Manual Apply and checks Stop before publication. The same accepted exchange/source/frame selection/name can retry without creating duplicate samples.",
  ].join(" "),
  input: {
    audioId: z.uuid(),
    name: z.string().trim().min(1).max(200).describe("New sample filename, preserving the supplied audio extension; no paths."),
    selection: AudioExcerptSelectionSchema,
  },
  changes: "memory",
  mainAgentOnly: true,
  observationTargets: () => [],
  describe: ({ name }) => t("toolActivity.saveSample", { name: name }),
  run: async ({ audioId, name, selection }, ctx) => {
    if (!ctx.exchangeId) throw new Error("A saved sample needs the current accepted request's exchange id.");
    const limit = ctx.config.limits.toolResultMaxChars;
    if (JSON.stringify({ id: audioId, saved: true }).length > limit) throw new Error("The result window is too small for a saved sample acknowledgement.");
    const record = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).excerpt({ audioId, name, selection, exchangeId: ctx.exchangeId }, extractAudio,
      { signal: ctx.signal, maxResultChars: limit });
    if (JSON.stringify(record).length <= limit) return record;
    const compact = { id: record.id, saved: true, provenance: record.provenance,
      firstFrame: record.derivation?.firstFrame, endFrame: record.derivation?.endFrame };
    return JSON.stringify(compact).length <= limit ? compact : { id: record.id, saved: true };
  },
});
