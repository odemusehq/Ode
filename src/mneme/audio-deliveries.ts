import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, realpath, rm, stat } from "node:fs/promises";
import { dirname, extname, join, sep } from "node:path";
import { z } from "zod";
import type { LocalAudioFiles } from "../live/local-audio-files";
import { AudioFileDecoder } from "../music/audio/decode";
import { AudioDeliveryManifestSchema, AudioDeliveryNameSchema, AudioDeliveryRefSchema, type AudioDeliveryManifest, type AudioDeliveryRef } from "../shared/audio-delivery";
import { JsonFile } from "./json-file";
import type { SongStore } from "./song-store";

export class AudioDeliveryError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) { super(message); }
}

interface DeliveryDeps {
  song: Pick<SongStore, "directoryFor">;
  audio: Pick<LocalAudioFiles, "readVerified">;
  attach: (songId: string, exchangeId: string, ref: AudioDeliveryRef) => Promise<void>;
}

const RetainSchema = z.object({ songId: z.uuid(), exchangeId: z.string().min(1).max(1000), audioId: z.uuid(), name: AudioDeliveryNameSchema });
const queues = new Map<string, Promise<unknown>>();
const LINK_WARNING = "The audio is retained, but its chat link was not saved. Reopen this song or read audio_delivery_list to recover the link.";
const types: Readonly<Record<AudioDeliveryManifest["extension"], string>> = {
  ".wav": "audio/wav", ".wave": "audio/wav", ".aif": "audio/aiff", ".aiff": "audio/aiff", ".aifc": "audio/aiff",
};
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function serial<T>(root: string, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(root) ?? Promise.resolve()).then(work, work);
  queues.set(root, run);
  void run.finally(() => { if (queues.get(root) === run) queues.delete(root); }).catch(() => undefined);
  return run;
}

/** Exact retained copies of selected managed audio. A manifest, not a reply, is the publication receipt. */
export class AudioDeliveries {
  constructor(private readonly deps: DeliveryDeps) {}

