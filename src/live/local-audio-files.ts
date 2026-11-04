import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { z } from "zod";
import { JsonFile } from "../mneme/json-file";
import { AudioFileDecoder } from "../audio/decode";
import {
  AudioProvenanceSchema, MaxCaptureEvidenceSchema, AudioExcerptDerivationSchema,
  LibraryAnnotationsPatchSchema, LibraryAnnotationsSchema, LibraryProfileSchema, LibrarySearchSchema,
  type AudioExcerptDerivation,
  type LibraryAnnotations, type LibraryAnnotationsPatch, type LibraryProfile, type LibraryProfileLevel, type LibrarySearch, type LibrarySearchCoverage,
} from "../shared/audio-library";

/** Browser-selected bytes stay within the SDK's persistent storage and temporary folders. */
export const MAX_AUDIO_UPLOAD_BYTES = 128 * 1024 * 1024;
const AUDIO_SUFFIX = /\.(wav|wave|aif|aiff|aifc|flac|mp3|ogg|m4a)$/i;
const ANALYSIS_SUFFIX = /\.(wav|wave|aif|aiff|aifc)$/i;
const ID = z.string().uuid();
const BaseRecordSchema = z.object({
  id: ID,
  name: z.string().min(1).max(255),
  purpose: z.enum(["library", "reference", "processed-bounce"]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive().max(MAX_AUDIO_UPLOAD_BYTES),
  importedAt: z.string(),
  declaredSource: z.string().max(2000).optional(),
  range: z.object({ start: z.number().finite().min(0), end: z.number().finite().positive() }).optional(),
  provenance: AudioProvenanceSchema,
  capture: MaxCaptureEvidenceSchema.optional(),
  currentness: z.literal("unknown"),
  analysisSupported: z.boolean(),
}).refine((record) => (record.provenance === "max-device-capture") === Boolean(record.capture),
  "A Max capture needs its recorded routing and timing evidence.");

export type AudioFileRecord = z.infer<typeof BaseRecordSchema> & {
  annotations?: LibraryAnnotations;
  profile?: LibraryProfile;
  annotationsStatus?: "invalid";
  profileStatus?: "invalid-or-unsupported" | "stale" | "legacy-analysis";
  derivation?: AudioExcerptDerivation;
  derivationStatus?: "invalid";
};
export type ManagedAudio = AudioFileRecord & { path: string };
export interface LibrarySearchResult {
  items: AudioFileRecord[];
  total: number;
  offset: number;
  nextOffset: number | null;
  coverage: LibrarySearchCoverage;
  selectionFingerprint: string;
}
export interface AudioFileInput {
  name: string;
  bytes: Uint8Array;
  purpose: AudioFileRecord["purpose"];
  source?: string;
  /** Only internal capture callers set this; browser uploads always use the user-supplied default. */
  provenance?: "user-supplied" | "sdk-pre-fx-capture" | "max-device-capture";
  capture?: AudioFileRecord["capture"];
  /** Beats declared by the musician, not inferred from the file or current tempo. */
  range?: { start: number; end: number };
}

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const normal = (text: string) => text.trim().toLowerCase();
const updates = new Map<string, Promise<unknown>>();

/** Instances are created per tool call, so their updates must share the same per-file queue. */
function updateAsset<T>(path: string, work: () => Promise<T>): Promise<T> {
  const key = resolve(path), previous = updates.get(key) ?? Promise.resolve();
  const run = previous.then(work, work);
  updates.set(key, run);
  void run.finally(() => { if (updates.get(key) === run) updates.delete(key); }).catch(() => undefined);
  return run;
}

function validProfile(record: AudioFileRecord): LibraryProfile | undefined {
  const profile = record.profile;
  return profile?.sha256 === record.sha256 && profile.bytes === record.bytes ? profile : undefined;
}

/** Advisory data may be from a newer Ode version; it must not make valid original bytes inaccessible. */
function storedRecord(input: unknown): { raw: Record<string, unknown>; record: AudioFileRecord } {
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const record: AudioFileRecord = BaseRecordSchema.parse(raw);
  if (raw.annotations !== undefined) {
    const annotations = LibraryAnnotationsSchema.safeParse(raw.annotations);
    if (annotations.success) record.annotations = annotations.data;
    else record.annotationsStatus = "invalid";
  } else if (raw.annotationsStatus === "invalid") record.annotationsStatus = "invalid";
  const storedProfile = raw.metadataProfile ?? raw.profile;
  if (storedProfile !== undefined) {
    const profile = LibraryProfileSchema.safeParse(storedProfile);
    if (!profile.success) record.profileStatus = "invalid-or-unsupported";
    else if (profile.data.sha256 !== record.sha256 || profile.data.bytes !== record.bytes) record.profileStatus = "stale";
    else if (profile.data.level === "full") record.profileStatus = "legacy-analysis";
    else record.profile = profile.data;
  } else if (raw.profileStatus === "invalid-or-unsupported" || raw.profileStatus === "stale" || raw.profileStatus === "legacy-analysis") record.profileStatus = raw.profileStatus;
  if (raw.derivation !== undefined) {
    const derivation = AudioExcerptDerivationSchema.safeParse(raw.derivation);
    if (derivation.success && record.provenance === "local-excerpt" && derivation.data.sourceAudioId !== record.id) record.derivation = derivation.data;
    else record.derivationStatus = "invalid";
  } else if (record.provenance === "local-excerpt" || raw.derivationStatus === "invalid") record.derivationStatus = "invalid";
  return { raw, record };
}

/** Filename/MIME alone is insufficient: accept only a matching audio-container signature. Decoders validate codecs. */
function hasAudioHeader(name: string, bytes: Uint8Array): boolean {
  const text = (start: number, end: number) => Buffer.from(bytes.subarray(start, end)).toString("ascii");
  if (/\.wave?$/i.test(name)) return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  if (/\.(aif|aiff|aifc)$/i.test(name)) return text(0, 4) === "FORM" && ["AIFF", "AIFC"].includes(text(8, 12));
  if (/\.flac$/i.test(name)) return text(0, 4) === "fLaC";
  if (/\.ogg$/i.test(name)) return text(0, 4) === "OggS";
  if (/\.m4a$/i.test(name)) return text(4, 8) === "ftyp";
  return /\.mp3$/i.test(name) && (text(0, 3) === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0));
}

