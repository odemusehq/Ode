import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, sep } from "node:path";
import { z } from "zod";

/** Browser-selected bytes stay within the SDK's persistent storage and temporary folders. */
export const MAX_AUDIO_UPLOAD_BYTES = 128 * 1024 * 1024;
const AUDIO_SUFFIX = /\.(wav|wave|aif|aiff|aifc|flac|mp3|ogg|m4a)$/i;
const ANALYSIS_SUFFIX = /\.(wav|wave|aif|aiff|aifc)$/i;
const ID = z.string().uuid();
const RecordSchema = z.object({
  id: ID,
  name: z.string().min(1).max(255),
  purpose: z.enum(["library", "reference", "processed-bounce"]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive().max(MAX_AUDIO_UPLOAD_BYTES),
  importedAt: z.string(),
  declaredSource: z.string().max(2000).optional(),
  range: z.object({ start: z.number().finite().min(0), end: z.number().finite().positive() }).optional(),
  provenance: z.enum(["user-supplied", "sdk-pre-fx-capture"]),
  currentness: z.literal("unknown"),
  analysisSupported: z.boolean(),
});

export type AudioFileRecord = z.infer<typeof RecordSchema>;
export type ManagedAudio = AudioFileRecord & { path: string };
export interface AudioFileInput {
  name: string;
  bytes: Uint8Array;
  purpose: AudioFileRecord["purpose"];
  source?: string;
  /** Only internal capture callers set this; browser uploads always use the user-supplied default. */
  provenance?: AudioFileRecord["provenance"];
  /** Beats declared by the musician, not inferred from the file or current tempo. */
  range?: { start: number; end: number };
}

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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

  async add(input: AudioFileInput): Promise<AudioFileRecord> {
    const name = basename(input.name.replaceAll("\\", "/"));
    if (!AUDIO_SUFFIX.test(name)) throw new Error("Choose an audio file: WAV, AIFF, FLAC, MP3, Ogg or M4A.");
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_AUDIO_UPLOAD_BYTES) {
      throw new Error("Choose an audio file between 1 byte and 128 MiB.");
    }
    if (!hasAudioHeader(name, input.bytes)) throw new Error("The file's audio header does not match its filename; export a valid audio file and attach it again.");
    if (input.range && !(input.range.end > input.range.start)) throw new Error("The declared end beat must be after the start beat.");
    const record = RecordSchema.parse({
      id: randomUUID(), name, purpose: input.purpose, sha256: hash(input.bytes), bytes: input.bytes.byteLength,
      importedAt: new Date().toISOString(), declaredSource: input.source?.trim() || undefined, range: input.range,
      provenance: input.provenance ?? "user-supplied", currentness: "unknown", analysisSupported: ANALYSIS_SUFFIX.test(name),
    });
    await mkdir(this.root, { recursive: true });
    await this.inside(this.root, true);
    const file = this.file(record);
    await writeFile(file, input.bytes, { flag: "wx" });
    try {
      await writeFile(this.metadata(record.id), JSON.stringify(record), { flag: "wx" });
    } catch (error) {
      await rm(file, { force: true });
      throw error;
    }
    return record;
  }

  /** Search names and user declarations in already-uploaded files. No host Browser or Pack inventory is implied. */
  async search(query: string, limit = 20): Promise<AudioFileRecord[]> {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const count = z.number().int().min(1).max(100).parse(limit);
    let entries: string[];
    try { entries = await readdir(await this.inside(this.root, true)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const found: AudioFileRecord[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith(".json") || !ID.safeParse(entry.slice(0, -5)).success) continue;
      const record = RecordSchema.parse(JSON.parse(await readFile(await this.inside(join(this.root, entry)), "utf8")));
      const text = `${record.name} ${record.declaredSource ?? ""} ${record.purpose}`.toLowerCase();
      if (words.every((word) => text.includes(word))) found.push(record);
      if (found.length >= count) break;
    }
    return found;
  }

  /** An exact-byte working copy that existing temp-only analysis and Live import tools may consume. */
  async open(id: string): Promise<ManagedAudio> {
    ID.parse(id);
    const record = RecordSchema.parse(JSON.parse(await readFile(await this.inside(this.metadata(id)), "utf8")));
    if (record.id !== id) throw new Error("The audio catalogue entry has the wrong identifier.");
    const bytes = await readFile(await this.inside(this.file(record)));
    if (bytes.byteLength !== record.bytes || hash(bytes) !== record.sha256) throw new Error("The stored audio changed; attach the original file again.");
    await mkdir(this.tempDirectory, { recursive: true });
    const path = join(this.tempDirectory, `${randomUUID()}${extname(record.name).toLowerCase()}`);
    await writeFile(path, bytes, { flag: "wx" });
    await writeFile(`${path}.ode.json`, JSON.stringify(record), { flag: "wx" });
    return { ...record, path };
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
  const record = RecordSchema.parse(JSON.parse(json));
  const bytes = frozenBytes ?? await readFile(path);
  if (bytes.byteLength !== record.bytes || hash(bytes) !== record.sha256) throw new Error("The attached audio changed; reopen the original from Ode's audio library.");
  return record;
}
