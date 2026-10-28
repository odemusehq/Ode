import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ZodType } from "zod";
import { LeadSheetSchema, emptyLeadSheet, type LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { projectOdeDir, type UserPaths } from "./paths";
import { VersionHistory } from "./version-history";

export interface SongLocation {
  /** Stable id of the Set, kept by the Ode device. */
  setId: string;
  /** The .als file, or null while the Set is unsaved. */
  filePath: string | null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function moveFolder(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
}

/**
 * Everything about the open song, stored in the Live project (<project>/Ode/),
 * or in the user folder while the Set is unsaved. The version history lives in its versions/ folder,
 * so the first-save move takes it along.
 */
export class SongStore {
  private static readonly NO_SET = "no-set";
  private location: SongLocation | null = null;
  private dir: string;
  private sheet: JsonFile<LeadSheet>;

  constructor(
    private readonly paths: UserPaths,
    private readonly onChange: (sheet: LeadSheet) => void,
  ) {
    this.dir = join(paths.unsaved, SongStore.NO_SET);
    this.sheet = this.sheetFile(this.dir);
  }

  get setId(): string | null {
    return this.location?.setId ?? null;
  }

  get setFilePath(): string | null {
    return this.location?.filePath ?? null;
  }

  /** The Live project folder, or null while the Set is unsaved. */
  get projectDir(): string | null {
    return this.location?.filePath ? dirname(this.location.filePath) : null;
  }

  get dataDir(): string {
    return this.dir;
  }

  get releaseDir(): string {
    return join(this.dir, "release");
  }

  get versionsDir(): string {
    return join(this.dir, "versions");
  }

  /** True when the open Set was unsaved and `location` is the same Set after its first save. */
  isFirstSave(location: SongLocation): boolean {
    return Boolean(this.location && !this.location.filePath && location.filePath);
  }

  /** Switches to the Set Live has open; moves unsaved data into the project on the first save. */
  async open(location: SongLocation): Promise<void> {
    if (this.location?.setId === location.setId && this.location.filePath === location.filePath) return;
    const target = location.filePath ? projectOdeDir(location.filePath) : join(this.paths.unsaved, location.setId);
    if (this.isFirstSave(location) && (await exists(this.dir)) && !(await exists(target))) {
      await moveFolder(this.dir, target);
    }
    this.location = location;
    this.dir = target;
    this.sheet = this.sheetFile(target);
    this.onChange(await this.read());
  }

  read(): Promise<LeadSheet> {
    return this.sheet.read();
  }

  async replace(sheet: LeadSheet): Promise<LeadSheet> {
    const valid = LeadSheetSchema.parse(sheet);
    await this.sheet.write(valid);
    this.onChange(valid);
    return valid;
  }

  async update(patch: Partial<LeadSheet>): Promise<LeadSheet> {
    const next = await this.sheet.update((current) => LeadSheetSchema.parse({ ...current, ...patch }));
    this.onChange(next);
    return next;
  }

  async lyrics(): Promise<string[]> {
    const sheet = await this.read();
    return sheet.sections.flatMap((section) => section.lines.map((line) => line.text));
  }

  private sheetFile(dir: string): JsonFile<LeadSheet> {
    return new JsonFile(join(dir, "song.json"), LeadSheetSchema as unknown as ZodType<LeadSheet>, emptyLeadSheet);
  }
}

/** The open song's version history. It follows the song when another Set opens or an unsaved Set is saved. */
export class SongVersions {
  private current: VersionHistory | null = null;
  private dir = "";

  constructor(
    private readonly song: SongStore,
    private readonly snapshotEvery: number,
  ) {}

  get history(): VersionHistory {
    const dir = this.song.versionsDir;
    if (!this.current || dir !== this.dir) {
      this.current = new VersionHistory(dir, this.snapshotEvery);
      this.dir = dir;
    }
    return this.current;
  }
}