/** An audio catalogue of explicit uploads, never an arbitrary filesystem/library scan. */
export class LocalAudioFiles {
  private readonly root: string;

  constructor(private readonly storageDirectory: string, private readonly tempDirectory: string) {
    this.root = join(storageDirectory, "Audio");
  }

  async add(input: AudioFileInput, signal?: AbortSignal): Promise<AudioFileRecord> {
    signal?.throwIfAborted();
    const name = basename(input.name.replaceAll("\\", "/"));
    if (!AUDIO_SUFFIX.test(name)) throw new Error("Choose an audio file: WAV, AIFF, FLAC, MP3, Ogg or M4A.");
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_AUDIO_UPLOAD_BYTES) {
      throw new Error("Choose an audio file between 1 byte and 128 MiB.");
    }
    if (!hasAudioHeader(name, input.bytes)) throw new Error("The file's audio header does not match its filename; export a valid audio file and attach it again.");
    if (input.range && !(input.range.end > input.range.start)) throw new Error("The declared end beat must be after the start beat.");
    const record = BaseRecordSchema.parse({
      id: randomUUID(), name, purpose: input.purpose, sha256: hash(input.bytes), bytes: input.bytes.byteLength,
      importedAt: new Date().toISOString(), declaredSource: input.source?.trim() || undefined, range: input.range,
      provenance: input.provenance ?? "user-supplied", ...(input.capture ? { capture: input.capture } : {}),
      currentness: "unknown", analysisSupported: ANALYSIS_SUFFIX.test(name),
    });
    await mkdir(this.root, { recursive: true });
    await this.inside(this.root, true);
    const file = this.file(record);
    let created = false, published = false;
    try {
      signal?.throwIfAborted();
      const handle = await open(file, "wx", 0o600); created = true;
      try { signal?.throwIfAborted(); await handle.writeFile(input.bytes); signal?.throwIfAborted(); await JsonFile.syncFile(handle); }
      finally { await handle.close(); }
      signal?.throwIfAborted();
      await JsonFile.writeAtomically(this.metadata(record.id), JSON.stringify(record), 0o600, signal);
      published = true;
    } finally { if (created && !published) await rm(file, { force: true }); }
    return record;
  }

  /** Compatible array result for existing callers. Searches never decode or write managed assets. */
  async search(query: string, limit = 20): Promise<AudioFileRecord[]> {
    return (await this.searchRecords({ query, limit })).items;
  }

  /** Read one observed metadata document, without opening, copying or hashing its audio bytes. */
  async get(id: string, expectedMetadataFingerprint?: string): Promise<{ record: AudioFileRecord; metadataFingerprint: string }> {
    if (expectedMetadataFingerprint !== undefined) z.string().regex(/^[0-9a-f]{64}$/).parse(expectedMetadataFingerprint);
    const { record, metadataFingerprint } = await this.readStoredRecord(id);
    if (expectedMetadataFingerprint !== undefined && expectedMetadataFingerprint !== metadataFingerprint) {
      throw new Error("The selected audio metadata changed. Read this item again from offset 0 before continuing its detail pages.");
    }
    return { record, metadataFingerprint };
  }

  /** Read only the known catalogue metadata. Numeric filters exclude unknown values explicitly. */
  async searchRecords(input: LibrarySearch): Promise<LibrarySearchResult> {
    const filters = LibrarySearchSchema.parse(input);
    const words = normal(filters.query ?? "").split(/\s+/).filter(Boolean);
    const limit = filters.limit ?? 20, offset = filters.offset ?? 0;
    const coverage: LibrarySearchCoverage = { catalogue: 0, matchedDeclarations: 0, profiled: 0, unprofiled: 0, excludedUnknown: 0, unreadable: 0 };
    const result = (records: AudioFileRecord[]): LibrarySearchResult => {
      const { limit: _limit, offset: _offset, expectedSelectionFingerprint: _expected, ...selection } = filters;
      const selectionFingerprint = hash(Buffer.from(JSON.stringify({ filters: selection, ids: records.map((record) => record.id) })));
      if (filters.expectedSelectionFingerprint !== undefined && filters.expectedSelectionFingerprint !== selectionFingerprint) {
        throw new Error("The matching audio selection changed. Restart this search from offset 0 before continuing its pages.");
      }
      return { items: records.slice(offset, offset + limit), total: records.length, offset,
        nextOffset: offset + limit < records.length ? offset + limit : null, coverage, selectionFingerprint };
    };
    let entries: string[];
    try { entries = await readdir(await this.inside(this.root, true)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return result([]);
      throw error;
    }
    const found: AudioFileRecord[] = [];
    const inBounds = (value: number | null | undefined, bounds: { min?: number; max?: number } | undefined): boolean | null => {
      if (!bounds) return true;
      if (value === null || value === undefined) return null;
      return (bounds.min === undefined || value >= bounds.min) && (bounds.max === undefined || value <= bounds.max);
    };
    for (const entry of entries) {
      if (!entry.endsWith(".json") || !ID.safeParse(entry.slice(0, -5)).success) continue;
      let record: AudioFileRecord;
      try { record = await this.readRecord(entry.slice(0, -5)); } catch { coverage.unreadable++; continue; }
      coverage.catalogue++;
      const declaration = record.annotations;
      const text = [record.name, record.declaredSource, record.purpose, declaration?.role, declaration?.kind, declaration?.notes,
        declaration?.declaredKey, ...(declaration?.labels ?? [])].filter(Boolean).join(" ").toLowerCase();
      if (!words.every((word) => text.includes(word)) || filters.purpose && record.purpose !== filters.purpose) continue;
      const declarations = [
        !filters.labels || filters.labels.every((label) => declaration?.labels?.some((saved) => normal(saved) === normal(label))),
        !filters.role ? true : declaration?.role ? normal(declaration.role) === normal(filters.role) : null,
        !filters.kind ? true : declaration?.kind ? declaration.kind === filters.kind : null,
        !filters.declaredKey ? true : declaration?.declaredKey ? normal(declaration.declaredKey) === normal(filters.declaredKey) : null,
        inBounds(declaration?.declaredBpm, filters.declaredBpm),
      ];
      if (declarations.includes(false)) continue;
      if (declarations.includes(null)) { coverage.excludedUnknown++; continue; }
      coverage.matchedDeclarations++;
      const profile = validProfile(record);
      if (profile) coverage.profiled++; else coverage.unprofiled++;
      const measured = [
        !filters.profileDetail ? true : profile ? profile.level === "metadata" : null,
        inBounds(profile ? profile.frames / profile.sampleRate : undefined, filters.durationSeconds),
        filters.channels === undefined ? true : profile ? profile.channels === filters.channels : null,
      ];
      if (measured.includes(false)) continue;
      if (measured.includes(null)) { coverage.excludedUnknown++; continue; }
      // A stale cache is not exposed as a reading of this catalogue entry.
      const visible = { ...record };
      if (!profile) delete visible.profile;
      found.push(visible);
    }
    found.sort((a, b) => b.importedAt.localeCompare(a.importedAt) || a.id.localeCompare(b.id));
    return result(found);
  }

  /** Only declaration fields change here; the source identity and technical provenance remain immutable. */
  async annotate(id: string, expectedRevision: number, input: LibraryAnnotationsPatch, actor: { exchangeId?: string }, signal?: AbortSignal): Promise<AudioFileRecord> {
    signal?.throwIfAborted();
    ID.parse(id);
    z.number().int().nonnegative().parse(expectedRevision);
    const patch = LibraryAnnotationsPatchSchema.parse(input);
    if (actor.exchangeId !== undefined) ID.parse(actor.exchangeId);
    return updateAsset(await this.inside(this.metadata(id)), async () => {
      signal?.throwIfAborted();
      const { raw, record } = await this.readStoredRecord(id);
      signal?.throwIfAborted();
      if (record.annotationsStatus === "invalid") throw new Error("The saved audio declarations are invalid. Review the retained metadata before replacing them.");
      if ((record.annotations?.revision ?? 0) !== expectedRevision) throw new Error("The audio declarations changed. Read the latest revision before editing them.");
      const annotations = LibraryAnnotationsSchema.parse({ ...record.annotations, ...patch,
        ...(patch.labels ? { labels: [...new Set(patch.labels.map(normal))] } : {}),
        revision: expectedRevision + 1, enteredBy: "ode", exchangeId: actor.exchangeId, updatedAt: new Date().toISOString() });
      const next = { ...raw, annotations };
      const path = await this.inside(this.metadata(id));
      signal?.throwIfAborted();
      await JsonFile.writeAtomically(path, JSON.stringify(next), undefined, signal);
      return storedRecord(next).record;
    });
  }

  /** Compute outside the update queue, then merge only a verified whole-file profile into the latest annotations. */
  async profile(id: string, level: LibraryProfileLevel, build: (bytes: Uint8Array, level: LibraryProfileLevel) => LibraryProfile | Promise<LibraryProfile>, signal?: AbortSignal): Promise<AudioFileRecord> {
    signal?.throwIfAborted();
    if (level !== "metadata") throw new Error("Only header metadata is supported; signal measurements require a native or plug-in backend.");
    const captured = await this.verified(id);
    signal?.throwIfAborted();
    const profile = LibraryProfileSchema.parse(await build(captured.bytes, level));
    signal?.throwIfAborted();
    if (profile.sha256 !== captured.record.sha256 || profile.bytes !== captured.record.bytes || profile.level !== level || hash(captured.bytes) !== profile.sha256) {
      throw new Error("The profile does not match the captured audio bytes and requested detail.");
    }
    return updateAsset(await this.inside(this.metadata(id)), async () => {
      signal?.throwIfAborted();
      const current = await this.verified(id);
      signal?.throwIfAborted();
      if (current.record.sha256 !== profile.sha256 || current.record.bytes !== profile.bytes) throw new Error("The stored audio changed while it was profiled; profile the original again.");
      // Historical custom analyses remain untouched on disk and are not exposed as native observations.
      const next = { ...current.raw, metadataProfile: profile };
      const path = await this.inside(this.metadata(id));
      signal?.throwIfAborted();
      await JsonFile.writeAtomically(path, JSON.stringify(next), undefined, signal);
      return storedRecord(next).record;
    });
  }

  /** Validate a referenced asset without copying large recordings into the working folder. */
  async verify(id: string): Promise<AudioFileRecord> {
    return (await this.verified(id)).record;
  }

  /** Capture verified original bytes for an explicit persistent copy, without creating a working file. */
  async readVerified(id: string): Promise<{ record: AudioFileRecord; bytes: Uint8Array }> {
    const { record, bytes } = await this.verified(id);
    return { record, bytes };
  }

  /** An exact-byte working copy that existing temp-only analysis and Live import tools may consume. */
  async open(id: string): Promise<ManagedAudio> {
    const { record, bytes } = await this.verified(id);
    await mkdir(this.tempDirectory, { recursive: true });
    const path = join(this.tempDirectory, `${randomUUID()}${extname(record.name).toLowerCase()}`);
    await writeFile(path, bytes, { flag: "wx" });
    await writeFile(`${path}.ode.json`, JSON.stringify(record), { flag: "wx" });
    return { ...record, path };
  }

  private async verified(id: string) {
    const stored = await this.readStoredRecord(id), record = stored.record;
    const bytes = await readFile(await this.inside(this.file(record)));
    if (bytes.byteLength !== record.bytes || hash(bytes) !== record.sha256) throw new Error("The stored audio changed; attach the original file again.");
    return { ...stored, bytes };
  }

  private async readRecord(id: string): Promise<AudioFileRecord> {
    return (await this.readStoredRecord(id)).record;
  }

  private async readStoredRecord(id: string) {
    ID.parse(id);
    const text = await readFile(await this.inside(this.metadata(id)), "utf8");
    const stored = storedRecord(JSON.parse(text));
    if (stored.record.id !== id) throw new Error("The audio catalogue entry has the wrong identifier.");
    return { ...stored, metadataFingerprint: hash(Buffer.from(text)) };
  }

  private metadata(id: string): string { return join(this.root, `${id}.json`); }
  private file(record: AudioFileRecord): string { return join(this.root, `${record.id}${extname(basename(record.name)).toLowerCase()}`); }

  private async inside(path: string, allowRoot = false): Promise<string> {
    const [storage, root, file] = await Promise.all([realpath(this.storageDirectory), realpath(this.root), realpath(path)]);
    if (!root.startsWith(storage + sep) || !(file.startsWith(root + sep) || (allowRoot && file === root))) {
      throw new Error("The audio file must stay inside Ode's managed audio folder.");
    }
    return file;
  }
}

/** Call only after TempFolder.inside(path). Hash equality proves these bytes, never the current Live signal path. */
export async function audioProvenance(path: string, frozenBytes?: Uint8Array): Promise<AudioFileRecord | null> {
  let json: string;
  try {
    const [audioPath, metadataPath] = await Promise.all([realpath(path), realpath(`${path}.ode.json`)]);
    if (dirname(audioPath) !== dirname(metadataPath)) throw new Error("Audio provenance must stay beside the managed audio file.");
    json = await readFile(metadataPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const record = storedRecord(JSON.parse(json)).record;
  const bytes = frozenBytes ?? await readFile(path);
  if (bytes.byteLength !== record.bytes || hash(bytes) !== record.sha256) throw new Error("The attached audio changed; reopen the original from Ode's audio library.");
  return record;
}
