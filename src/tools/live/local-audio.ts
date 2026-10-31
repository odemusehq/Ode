import { t } from "../../shared/i18n";
import { z } from "zod";
import { LocalAudioFiles, type AudioFileRecord } from "../../live/local-audio-files";
import { buildLibraryProfile } from "../../audio/library-profile";
import { LibraryAnnotationsPatchSchema, LibraryProfileLevelSchema, LibrarySearchSchema } from "../../shared/audio-library";
import { defineTool, type AnyTool, type ToolContext } from "../define";

const detailSections = z.enum(["source", "annotations", "profile"]);
type DetailSection = z.infer<typeof detailSections>;
const fingerprint = z.string().regex(/^[0-9a-f]{64}$/);

/** Discovery previews never replace exact metadata, available separately by id and section. */
function summary(record: AudioFileRecord) {
  const annotations = record.annotations, profile = record.profile;
  return {
    id: record.id, name: record.name, purpose: record.purpose, sha256: record.sha256, bytes: record.bytes,
    importedAtPreview: record.importedAt.slice(0, 40), importedAtChars: record.importedAt.length,
    provenance: record.provenance, currentness: record.currentness, analysisSupported: record.analysisSupported,
    declaredSourcePreview: record.declaredSource?.slice(0, 120), declaredSourceChars: record.declaredSource?.length ?? 0,
    annotationsStatus: record.annotationsStatus, profileStatus: record.profileStatus,
    annotations: annotations && {
      revision: annotations.revision, enteredBy: annotations.enteredBy, exchangeId: annotations.exchangeId,
      labelsPreview: annotations.labels?.slice(0, 4) ?? [], labelsCount: annotations.labels?.length ?? 0,
      role: annotations.role, kind: annotations.kind, declaredBpm: annotations.declaredBpm, declaredKey: annotations.declaredKey,
      notesPreview: annotations.notes?.slice(0, 120), notesChars: annotations.notes?.length ?? 0,
    },
    profile: profile && {
      level: profile.level, version: profile.version, method: profile.method, sha256: profile.sha256, bytes: profile.bytes,
      measuredAtPreview: profile.measuredAt.slice(0, 40), format: profile.format, sampleRate: profile.sampleRate,
      channels: profile.channels, channelLayout: profile.channelLayout, frames: profile.frames,
      durationSeconds: profile.durationSeconds, sampleValues: profile.sampleValues,
    },
  };
}

const windowSize = (ctx: ToolContext) => ctx.config.limits.toolResultMaxChars;
const fits = (value: unknown, limit: number) => JSON.stringify(value).length <= limit;

function bounded<T>(value: T, limit: number): T {
  if (!fits(value, limit)) throw new Error("The tool result window is too small for this catalogue response. Increase toolResultMaxChars.");
  return value;
}

function writeAcknowledgement(record: AudioFileRecord, limit: number) {
  const card = summary(record);
  if (fits(card, limit)) return card;
  const compact = { id: record.id, saved: true, annotationsRevision: record.annotations?.revision ?? 0, profileLevel: record.profile?.level ?? null };
  return fits(compact, limit) ? compact : bounded({ id: record.id, saved: true }, limit);
}

function sectionValue(record: AudioFileRecord, section: DetailSection): unknown {
  if (section === "annotations") return record.annotations ?? null;
  if (section === "profile") {
    const { report, ...profile } = record.profile ?? {};
    return record.profile ? profile : null;
  }
  const { annotations: _annotations, profile: _profile, ...source } = record;
  return source;
}

function details(record: AudioFileRecord, section: DetailSection, detailHash: string, offset: number, requested: number | undefined, limit: number) {
  const value = sectionValue(record, section), json = JSON.stringify(value);
  if (offset > json.length) throw new Error("That metadata offset is past the selected section. Read it again from offset 0.");
  const header = { id: record.id, section, detailHash, annotationsStatus: record.annotationsStatus, profileStatus: record.profileStatus,
    ...(section === "profile" ? { reportAvailable: false } : {}) };
  const full = { ...header, format: "json", value };
  if (offset === 0 && (requested === undefined || json.length <= requested) && fits(full, limit)) return full;
  const fragment = (end: number) => ({ ...header, format: "json-fragment", json: json.slice(offset, end),
    offset, nextOffset: end < json.length ? end : null, totalChars: json.length, offsetUnit: "UTF-16 code units in serialized JSON" });
  let low = offset, high = Math.min(json.length, offset + (requested ?? 20_000));
  if (fits(fragment(high), limit)) return fragment(high);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(fragment(middle), limit)) low = middle; else high = middle - 1;
  }
  if (low === offset && offset < json.length) throw new Error("The tool result window is too small for one metadata fragment. Increase toolResultMaxChars.");
  return bounded(fragment(low), limit);
}