  async retain(input: z.input<typeof RetainSchema>, options: { signal?: AbortSignal; maxResultChars?: number } = {}): Promise<{ delivery: AudioDeliveryRef; linkWarning?: string }> {
    const request = RetainSchema.parse(input), { signal } = options;
    signal?.throwIfAborted();
    const root = await this.location(request.songId, true);
    signal?.throwIfAborted();
    return serial(root, async () => {
      signal?.throwIfAborted();
      const existing = (await this.manifests(root, request.songId)).items.find((item) => item.exchangeId === request.exchangeId && item.sourceAudioId === request.audioId && item.name === request.name);
      signal?.throwIfAborted();
      if (existing) {
        await this.retainedBytes(root, existing);
        signal?.throwIfAborted();
        this.admit(existing, options.maxResultChars);
        return this.link(existing, signal);
      }
      const source = await this.deps.audio.readVerified(request.audioId);
      signal?.throwIfAborted();
      const bytes = Uint8Array.from(source.bytes);
      if (hash(bytes) !== source.record.sha256 || bytes.length !== source.record.bytes) throw new AudioDeliveryError("The captured source changed; choose the managed audio again.", 409);
      const extension = extname(source.record.name).toLowerCase() as AudioDeliveryManifest["extension"];
      if (!Object.hasOwn(types, extension)) throw new AudioDeliveryError("Exact delivery currently needs PCM WAV or AIFF. Export that format in Live and attach it first.");
      if (extname(request.name).toLowerCase() !== extension) throw new AudioDeliveryError("Keep the supplied audio extension in the download name. Renaming does not convert its format.");
      const decoder = new AudioFileDecoder();
      const inspected = decoder.inspect(bytes, "Delivery audio");
      const wavExtension = extension === ".wav" || extension === ".wave";
      if ((inspected.format === "WAV") !== wavExtension) throw new AudioDeliveryError("The inspected audio container differs from the source filename. Attach a correctly named original file before retaining it.");
      if (!inspected.frames) throw new AudioDeliveryError("The supplied audio has no sample frames to retain.");
      decoder.decode(bytes, "Delivery audio", { rejectNonfinite: true });
      const record = source.record;
      const manifest = AudioDeliveryManifestSchema.parse({
        version: 1, id: randomUUID(), songId: request.songId, name: request.name, sourceAudioId: record.id,
        sha256: record.sha256, bytes: bytes.length, createdAt: new Date().toISOString(), provenance: record.provenance, currentness: "unknown",
        exchangeId: request.exchangeId, extension,
        source: { id: record.id, name: record.name, purpose: record.purpose, sha256: record.sha256, bytes: record.bytes,
          provenance: record.provenance, currentness: "unknown", declaredSource: record.declaredSource, range: record.range, derivation: record.derivation },
        audio: { ...inspected, durationSeconds: inspected.frames / inspected.sampleRate },
      });
      this.admit(manifest, options.maxResultChars);
      const target = join(root, `${manifest.id}${extension}`);
      const manifestPath = join(root, `${manifest.id}.json`);
      try {
        await stat(manifestPath);
        throw new AudioDeliveryError("That delivery identifier already exists. Retry with a fresh identifier; the earlier delivery was kept.", 409);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      let created = false, published = false;
      try {
        signal?.throwIfAborted();
        const file = await open(target, "wx", 0o600);
        created = true;
        try { signal?.throwIfAborted(); await file.writeFile(bytes); signal?.throwIfAborted(); await file.sync(); } finally { await file.close(); }
        signal?.throwIfAborted();
        // This atomic metadata write is the commit point. A later Stop never deletes a published file.
        await JsonFile.writeAtomically(manifestPath, JSON.stringify(manifest), 0o600, signal);
        published = true;
      } finally { if (created && !published) await rm(target, { force: true }); }
      return this.link(manifest, signal);
    });
  }

  async list(songId: string, options: { exchangeId?: string; offset?: number; limit?: number } = {}) {
    const offset = z.number().int().min(0).max(100000).parse(options.offset ?? 0);
    const limit = z.number().int().min(1).max(100).parse(options.limit ?? 10);
    let root: string;
    try { root = await this.location(songId); }
    catch (error) { if (error instanceof AudioDeliveryError && error.status === 404) return { items: [], total: 0, offset, nextOffset: null, unreadable: 0 }; throw error; }
    const found = await this.manifests(root, songId);
    const items = found.items.filter((item) => options.exchangeId === undefined || item.exchangeId === options.exchangeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return { items: items.slice(offset, offset + limit).map((item) => AudioDeliveryRefSchema.parse(item)), total: items.length, offset,
      nextOffset: offset + limit < items.length ? offset + limit : null, unreadable: found.unreadable };
  }

  async read(songId: string, id: string): Promise<AudioDeliveryManifest> {
    z.uuid().parse(id);
    const root = await this.location(songId);
    return this.manifest(root, songId, id);
  }

  async download(songId: string, id: string): Promise<{ ref: AudioDeliveryRef; bytes: Uint8Array; contentType: string }> {
    z.uuid().parse(id);
    const root = await this.location(songId);
    const manifest = await this.manifest(root, songId, id);
    const bytes = await this.retainedBytes(root, manifest);
    return { ref: AudioDeliveryRefSchema.parse(manifest), bytes, contentType: types[manifest.extension] };
  }

  /**
   * Repair historical chat refs from canonical publication manifests. Counts describe metadata/link
   * projection only; current audio availability is checked by download or an explicit retain retry.
   */
  async recover(songId: string): Promise<{ linked: number; failed: number }> {
    let root: string;
    try { root = await this.location(songId); }
    catch (error) { if (error instanceof AudioDeliveryError && error.status === 404) return { linked: 0, failed: 0 }; throw error; }
    const found = await this.manifests(root, songId);
    let linked = 0, failed = found.unreadable;
    for (const manifest of found.items) {
      try {
        await this.deps.attach(songId, manifest.exchangeId, AudioDeliveryRefSchema.parse(manifest));
        linked++;
      } catch { failed++; }
    }
    return { linked, failed };
  }

  private admit(manifest: AudioDeliveryManifest, maxChars?: number): void {
    if (maxChars !== undefined && JSON.stringify({ delivery: AudioDeliveryRefSchema.parse(manifest), linkWarning: LINK_WARNING }).length > maxChars) {
      throw new AudioDeliveryError("The delivery receipt exceeds the tool result limit. Use a shorter filename or increase the configured limit before retaining audio.");
    }
  }

  private async link(manifest: AudioDeliveryManifest, signal?: AbortSignal) {
    const delivery = AudioDeliveryRefSchema.parse(manifest);
    if (signal?.aborted) return { delivery, linkWarning: LINK_WARNING };
    try { await this.deps.attach(manifest.songId, manifest.exchangeId, delivery); return { delivery }; }
    catch { return { delivery, linkWarning: LINK_WARNING }; }
  }

  private async manifests(root: string, songId: string) {
    const items: AudioDeliveryManifest[] = [];
    let unreadable = 0;
    for (const name of await readdir(root)) {
      if (!/^[a-f0-9-]{36}\.json$/i.test(name)) continue;
      try { items.push(await this.manifest(root, songId, name.slice(0, -5))); } catch { unreadable++; }
    }
    return { items, unreadable };
  }

  private async manifest(root: string, songId: string, id: string) {
    try {
      z.uuid().parse(id);
      const file = await this.inside(root, join(root, `${id}.json`));
      const manifest = AudioDeliveryManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
      if (manifest.id !== id || manifest.songId !== songId) throw new Error("Wrong delivery identity");
      return manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AudioDeliveryError("That retained delivery is missing.", 404);
      if (error instanceof AudioDeliveryError) throw error;
      throw new AudioDeliveryError("That delivery manifest is invalid or belongs to another song.", 409);
    }
  }

  private async retainedBytes(root: string, manifest: AudioDeliveryManifest) {
    let bytes: Uint8Array;
    try { bytes = await readFile(await this.inside(root, join(root, `${manifest.id}${manifest.extension}`))); }
    catch (error) { if (error instanceof AudioDeliveryError) throw error; throw new AudioDeliveryError("That retained audio file is missing.", 404); }
    if (bytes.length !== manifest.bytes || hash(bytes) !== manifest.sha256) throw new AudioDeliveryError("The retained audio changed. Download was refused; retain the intended original again.", 409);
    return bytes;
  }

  private async inside(root: string, path: string) {
    const actual = await realpath(path);
    if (!actual.startsWith(root + sep)) throw new AudioDeliveryError("Delivery files must stay inside this song's managed release folder.", 409);
    return actual;
  }

  private async location(songId: string, create = false) {
    z.uuid().parse(songId);
    const directory = await this.deps.song.directoryFor(songId);
    try {
      if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
      const [parent, song] = await Promise.all([realpath(dirname(directory)), realpath(directory)]);
      if (song !== join(parent, songId)) throw new AudioDeliveryError("The song folder must remain in Ode's managed song storage.", 409);
      let root = song;
      for (const name of ["release", "audio-deliveries"]) {
        const expected = join(root, name);
        if (create) await mkdir(expected, { mode: 0o700 }).catch((error) => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
        root = await realpath(expected);
        if (root !== expected || !(await stat(root)).isDirectory()) throw new AudioDeliveryError("Delivery storage must remain inside this song's managed release folder.", 409);
      }
      return root;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AudioDeliveryError("This song has no retained audio deliveries yet.", 404);
      throw error;
    }
  }
}
