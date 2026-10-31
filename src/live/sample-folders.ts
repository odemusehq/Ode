import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, opendir, realpath, rm } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, sep } from "node:path";
import type { SettingsStore } from "../mneme/settings-store";
import type { TempFolder } from "../mneme/paths";
import { t } from "../shared/i18n";

const FORMATS = {
  wav: "audio", wave: "audio", aif: "audio", aiff: "audio", aifc: "audio", flac: "audio", mp3: "audio", ogg: "audio", m4a: "audio",
  adv: "preset", adg: "preset", amxd: "device", agr: "groove", alc: "clip", mid: "midi", midi: "midi",
} as const;
export type SampleFileKind = (typeof FORMATS)[keyof typeof FORMATS];

interface ScanLimits {
  maxEntries: number;
  maxFiles: number;
  maxDirectories: number;
  maxDepth: number;
  maxMs: number;
}
const LIMITS: ScanLimits = { maxEntries: 25000, maxFiles: 10000, maxDirectories: 2000, maxDepth: 16, maxMs: 5000 };
const CACHE_MS = 5 * 60 * 1000;
const CACHE_SCANS = 4;
const OPEN_MAX_BYTES = 64 * 1024 * 1024;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const identity = (info: Stats) => digest([info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs]);

interface SampleRoot { id: string; name: string; path: string }
interface SampleFile {
  name: string;
  relativePath: string;
  path: string;
  format: string;
  kind: SampleFileKind;
  bytes: number;
  modifiedAt: string;
  /** Extension recognition only; Live still validates the file when loading it. */
  loadVia: "native_audio" | "human_browser";
}
interface Coverage {
  complete: boolean;
  truncated: boolean;
  limitsReached: string[];
  visitedEntries: number;
  visitedDirectories: number;
  indexedFiles: number;
  symlinksSkipped: number;
  unreadableEntries: number;
  unsupportedFiles: number;
  limits: ScanLimits;
}
interface Scan {
  id: string;
  configuration: string;
  scope: string;
  root: SampleRoot;
  subfolder: string;
  startedAt: string;
  finishedAt: string;
  expiresAt: number;
  files: SampleFile[];
  identities: Map<string, string>;
  subfolders: string[];
  subfoldersComplete: boolean;
  coverage: Coverage;
}
export interface SampleSearch {
  rootId: string;
  subfolder?: string;
  query?: string;
  kind?: SampleFileKind;
  formats?: string[];
  limit?: number;
  folderOffset?: number;
  cursor?: string;
  refresh?: boolean;
}

/** In-memory metadata discovery and explicit selected-audio copies. Search never opens file contents or Live databases. */
export class SampleFolders {
  private readonly scans = new Map<string, Scan>();
  private readonly limits: ScanLimits;

  constructor(private readonly settings: Pick<SettingsStore, "read">, limits: Partial<ScanLimits> = {}) {
    this.limits = { ...LIMITS, ...limits };
  }

  async folders(signal?: AbortSignal) {
    signal?.throwIfAborted();
    const roots = await this.configured();
    const available = [];
    for (const root of roots) {
      signal?.throwIfAborted();
      let readable = false;
      try { await this.checkedPath(root.path, "", true); readable = true; } catch { /* Report the unavailable root without scanning it. */ }
      available.push({ ...root, available: readable });
    }
    return { source: "approved_local_folders", roots: available, formats: FORMATS, cacheSeconds: CACHE_MS / 1000 };
  }