export const localAudioTools: AnyTool[] = [
  defineTool({
    name: "library_audio_search",
    description: [
      "Find explicitly attached audio and deliberately retained audio_capture files in Ode's managed catalogue. Never scans the native Browser, Packs or arbitrary folders.",
      "query uses case-insensitive AND substrings across filename, declared source, purpose, labels, role, kind, notes and declared key. Use declaredBpm for tempo filtering. labels requires all exact normalised labels; role, kind, purpose and declaredKey are structured filters. declaredBpm/declaredKey are Ode-entered declarations, never measured tempo or key.",
      "durationSeconds and channels filter saved whole-file header metadata; bounds are inclusive and use exact values. Unknown metadata cannot match a requested numeric filter. No audio is decoded, measured or written during search. Historical custom signal analyses are not exposed or used for search.",
      "Returns compact discovery items with explicit text/label previews and counts, total, offset, nextOffset, coverage and selectionFingerprint. Read exact selected metadata with library_audio_read; reports and long text are not included here. limit defaults to 20, at most 100, and the actual page may be smaller to fit the result window. Sorts newest import first with id as tie-breaker. Continue with nextOffset and expectedSelectionFingerprint; a changed matching list refuses and requires a fresh offset 0 search. This token guards membership/order, not an atomic snapshot of mutable card values. Coverage distinguishes unprofiled, unknown-excluded and unreadable records, so no matches need not mean no suitable audio exists.",
      "Cached profiles bind bytes when measured; search does not recheck stored audio integrity. library_audio_open or library_audio_profile verifies the asset before use. Provenance and current processed Set sound remain separate; unchanged bytes do not prove currentness. Read-only.",
    ].join(" "),
    input: LibrarySearchSchema.shape,
    changes: "none",
    run: async (input, ctx) => {
      const found = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).searchRecords(input);
      const items: ReturnType<typeof summary>[] = [];
      const page = () => ({ ...found, items, nextOffset: found.offset + items.length < found.total ? found.offset + items.length : null });
      for (const record of found.items) {
        items.push(summary(record));
        if (!fits(page(), windowSize(ctx))) { items.pop(); break; }
      }
      if (found.items.length && !items.length) throw new Error("The tool result window is too small for one catalogue summary. Increase toolResultMaxChars.");
      return bounded(page(), windowSize(ctx));
    },
  }),
  defineTool({
    name: "library_audio_read",
    changes: "none",
    description: [
      "Read exact saved metadata for one managed audio id without opening/copying, hashing or decoding the audio. section defaults to source (identity and declared source); annotations returns full declarations and revision; profile returns exact header metadata. Historical custom signal analyses are not exposed. Invalid/stale advisory data stays explicitly unavailable.",
      "A fitting section returns format json and value. An oversized section returns format json-fragment, exact serialized JSON text in json, offset, nextOffset and totalChars; concatenate fragments in order before parsing. Offsets/limit are UTF-16 code units of that JSON text, not audio frames or bytes. limit optionally bounds a fragment (at most 20000); the actual fragment may be smaller to fit its escaped JSON envelope.",
      "Every result includes detailHash, a fingerprint of the observed metadata file, not the audio hash. For every later offset give that same detailHash; metadata changes refuse instead of combining revisions. Read-only cached metadata does not verify current stored audio bytes or processed Set sound; use library_audio_open before analysis/import.",
    ].join(" "),
    input: { id: z.uuid(), section: detailSections.optional(), offset: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(20_000).optional(), detailHash: fingerprint.optional() },
    observationTargets: () => [],
    run: async ({ id, section, offset, limit, detailHash }, ctx) => {
      if ((offset ?? 0) > 0 && !detailHash) throw new Error("Later metadata fragments need the detailHash from the first read.");
      const saved = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).get(id, detailHash);
      return details(saved.record, section ?? "source", saved.metadataFingerprint, offset ?? 0, limit, windowSize(ctx));
    },
  }),
  defineTool({
    name: "library_audio_update",
    description: [
      "Save durable labels, role, one-shot/loop/recording kind, notes or declared BPM/key on one managed audio id. Use for catalogue organisation or to retain the musician's direction.",
      "Give expectedRevision from annotations.revision (zero when annotations are absent) and patch only the fields to change. labels replaces the whole label list; [] clears it. null clears role, kind, notes, declaredBpm or declaredKey. A conflicting revision refuses the write; reread before choosing a new update.",
      "Values are recorded as Ode-entered declarations with the current conversation exchange id, not audio analysis or independently verified musician assertions. No BPM/key inference runs here. Original filename, source hash, imported provenance and currentness are protected. Returns a compact updated summary (or a minimal saved acknowledgement in a small window); library_audio_read gives exact saved metadata. Changes persistent memory and follows Manual Apply.",
    ].join(" "),
    input: { id: z.uuid(), expectedRevision: z.number().int().nonnegative(), patch: LibraryAnnotationsPatchSchema.refine((patch) => Object.keys(patch).length > 0, "Give at least one annotation field to change.") },
    changes: "memory",
    mainAgentOnly: true,
    describe: () => t("toolActivity.audioLibrarySaveLabels"),
    run: async ({ id, expectedRevision, patch }, ctx) => {
      const limit = windowSize(ctx);
      bounded({ id, saved: true }, limit);
      const record = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).annotate(id, expectedRevision, patch, { exchangeId: ctx.exchangeId }, ctx.signal);
      return writeAcknowledgement(record, limit);
    },
  }),
  defineTool({
    name: "library_audio_profile",
    description: [
      "Verify and save a whole-file profile for one explicitly managed audio id. level defaults to metadata: inspect WAV/AIFF headers for exact frames, sample rate, channels, format and duration without examining sample values.",
      "No signal analysis, pitch detection, loudness measurement or musical inference runs here. Use supported Ableton/Max operations, an installed plug-in or the configured listening model for those tasks.",
      "Returns a compact updated summary with profile level, method/version and exact source hash/bytes; library_audio_read gives exact header metadata. The profile covers the complete asset, never an excerpt, and saves no temporary path. Unsupported codecs require a WAV/AIFF export; no provider or Live call runs. Annotation edits are preserved. Changes persistent memory and follows Manual Apply.",
    ].join(" "),
    input: { id: z.uuid(), level: LibraryProfileLevelSchema.optional() },
    changes: "memory",
    mainAgentOnly: true,
    describe: () => t("toolActivity.audioLibraryInspectFileMetadata"),
    run: async ({ id, level }, ctx) => {
      ctx.signal?.throwIfAborted();
      const limit = windowSize(ctx);
      bounded({ id, saved: true }, limit);
      const record = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).profile(id, level ?? "metadata", (bytes, detail) => {
        ctx.signal?.throwIfAborted();
        const profile = buildLibraryProfile(bytes, detail);
        ctx.signal?.throwIfAborted();
        return profile;
      }, ctx.signal);
      return writeAcknowledgement(record, limit);
    },
  }),
  defineTool({
    name: "library_audio_open",
    description: "Open a file id returned by library_audio_search as an exact-byte managed working copy. Returns an exact path for audio_describe or import_into_project and a compact identity/declaration/header summary. library_audio_read gives exact metadata without copying. WAV/AIFF support the listening payload adapter; convert other formats to WAV in the DAW first. A processed-bounce declaration does not establish its routing, effects, range, tails or currentness. This does not capture or export Live audio.",
    input: { id: z.string().uuid() },
    changes: "none",
    run: async ({ id }, ctx) => {
      const opened = await new LocalAudioFiles(ctx.config.userDir, ctx.config.tempDir).open(id);
      const limit = windowSize(ctx), card = { ...summary(opened), path: opened.path };
      if (fits(card, limit)) return card;
      const compact = { id: opened.id, path: opened.path, sha256: opened.sha256, bytes: opened.bytes };
      return fits(compact, limit) ? compact : bounded({ id: opened.id, path: opened.path }, limit);
    },
  }),
];
