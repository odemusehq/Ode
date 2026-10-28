import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ZodType } from "zod";
import { LeadSheetSchema, emptyLeadSheet, type LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { LyricsText } from "./lyrics-text";
import { projectSetDir, type UserPaths } from "./paths";
import { VersionHistory } from "./version-history";

export interface SongLocation {
  /** The .als file once saved; before that, an id the Ode device made when the Set was loaded. */
  setId: string;
  /** The .als file, or null while the Set is unsaved. */
  filePath: string | null;
  /** Made each time the Ode device loads: the same instance with a new file path is the same Set, saved under a new name. */
  instance: string;
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

async function copyFolder(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

/**
 * Everything about the open song, stored in the Live project (<project>/Ode/<Set file name>/, so Sets that share a
 * project keep their own), or in the user folder while the Set is unsaved. The version history lives in its versions/
 * folder, so it goes wherever the song's data goes. The lyrics and their revision are written only through
 * `saveLyrics` (LyricsStore uses it), so edits made at the same time can be merged.
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

  /**
   * Whether `location` carries on the song open now: the same Set (the same device instance, or the same saved file),
   * or this Set saved for the first time or under a new name, so its conversation and history go on.
   */
  continues(location: SongLocation): boolean {
    const current = this.location;
    if (!current) return false;
    if (current.instance === location.instance) return true;
    return location.filePath !== null && location.filePath === current.filePath;
  }

  /**
   * Switches to the Set Live has open. On its first save the unsaved data moves into the project; after Save As the
   * data is copied to the new name's folder, so the Set under its old name keeps its own. Data already in the
   * destination is never overwritten.
   */
  async open(location: SongLocation): Promise<void> {
    const current = this.location;
    if (current && current.setId === location.setId && current.filePath === location.filePath && current.instance === location.instance) return;
    const target = location.filePath ? projectSetDir(location.filePath) : join(this.paths.unsaved, location.setId);
    const savedAgain = current !== null && current.instance === location.instance && location.filePath !== null && current.filePath !== location.filePath;
    if (savedAgain && target !== this.dir && (await exists(this.dir)) && !(await exists(target))) {
      if (current.filePath === null) await moveFolder(this.dir, target);
      else await copyFolder(this.dir, target);
    }
    this.location = location;
    this.dir = target;
    this.sheet = this.sheetFile(target);
    this.onChange(await this.read());
  }

  read(): Promise<LeadSheet> {
    return this.sheet.read();
  }

  /** Stores a whole lead sheet. The lyrics and their revision stay as stored: they change only through `saveLyrics`. */
  async replace(sheet: LeadSheet): Promise<LeadSheet> {
    const next = await this.sheet.update((current) => LeadSheetSchema.parse({ ...sheet, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision }));
    this.onChange(next);
    return next;
  }

  /** Replaces the fields given. The lyrics and their revision stay as stored: they change only through `saveLyrics`. */
  async update(patch: Partial<LeadSheet>): Promise<LeadSheet> {
    const next = await this.sheet.update((current) =>
      LeadSheetSchema.parse({ ...current, ...patch, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision }),
    );
    this.onChange(next);
    return next;
  }

  /**
   * Stores new lyrics as the next revision. `edit` gets the sheet as stored and returns the text to keep; nothing else
   * is written to the sheet between the two, so a merge made in `edit` is never overwritten.
   */
  async saveLyrics(edit: (current: LeadSheet) => string): Promise<LeadSheet> {
    const next = await this.sheet.update((current) =>
      LeadSheetSchema.parse({ ...current, lyrics: edit(current), lyricsRevision: current.lyricsRevision + 1 }),
    );
    this.onChange(next);
    return next;
  }

  /** The sung lines of the lyrics, without blank and label lines. */
  async lyrics(): Promise<string[]> {
    return LyricsText.sung((await this.read()).lyrics);
  }

  private sheetFile(dir: string): JsonFile<LeadSheet> {
    return new JsonFile(join(dir, "song.json"), LeadSheetSchema as unknown as ZodType<LeadSheet>, emptyLeadSheet);
  }
}

/** The open song's version history. It follows the song when another Set opens or the Set is saved under a new name. */
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