  async search(request: SampleSearch, signal?: AbortSignal, maxResultChars = 60000) {
    signal?.throwIfAborted();
    if (request.refresh && request.cursor) throw new Error(t("sampleFolders.refreshCursor"));
    const roots = await this.configured();
    const configuration = digest(roots.map((root) => root.path));
    // Approval changes revoke every cached page, even when the selected root remains approved.
    for (const [id, scan] of this.scans) if (scan.configuration !== configuration || scan.expiresAt <= Date.now()) this.scans.delete(id);
    const root = roots.find((root) => root.id === request.rootId);
    if (!root) throw new Error(t("sampleFolders.rootRequired"));
    const subfolder = this.subfolder(request.subfolder ?? "");
    await this.checkedPath(root.path, subfolder, true);
    signal?.throwIfAborted();
    const scope = digest([root.id, subfolder]);
    const filters = { query: request.query?.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ") ?? "",
      kind: request.kind ?? null, formats: [...new Set(request.formats?.map((format) => format.toLowerCase().replace(/^\./, "")) ?? [])].sort(compare) };
    const queryId = digest([scope, filters]);
    let scan: Scan | undefined;
    let offset = 0;
    if (request.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(request.cursor, "base64url").toString("utf8"));
        scan = this.scans.get(cursor.scan);
        if (!scan || scan.scope !== scope || cursor.query !== queryId || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new Error();
        offset = cursor.offset;
      } catch { throw new Error(t("sampleFolders.staleCursor")); }
    } else if (!request.refresh) {
      scan = [...this.scans.values()].findLast((scan) => scan.scope === scope);
    }
    const cached = scan !== undefined;
    if (!scan) {
      scan = await this.scan(root, subfolder, configuration, scope, signal);
      signal?.throwIfAborted();
      if (request.refresh) for (const [id, old] of this.scans) if (old.scope === scope) this.scans.delete(id);
      this.scans.set(scan.id, scan);
      while (this.scans.size > CACHE_SCANS) this.scans.delete(this.scans.keys().next().value!);
    }
    const words = filters.query.split(" ").filter(Boolean);
    const matching = scan.files.filter((file) => (!filters.kind || filters.kind === file.kind) &&
      (!filters.formats.length || filters.formats.includes(file.format)) && words.every((word) => file.relativePath.toLowerCase().includes(word)));
    if (offset > matching.length) throw new Error(t("sampleFolders.staleCursor"));
    const folderCounts = new Map<string, number>(), formatCounts = new Map<string, number>(), kindCounts = new Map<string, number>();
    for (const file of matching) {
      const within = subfolder ? file.relativePath.slice(subfolder.length + 1) : file.relativePath;
      const slash = within.indexOf("/");
      const child = slash < 0 ? "" : within.slice(0, slash);
      const folder = child ? [subfolder, child].filter(Boolean).join("/") : subfolder;
      folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
      formatCounts.set(file.format, (formatCounts.get(file.format) ?? 0) + 1);
      kindCounts.set(file.kind, (kindCounts.get(file.kind) ?? 0) + 1);
    }
    const counts = (values: Map<string, number>) => [...values].sort(([a], [b]) => compare(a, b)).map(([value, count]) => ({ value, count }));
    const folders = counts(folderCounts).sort((a, b) => b.count - a.count || compare(a.value, b.value));
    const navigation = scan.subfolders.map((value) => ({ value, indexedMatches: folderCounts.get(value) ?? 0 }));
    const folderOffset = request.folderOffset ?? 0;
    if (folderOffset > navigation.length) throw new Error(t("sampleFolders.staleCursor"));
    const items: SampleFile[] = [];
    const pageScan = scan;
    const result = {
      source: "approved_local_folders", root, subfolder, filters,
      scan: { id: scan.id, startedAt: scan.startedAt, finishedAt: scan.finishedAt, expiresAt: new Date(scan.expiresAt).toISOString(), cached,
        coverage: scan.coverage },
      matching: matching.length, items,
      facets: { folders: folders.slice(0, 20), folderValuesOmitted: Math.max(0, folders.length - 20), formats: counts(formatCounts), kinds: counts(kindCounts) },
      navigation: { subfolders: navigation.slice(folderOffset, folderOffset + 20), offset: folderOffset, nextOffset: null as number | null,
        observedSubfolders: navigation.length,
        listingComplete: scan.subfoldersComplete, countsComplete: scan.coverage.complete },
      nextCursor: null as string | null,
    };
    const cursor = () => offset + items.length < matching.length
      ? Buffer.from(JSON.stringify({ scan: pageScan.id, query: queryId, offset: offset + items.length })).toString("base64url") : null;
    result.nextCursor = cursor();
    while (JSON.stringify(result).length > maxResultChars / 2 && result.facets.folders.length) {
      result.facets.folders.pop(); result.facets.folderValuesOmitted++;
    }
    while (JSON.stringify(result).length > maxResultChars / 2 && result.navigation.subfolders.length) {
      result.navigation.subfolders.pop();
    }
    result.navigation.nextOffset = folderOffset + result.navigation.subfolders.length < navigation.length
      ? folderOffset + result.navigation.subfolders.length : null;
    if (result.navigation.nextOffset === folderOffset) throw new Error(t("sampleFolders.resultWindow"));
    for (const file of matching.slice(offset, offset + Math.min(50, request.limit ?? 20))) {
      signal?.throwIfAborted();
      try {
        const info = await this.checkedPath(root.path, file.relativePath, false);
        if (identity(info) !== scan.identities.get(file.relativePath)) throw new Error();
      }
      catch { throw new Error(t("sampleFolders.filesChanged")); }
      items.push(file);
      result.nextCursor = cursor();
      if (JSON.stringify(result).length > maxResultChars) { items.pop(); result.nextCursor = cursor(); break; }
    }
    signal?.throwIfAborted();
    if ((matching.length > offset && !items.length) || JSON.stringify(result).length > maxResultChars) throw new Error(t("sampleFolders.resultWindow"));
    await this.assertConfiguration(configuration);
    signal?.throwIfAborted();
    return result;
  }

  /** Explicit selected-file access only. Discovery never invokes this method or opens file contents. */
  async open(request: { rootId: string; scanId: string; relativePath: string }, temp: TempFolder, signal?: AbortSignal, maxResultChars = 60000) {
    signal?.throwIfAborted();
    const roots = await this.configured();
    const configuration = digest(roots.map((root) => root.path));
    const root = roots.find((root) => root.id === request.rootId);
    const scan = this.scans.get(request.scanId);
    if (!root || !scan || scan.root.id !== root.id || scan.configuration !== configuration || scan.expiresAt <= Date.now()) {
      throw new Error(t("sampleFolders.staleSelection"));
    }
    const selected = scan.files.find((file) => file.relativePath === request.relativePath);
    if (!selected || selected.kind !== "audio") throw new Error(t("sampleFolders.audioSelection"));
    const path = join(root.path, selected.relativePath);
    const original = await this.checkedPath(root.path, selected.relativePath, false);
    if (identity(original) !== scan.identities.get(selected.relativePath)) throw new Error(t("sampleFolders.filesChanged"));
    if (original.size < 1 || original.size > OPEN_MAX_BYTES) throw new Error(t("sampleFolders.fileSize"));
    signal?.throwIfAborted();
    // O_NOFOLLOW and the opened descriptor's identity prevent a replaced path from selecting another file.
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      if (identity(await file.stat()) !== identity(original)) throw new Error(t("sampleFolders.filesChanged"));
      bytes = Buffer.alloc(original.size);
      let offset = 0;
      while (offset < bytes.length) {
        signal?.throwIfAborted();
        const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
        if (!bytesRead) throw new Error(t("sampleFolders.filesChanged"));
        offset += bytesRead;
      }
      if (identity(await file.stat()) !== identity(original) || identity(await this.checkedPath(root.path, selected.relativePath, false)) !== identity(original)) {
        throw new Error(t("sampleFolders.filesChanged"));
      }
    } finally { await file.close(); }
    signal?.throwIfAborted();
    await this.assertConfiguration(configuration);
    const workingPath = await temp.file(selected.format);
    let created = false;
    let completed = false;
    try {
      signal?.throwIfAborted();
      const working = await open(workingPath, "wx", 0o600);
      created = true;
      try { await working.writeFile(bytes, { signal }); } finally { await working.close(); }
      signal?.throwIfAborted();
      await this.assertConfiguration(configuration);
      const result = { path: await temp.inside(workingPath), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
        retained: false, availability: "session_temp", format: selected.format,
        source: { type: "approved_local_file", rootId: root.id, scanId: scan.id, originalPath: path, relativePath: selected.relativePath,
          bytes: selected.bytes, modifiedAt: selected.modifiedAt },
        listeningContainer: "unverified" };
      if (JSON.stringify(result).length > maxResultChars) throw new Error(t("sampleFolders.resultWindow"));
      signal?.throwIfAborted();
      completed = true;
      return result;
    } finally { if (created && !completed) await rm(workingPath, { force: true }); }
  }

  private async configured(): Promise<SampleRoot[]> {
    return (await this.settings.read()).sampleFolders.map((path) => ({ id: digest(path).slice(0, 16), name: basename(path) || path, path }));
  }

  private async assertConfiguration(expected: string): Promise<void> {
    if (digest((await this.configured()).map((root) => root.path)) !== expected) throw new Error(t("sampleFolders.staleSelection"));
  }

  private subfolder(folder: string): string {
    if (isAbsolute(folder) || folder.includes("\\") || folder.includes("\0") || folder.split("/").some((part) => part === ".." || part === ".")) {
      throw new Error(t("sampleFolders.relativeFolder"));
    }
    return folder.split("/").filter(Boolean).join("/");
  }

  private async checkedPath(root: string, within: string, directory: boolean) {
    const path = join(root, within);
    const inside = relative(root, path);
    if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error(t("sampleFolders.relativeFolder"));
    const info = await lstat(path);
    // Equality also refuses symbolic links in parent components, including links that point back inside the root.
    if (info.isSymbolicLink() || await realpath(path) !== path || (directory ? !info.isDirectory() : !info.isFile())) {
      throw new Error(t("sampleFolders.pathUnavailable"));
    }
    return info;
  }

  private async scan(root: SampleRoot, subfolder: string, configuration: string, scope: string, signal?: AbortSignal): Promise<Scan> {
    const started = Date.now();
    const coverage: Coverage = { complete: true, truncated: false, limitsReached: [], visitedEntries: 0, visitedDirectories: 0,
      indexedFiles: 0, symlinksSkipped: 0, unreadableEntries: 0, unsupportedFiles: 0, limits: { ...this.limits } };
    const hit = (limit: string) => { coverage.complete = false; coverage.truncated = true; if (!coverage.limitsReached.includes(limit)) coverage.limitsReached.push(limit); };
    const files: SampleFile[] = [];
    const identities = new Map<string, string>();
    const subfolders: string[] = [];
    let subfoldersComplete = false;
    const pending = [{ folder: subfolder, depth: 0 }];
    while (pending.length) {
      signal?.throwIfAborted();
      if (Date.now() - started >= this.limits.maxMs) { hit("time"); break; }
      if (coverage.visitedDirectories >= this.limits.maxDirectories) { hit("directories"); break; }
      const { folder, depth } = pending.shift()!;
      try {
        await this.checkedPath(root.path, folder, true);
        signal?.throwIfAborted();
        const directory = await opendir(join(root.path, folder));
        coverage.visitedDirectories++;
        let directoryComplete = true;
        for await (const entry of directory) {
          signal?.throwIfAborted();
          if (coverage.visitedEntries >= this.limits.maxEntries) { hit("entries"); directoryComplete = false; break; }
          if (files.length >= this.limits.maxFiles) { hit("files"); directoryComplete = false; break; }
          if (Date.now() - started >= this.limits.maxMs) { hit("time"); directoryComplete = false; break; }
          coverage.visitedEntries++;
          if (entry.isSymbolicLink()) { coverage.symlinksSkipped++; continue; }
          const within = [folder, entry.name].filter(Boolean).join("/");
          if (entry.isDirectory()) {
            try { await this.checkedPath(root.path, within, true); }
            catch { coverage.unreadableEntries++; coverage.complete = false; continue; }
            if (folder === subfolder) subfolders.push(within);
            if (depth >= this.limits.maxDepth) hit("depth");
            else if (pending.length + coverage.visitedDirectories >= this.limits.maxDirectories) hit("directories");
            else pending.push({ folder: within, depth: depth + 1 });
            continue;
          }
          const format = extname(entry.name).slice(1).toLowerCase();
          if (!Object.hasOwn(FORMATS, format)) { coverage.unsupportedFiles++; continue; }
          try {
            const info = await this.checkedPath(root.path, within, false);
            const kind = FORMATS[format as keyof typeof FORMATS];
            files.push({ name: entry.name, relativePath: within, path: join(root.path, within), format, kind,
              bytes: info.size, modifiedAt: info.mtime.toISOString(), loadVia: kind === "audio" ? "native_audio" : "human_browser" });
            identities.set(within, identity(info));
          } catch { coverage.unreadableEntries++; coverage.complete = false; }
        }
        if (folder === subfolder) subfoldersComplete = directoryComplete;
      } catch (error) {
        signal?.throwIfAborted();
        if (folder === subfolder) throw error;
        coverage.unreadableEntries++; coverage.complete = false;
      }
      if (coverage.limitsReached.some((limit) => ["entries", "files", "time"].includes(limit))) break;
    }
    signal?.throwIfAborted();
    files.sort((a, b) => compare(a.relativePath, b.relativePath));
    coverage.indexedFiles = files.length;
    return { id: randomUUID(), configuration, scope, root, subfolder, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_MS, files, identities, subfolders: subfolders.sort(compare), subfoldersComplete, coverage };
  }
}
