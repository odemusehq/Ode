import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z, type ZodType } from "zod";
import { LeadSheetSchema, emptyLeadSheet, type LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { LyricsText } from "./lyrics-text";
import type { UserPaths } from "./paths";
import { VersionHistory } from "./version-history";

/** A song in Ode's list: its folder's id, and its title as its lead sheet has it. */
export const SongEntrySchema = z.object({ id: z.string(), title: z.string(), updatedAt: z.string() });
export type SongEntry = z.infer<typeof SongEntrySchema>;

const SongIndexSchema = z.object({ current: z.string().nullable(), songs: z.array(SongEntrySchema) });
type SongIndex = z.infer<typeof SongIndexSchema>;

/** The song asked for is missing from Ode's list of songs. */
export class SongNotFoundError extends Error {}

/**
 * Every song the musician works on with Ode, one folder each in Ode's storage (Songs/<id>/), with the one in use now.
 * A song holds its lead sheet (title, lyrics, chords, sections), its version history in versions/ and its release
 * files in release/. The musician picks the song in the Lyrics and History dialogs; Ode reads whichever Set is open.
 * The lyrics and their revision are written only through `saveLyrics` (LyricsStore uses it), so edits made at the
 * same time can be merged.
 */
export class SongStore {
  private readonly index: JsonFile<SongIndex>;
  private id = "";
  private dir = "";
  private sheet: JsonFile<LeadSheet> | null = null;

  constructor(
    private readonly paths: UserPaths,
    private readonly onChange: (sheet: LeadSheet) => void,
  ) {
    this.index = new JsonFile(join(paths.songs, "songs.json"), SongIndexSchema, () => ({ current: null, songs: [] }));
  }

  /** The song in use now. */
  get songId(): string {
    return this.id;
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

  /** Opens the song used last, or starts the first one. */
  async openLast(): Promise<SongEntry> {
    const { current, songs } = await this.index.read();
    const last = songs.find((song) => song.id === current) ?? songs[0];
    return last ? this.open(last.id) : this.create("");
  }

  /** Every song, the most recently changed first. */
  async list(): Promise<SongEntry[]> {
    return [...(await this.index.read()).songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Switches to another song in the list; throws SongNotFoundError for an id the list lacks. */
  async open(id: string): Promise<SongEntry> {
    const entry = (await this.index.read()).songs.find((song) => song.id === id);
    if (!entry) throw new SongNotFoundError("That song is gone from Ode's list.");
    await this.index.update((index) => ({ ...index, current: id }));
    this.use(id);
    this.onChange(await this.read());
    return entry;
  }

  /** Starts a new song with this title and switches to it. */
  async create(title: string): Promise<SongEntry> {
    const entry: SongEntry = { id: randomUUID(), title: title.trim(), updatedAt: new Date().toISOString() };
    await this.index.update((index) => ({ current: entry.id, songs: [...index.songs, entry] }));
    this.use(entry.id);
    if (entry.title) await this.update({ title: entry.title });
    else this.onChange(await this.read());
    return entry;
  }

  read(): Promise<LeadSheet> {
    return this.file().read();
  }

  /** Stores a whole lead sheet. The lyrics and their revision stay as stored: they change only through `saveLyrics`. */
  async replace(sheet: LeadSheet): Promise<LeadSheet> {
    return this.changed(
      await this.file().update((current) => LeadSheetSchema.parse({ ...sheet, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision })),
    );
  }

  /** Replaces the fields given. The lyrics and their revision stay as stored: they change only through `saveLyrics`. */
  async update(patch: Partial<LeadSheet>): Promise<LeadSheet> {
    return this.changed(
      await this.file().update((current) =>
        LeadSheetSchema.parse({ ...current, ...patch, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision }),
      ),
    );
  }

  /**
   * Stores new lyrics as the next revision. `edit` gets the sheet as stored and returns the text to keep; the sheet
   * stays as it is between the two, so a merge made in `edit` is kept.
   */
  async saveLyrics(edit: (current: LeadSheet) => string): Promise<LeadSheet> {
    return this.changed(
      await this.file().update((current) => LeadSheetSchema.parse({ ...current, lyrics: edit(current), lyricsRevision: current.lyricsRevision + 1 })),
    );
  }

  /** The sung lines of the lyrics, without blank and label lines. */
  async lyrics(): Promise<string[]> {
    return LyricsText.sung((await this.read()).lyrics);
  }

  private use(id: string): void {
    this.id = id;
    this.dir = join(this.paths.songs, id);
    this.sheet = new JsonFile(join(this.dir, "song.json"), LeadSheetSchema as unknown as ZodType<LeadSheet>, emptyLeadSheet);
  }

  private file(): JsonFile<LeadSheet> {
    if (!this.sheet) throw new Error("Ode opens a song before it reads one.");
    return this.sheet;
  }

  /** Keeps the list's title and date in step with the sheet, then tells the windows. */
  private async changed(sheet: LeadSheet): Promise<LeadSheet> {
    const id = this.id;
    await this.index.update((index) => ({
      ...index,
      songs: index.songs.map((song) => (song.id === id ? { ...song, title: sheet.title, updatedAt: new Date().toISOString() } : song)),
    }));
    this.onChange(sheet);
    return sheet;
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
