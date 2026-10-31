import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z, type ZodType } from "zod";
import { LeadSheetSchema, emptyLeadSheet, type LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { LyricsText } from "./lyrics-text";
import type { UserPaths } from "./paths";
import { VersionHistory } from "./version-history";
import type { MutationReceipt } from "../shared/mutation-receipt";

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
  /** One lead-sheet file per song, kept across switches, so every write to a song's file waits its turn in one queue. */
  private readonly sheets = new Map<string, JsonFile<LeadSheet>>();

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

  get versionsDir(): string {
    return join(this.dir, "versions");
  }

  /** Resolve a known song without changing the open song; late composer saves retain their original owner. */
  async directoryFor(id: string): Promise<string> {
    if (!z.uuid().safeParse(id).success || !(await this.index.read()).songs.some((song) => song.id === id)) throw new SongNotFoundError("That song is gone from Ode's list.");
    return join(this.paths.songs, id);
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
  replace(sheet: LeadSheet): Promise<LeadSheet> {
    return this.change((current) => LeadSheetSchema.parse({ ...sheet, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision }));
  }

  /** Replaces the fields given. The lyrics and their revision stay as stored: they change only through `saveLyrics`. */
  update(patch: Partial<LeadSheet>): Promise<LeadSheet> {
    return this.change((current) => LeadSheetSchema.parse({ ...current, ...patch, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision }));
  }

  /** The exact changed fields are captured inside the same file update as the write. */
  async updateWithReceipt(patch: Partial<LeadSheet>): Promise<LeadSheet & { __odeReceipts: MutationReceipt[] }> {
    const songId = this.id;
    const before: Partial<LeadSheet> = {};
    const after: Partial<LeadSheet> = {};
    const beforeAbsent: (keyof LeadSheet)[] = [], afterAbsent: (keyof LeadSheet)[] = [];
    const sheet = await this.change((current) => {
      const next = LeadSheetSchema.parse({ ...current, ...patch, lyrics: current.lyrics, lyricsRevision: current.lyricsRevision });
      for (const field of Object.keys(patch) as (keyof LeadSheet)[]) {
        if (field === "lyrics" || field === "lyricsRevision" || field === "version" || JSON.stringify(current[field]) === JSON.stringify(next[field])) continue;
        if (current[field] === undefined) beforeAbsent.push(field);
        else Object.assign(before, { [field]: structuredClone(current[field]) });
        if (next[field] === undefined) afterAbsent.push(field);
        else Object.assign(after, { [field]: structuredClone(next[field]) });
      }
      return next;
    });
    return { ...sheet, __odeReceipts: Object.keys(after).length || afterAbsent.length ? [{ kind: "sheet-fields", songId, before, after, beforeAbsent, afterAbsent }] : [] };
  }

  /** Compare and change only the named fields, inside their writer queue. */
  async restoreFields(expected: Partial<LeadSheet>, replacement: Partial<LeadSheet>, songId = this.id,
    expectedAbsent: readonly (keyof LeadSheet)[] = [], replacementAbsent: readonly (keyof LeadSheet)[] = []): Promise<LeadSheet & { __odeReceipts: MutationReceipt[] }> {
    if (songId !== this.id) throw new Error("The lead-sheet change belongs to another song.");
    let receipt: MutationReceipt | undefined;
    const sheet = await this.change((current) => {
      const fields = [...new Set([...(Object.keys(replacement) as (keyof LeadSheet)[]), ...replacementAbsent])];
      for (const field of fields) {
        if (field === "lyrics" || field === "lyricsRevision" || field === "version") throw new Error("Restore lyrics through the shared lyrics writer.");
        if (expectedAbsent.includes(field) ? current[field] !== undefined : JSON.stringify(current[field]) !== JSON.stringify(expected[field])) throw new Error(`The musician changed the lead sheet's ${field}; that field was kept.`);
      }
      const patched = { ...current, ...replacement };
      for (const field of replacementAbsent) delete patched[field];
      const next = LeadSheetSchema.parse(patched);
      const before = Object.fromEntries(fields.filter((field) => current[field] !== undefined).map((field) => [field, structuredClone(current[field])])) as Partial<LeadSheet>;
      const after = Object.fromEntries(fields.filter((field) => next[field] !== undefined).map((field) => [field, structuredClone(next[field])])) as Partial<LeadSheet>;
      receipt = { kind: "sheet-fields", songId, before, after, beforeAbsent: fields.filter((field) => current[field] === undefined), afterAbsent: fields.filter((field) => next[field] === undefined) };
      return next;
    });
    return { ...sheet, __odeReceipts: receipt ? [receipt] : [] };
  }

  /**
   * Stores new lyrics as the next revision. `edit` gets the sheet as stored and returns the text to keep; the sheet
   * stays as it is between the two, so a merge made in `edit` is kept.
   */
  saveLyrics(edit: (current: LeadSheet) => string): Promise<LeadSheet> {
    return this.change((current) => LeadSheetSchema.parse({ ...current, lyrics: edit(current), lyricsRevision: current.lyricsRevision + 1 }));
  }

  /** The sung lines of the lyrics, without blank and label lines. */
  async lyrics(): Promise<string[]> {
    return LyricsText.sung((await this.read()).lyrics);
  }

  private use(id: string): void {
    this.id = id;
    this.dir = join(this.paths.songs, id);
    const sheet = this.sheets.get(id) ?? new JsonFile(join(this.dir, "song.json"), LeadSheetSchema as unknown as ZodType<LeadSheet>, emptyLeadSheet);
    this.sheets.set(id, sheet);
    this.sheet = sheet;
  }

  private file(): JsonFile<LeadSheet> {
    if (!this.sheet) throw new Error("Ode opens a song before it reads one.");
    return this.sheet;
  }

  /**
   * Changes the song in use when the change starts, even when the musician opens another song meanwhile: that song's
   * entry in the list takes the title and date, and the windows hear of it while it is still the song in use.
   */
  private async change(edit: (current: LeadSheet) => LeadSheet): Promise<LeadSheet> {
    const id = this.id;
    const sheet = await this.file().update(edit);
    await this.index.update((index) => ({
      ...index,
      songs: index.songs.map((song) => (song.id === id ? { ...song, title: sheet.title, updatedAt: new Date().toISOString() } : song)),
    }));
    if (id === this.id) this.onChange(sheet);
    return sheet;
  }
}

/** The version history of the song in use, one per song, kept as the musician moves between songs. */
export class SongVersions {
  /** One history per song, kept across switches, so every write to a song's history waits its turn in one queue. */
  private readonly histories = new Map<string, VersionHistory>();

  constructor(
    private readonly song: SongStore,
    private readonly snapshotEvery: number,
  ) {}

  get history(): VersionHistory {
    const dir = this.song.versionsDir;
    const history = this.histories.get(dir) ?? new VersionHistory(dir, this.snapshotEvery);
    this.histories.set(dir, history);
    return history;
  }
}
