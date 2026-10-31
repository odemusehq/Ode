import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool, type ToolContext } from "../../define";

function folders(ctx: ToolContext) {
  if (!ctx.sampleFolders) throw new Error(t("sampleFolders.unavailable"));
  return ctx.sampleFolders;
}

export const sampleFolderTools = [defineTool({
  name: "sample_folders_get", changes: "none",
  description: "List the musician's explicitly approved local sample folder roots with rootId (id), path, availability and recognised file formats. No recursive scan runs here. Configure or remove roots only in Settings. This is read-only filesystem discovery, not Live's Browser, tags, Collections, installed Packs or private database. Use a returned id with sample_files_search to explore by filename/path, folder, format and kind. These discovery tools do not load preset/device files; use the musician's Browser for file-based presets, while existing native device insertion remains available.",
  input: {},
  describe: () => t("sampleFolders.activityFolders"),
  run: (_input, ctx) => folders(ctx).folders(ctx.signal),
}), defineTool({
  name: "sample_files_search", changes: "none",
  description: "Find local sample files only inside a rootId from sample_folders_get. Optional subfolder is relative to that approved root, query matches all whitespace-separated words in filename/path, kind and formats narrow recognised extensions. Returns matching file paths, bytes and modification times plus folder/format/kind facets with counts over matching indexed files. An empty folder facet value means files directly in the search root. navigation.subfolders separately lists up to 20 observed immediate child directories even when the query has zero matches or deeper scanning was capped; indexedMatches counts only indexed matching files, countsComplete reports completeness and listingComplete reports whether direct-directory enumeration finished. Choose a returned subfolder value to explore a smaller branch; For more child folders, repeat the request with folderOffset from navigation.nextOffset; offsets refer to this cached scan, so restart at zero after expiry or refresh. A scan visits at most 25,000 entries, indexes 10,000 recognised files, 2,000 folders, 16 nested levels and five seconds; coverage reports limits, unreadable entries and skipped links, so a partial scan cannot prove absence. Narrow subfolder and refresh to scan another branch. Metadata scans are cached in memory for five minutes, at most four scopes; cursor pages retain the same scan and filters (repeat rootId, subfolder, query, kind and formats), limit may change. A refresh replaces that scope's snapshot; changed settings, expiry or eviction invalidate cursors. Results fit the tool result window with nextCursor. Cancellation stops scanning. No symbolic links, audio/preset contents, DSP, BPM, key, genre or suitability are analysed. loadVia native_audio means a recognised audio extension whose path can be passed to the existing native import or Simpler sample-load tool; Live still validates encoding and availability. Use sample_file_open with rootId, scan.id and a selected relativePath for a managed unchanged copy to audition with audio_describe/audio_compare (supported WAV/AIFF/AIFF-C containers and encodings). All other kinds require a human Browser load, with no preset/device/groove loader implied. Source is approved_local_folders, not native Browser search.",
  input: {
    rootId: z.string().min(1).max(64), subfolder: z.string().max(4096).optional(), query: z.string().max(512).optional(),
    kind: z.enum(["audio", "preset", "device", "groove", "clip", "midi"]).optional(),
    formats: z.array(z.string().min(1).max(16)).max(16).optional(), limit: z.number().int().min(1).max(50).optional(),
    folderOffset: z.number().int().min(0).max(25000).optional(),
    cursor: z.string().min(1).max(512).optional(), refresh: z.boolean().optional(),
  },
  describe: () => t("sampleFolders.activitySearch"),
  run: (input, ctx) => folders(ctx).search(input, ctx.signal, ctx.config.limits.toolResultMaxChars),
}), defineTool({
  name: "sample_file_open", changes: "none",
  description: "Open one selected audio result from sample_files_search as an unchanged temporary working copy. Give the approved rootId, scanId from search scan.id and exact relativePath from the selected item. Revalidates current approval, snapshot lifetime and original file identity/size/modification metadata; refuses stale or replaced files, symbolic links, non-audio kinds, empty files and files over 64 MiB. This explicit step reads only the selected audio bytes, computes their SHA-256 and copies them into Ode's managed temp folder, without conversion, DSP, persistent catalogue writes or a model call. Returns path, bytes, sha256 and original source facts; path can reach existing native import/sample-load tools and audio_describe/audio_compare when the source has a supported WAV/AIFF/AIFF-C container and encoding. The container is unverified here; extensions are not proof. Other containers need native conversion before listening. The temp copy can expire between sessions; reopen from a fresh search later. It proves these copied bytes, not sound suitability or current Set sound. Presets, devices, grooves, clips and MIDI remain human Browser handoffs.",
  input: { rootId: z.string().min(1).max(64), scanId: z.string().uuid(), relativePath: z.string().min(1).max(4096) },
  describe: () => t("sampleFolders.activityOpen"),
  run: (input, ctx) => folders(ctx).open(input, ctx.temp, ctx.signal, ctx.config.limits.toolResultMaxChars),
})];
