import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SetSnapshot } from "../shared/set-snapshot";
import {
  ChangeKind,
  TrackList,
  VersionAuthor,
  type ClipField,
  type DeviceField,
  type SheetField,
  type SongField,
  type TrackField,
  type Version,
  type VersionDetail,
  type VersionListItem,
} from "../shared/versions";
import { JsonFile } from "./json-file";
import { SetDiff, SetWording, TouchedTracks } from "./set-diff";

const SONG_FIELDS = ["tempo", "key", "signature", "locators", "scenes"] as const satisfies readonly SongField[];
const TRACK_FIELDS = ["present", "name", "mute", "solo", "arm", "color"] as const satisfies readonly TrackField[];
const CLIP_FIELDS = ["present", "notes", "name", "muted", "color", "loop", "audio"] as const satisfies readonly ClipField[];
const DEVICE_FIELDS = ["present", "parameter"] as const satisfies readonly DeviceField[];
const SHEET_FIELDS = ["lyrics", "section", "details"] as const satisfies readonly SheetField[];

const TrackKeySchema = z.object({ list: z.enum(TrackList), index: z.number(), name: z.string(), tag: z.string().optional() });
const ClipKeySchema = z.union([z.object({ slot: z.number() }), z.object({ start: z.number(), lane: z.number().optional() })]);
const ChangeTargetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("song"), field: z.enum(SONG_FIELDS) }),
  z.object({ scope: z.literal("track"), track: TrackKeySchema, field: z.enum(TRACK_FIELDS) }),
  z.object({ scope: z.literal("clip"), track: TrackKeySchema, clip: ClipKeySchema, field: z.enum(CLIP_FIELDS) }),
  z.object({
    scope: z.literal("device"),
    track: TrackKeySchema,
    chain: z.array(z.number()),
    index: z.number(),
    field: z.enum(DEVICE_FIELDS),
    parameter: z.number().optional(),
  }),
  z.object({ scope: z.literal("sheet"), field: z.enum(SHEET_FIELDS), section: z.string().optional() }),
]);
const SetChangeSchema = z.object({
  kind: z.enum(ChangeKind),
  target: ChangeTargetSchema,
  label: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
const VersionSchema = z.object({
  id: z.string(),
  time: z.string(),
  author: z.enum(VersionAuthor),
  name: z.string().optional(),
  summary: z.string(),
  request: z.string().optional(),
  changes: z.array(SetChangeSchema),
});
const SNAPSHOT_PARTS = ["takenAt", "song", "signature", "tracks", "returnTracks", "main"];
const SnapshotSchema = z.custom<SetSnapshot>((value) => looksLikeSnapshot(value), "not a snapshot of the Set") as z.ZodType<SetSnapshot>;

/** A version as stored: the parsed version and its line in versions.jsonl. */
interface Entry {
  version: Version;
  line: string;
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function looksLikeSnapshot(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const parts = value as Record<string, unknown>;
  return SNAPSHOT_PARTS.every((part) => parts[part] !== undefined);
}

/** A version id that isn't in the history. */
export class VersionNotFoundError extends Error {}

/**
 * The version history of the whole Set, kept in `dir`: versions.jsonl holds every version with its changes, oldest
 * first, and snapshots/<id>.json a full snapshot every `snapshotEvery` versions, so any version is rebuilt quickly.
 * Every read and write waits its turn; files are written whole and then renamed into place.
 */
export class VersionHistory {
  private static readonly BASE_SUMMARY = "Where the history starts";
  private static readonly SNAPSHOT_EXTENSION = ".json";
  /** Digits of the counter that keeps apart versions made in the same millisecond. */
  private static readonly ID_COUNTER_DIGITS = 3;
  private readonly file: string;
  private readonly snapshots: string;
  private queue: Promise<unknown> = Promise.resolve();
  /** versions.jsonl as last read or written, with the file's modification time and size when it was. */
  private cache: { stamp: string; entries: Entry[] } | null = null;
  /** The Set as the latest version left it. */
  private newest: { id: string; snapshot: SetSnapshot } | null = null;

  constructor(
    private readonly dir: string,
    private readonly snapshotEvery: number,
  ) {
    this.file = join(dir, "versions.jsonl");
    this.snapshots = join(dir, "snapshots");
  }

  /**
   * Saves what changed since the latest version, or returns null when nothing did.
   * The first version is where the history starts: no changes, and the whole snapshot.
   */
  record(snapshot: SetSnapshot, author: VersionAuthor, summary: string, request?: string): Promise<Version | null> {
    return this.enqueue(() => this.recordNow(snapshot, author, summary, request));
  }

  /** Every version, oldest first. */
  list(): Promise<Version[]> {
    return this.enqueue(async () => (await this.entries()).map((entry) => structuredClone(entry.version)));
  }

  /** Every version as History lists it, newest first. */
  items(): Promise<VersionListItem[]> {
    return this.enqueue(async () => (await this.entries()).map((entry) => VersionHistory.item(entry.version)).reverse());
  }

  get(id: string): Promise<Version> {
    return this.enqueue(async () => structuredClone(VersionHistory.locate(await this.entries(), id).entry.version));
  }

  /**
   * A version with its changes by track, the song's and lead sheet's changes apart, and the beats in a bar of the Set
   * as that version left it.
   */
  detail(id: string): Promise<VersionDetail> {
    return this.enqueue(async () => {
      const entries = await this.entries();
      const { entry, index } = VersionHistory.locate(entries, id);
      const version = structuredClone(entry.version);
      const song = version.changes.filter((change) => change.target.scope === "song" || change.target.scope === "sheet");
      const snapshot = index === entries.length - 1 ? await this.newestSnapshot(entries) : await this.rebuild(entries, index);
      const beatsPerBar = SetWording.beatsPerBar(snapshot.signature);
      return { version, tracks: TouchedTracks.groups(version.changes), song, beatsPerBar };
    });
  }

  /** The Set as it was at a version: the nearest full snapshot at or before it, with the later changes applied. */
  snapshotAt(id: string): Promise<SetSnapshot> {
    return this.enqueue(async () => {
      const entries = await this.entries();
      return structuredClone(await this.rebuild(entries, VersionHistory.locate(entries, id).index));
    });
  }

  /** The Set as the latest version left it, or null before the first version. */
  latest(): Promise<SetSnapshot | null> {
    return this.enqueue(async () => {
      const entries = await this.entries();
      return entries.length > 0 ? structuredClone(await this.newestSnapshot(entries)) : null;
    });
  }

  /** Names a version; an empty name takes the name away. */
  name(id: string, name: string): Promise<VersionListItem> {
    return this.enqueue(async () => {
      const entries = [...(await this.entries())];
      const { entry, index } = VersionHistory.locate(entries, id);
      const version: Version = { ...entry.version };
      const trimmed = name.trim();
      if (trimmed) version.name = trimmed;
      else delete version.name;
      entries[index] = { version, line: JSON.stringify(version) };
      await this.write(entries);
      return VersionHistory.item(version);
    });
  }

  /** Drops every version after this one, with their snapshots. */
  truncateAfter(id: string): Promise<void> {
    return this.enqueue(async () => {
      const entries = await this.entries();
      const { index } = VersionHistory.locate(entries, id);
      const dropped = entries.slice(index + 1);
      if (dropped.length === 0) return;
      await this.write(entries.slice(0, index + 1));
      this.newest = null;
      await Promise.all(dropped.map((entry) => rm(this.snapshotPath(entry.version.id), { force: true })));
    });
  }

  private async recordNow(snapshot: SetSnapshot, author: VersionAuthor, summary: string, request?: string): Promise<Version | null> {
    const entries = await this.entries();
    const previous = entries.length > 0 ? await this.newestSnapshot(entries) : null;
    const changes = previous ? SetDiff.between(previous, snapshot) : [];
    if (previous && changes.length === 0) return null;
    const version: Version = {
      id: this.nextId(entries),
      time: new Date().toISOString(),
      author,
      summary: previous ? summary : VersionHistory.BASE_SUMMARY,
      changes,
    };
    if (request !== undefined) version.request = request;
    const keepsSnapshot = !previous || (await this.snapshotDue(entries));
    if (keepsSnapshot) await this.snapshotFile(version.id).write(snapshot);
    await this.write([...entries, { version, line: JSON.stringify(version) }]);
    // The same Set snapshotAt would rebuild for this version.
    this.newest = { id: version.id, snapshot: keepsSnapshot || !previous ? structuredClone(snapshot) : SetDiff.apply(previous, changes) };
    return structuredClone(version);
  }

  /** Whether the next version keeps a full snapshot: snapshotEvery versions after the last one that did. */
  private async snapshotDue(entries: readonly Entry[]): Promise<boolean> {
    const stored = await this.storedSnapshots();
    let since = 0;
    for (let index = entries.length - 1; index >= 0 && !stored.has(entries[index]?.version.id ?? ""); index--) since += 1;
    return since + 1 >= this.snapshotEvery;
  }

  private async newestSnapshot(entries: readonly Entry[]): Promise<SetSnapshot> {
    const id = entries[entries.length - 1]?.version.id;
    if (this.newest && this.newest.id === id) return this.newest.snapshot;
    const snapshot = await this.rebuild(entries, entries.length - 1);
    if (id !== undefined) this.newest = { id, snapshot };
    return snapshot;
  }

  private async rebuild(entries: readonly Entry[], index: number): Promise<SetSnapshot> {
    const stored = await this.storedSnapshots();
    let start = index;
    while (start >= 0 && !stored.has(entries[start]?.version.id ?? "")) start -= 1;
    const base = entries[start];
    if (!base) throw new Error("The version history has no full snapshot to start from");
    let snapshot = await this.snapshotFile(base.version.id).read();
    for (const entry of entries.slice(start + 1, index + 1)) snapshot = SetDiff.apply(snapshot, entry.version.changes);
    return snapshot;
  }

  /** The ids of the versions that keep a full snapshot. */
  private async storedSnapshots(): Promise<Set<string>> {
    try {
      const names = await readdir(this.snapshots);
      const extension = VersionHistory.SNAPSHOT_EXTENSION;
      return new Set(names.filter((name) => name.endsWith(extension)).map((name) => name.slice(0, -extension.length)));
    } catch (error) {
      if (isMissingFile(error)) return new Set();
      throw error;
    }
  }

  private snapshotPath(id: string): string {
    return join(this.snapshots, `${id}${VersionHistory.SNAPSHOT_EXTENSION}`);
  }

  private snapshotFile(id: string): JsonFile<SetSnapshot> {
    return new JsonFile(this.snapshotPath(id), SnapshotSchema, () => {
      throw new Error(`The full snapshot of version ${id} is missing`);
    });
  }

  private async entries(): Promise<Entry[]> {
    const stamp = await this.stamp();
    if (this.cache && this.cache.stamp === stamp) return this.cache.entries;
    const entries = stamp ? await this.readEntries() : [];
    this.cache = { stamp, entries };
    return entries;
  }

  private async readEntries(): Promise<Entry[]> {
    const text = await readFile(this.file, "utf8");
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => ({ version: VersionSchema.parse(JSON.parse(line)) as Version, line }));
  }

  /** The file's modification time and size, or "" when there is no file yet. */
  private async stamp(): Promise<string> {
    try {
      const info = await stat(this.file);
      return `${info.mtimeMs}:${info.size}`;
    } catch (error) {
      if (isMissingFile(error)) return "";
      throw error;
    }
  }

  private async write(entries: Entry[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await JsonFile.writeAtomically(this.file, entries.map((entry) => `${entry.line}\n`).join(""));
    this.cache = { stamp: await this.stamp(), entries };
  }

  /** Ids sort in time order: milliseconds since 1970, then a counter for versions made in the same millisecond. */
  private nextId(entries: readonly Entry[]): string {
    const [lastTime = 0, lastCount = 0] = (entries[entries.length - 1]?.version.id ?? "").split("-").map((part) => Number(part) || 0);
    const time = Math.max(Date.now(), lastTime);
    const count = time === lastTime ? lastCount + 1 : 0;
    return `${time}-${String(count).padStart(VersionHistory.ID_COUNTER_DIGITS, "0")}`;
  }

  private static locate(entries: readonly Entry[], id: string): { entry: Entry; index: number } {
    const index = entries.findIndex((entry) => entry.version.id === id);
    const entry = entries[index];
    if (!entry) throw new VersionNotFoundError(`No version ${id} in the history`);
    return { entry, index };
  }

  private static item(version: Version): VersionListItem {
    const { changes, ...rest } = version;
    return { ...rest, tracks: TouchedTracks.names(changes), changeCount: changes.length };
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
