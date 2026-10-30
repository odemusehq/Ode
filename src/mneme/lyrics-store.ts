import { diff3MergeRegions } from "node-diff3";
import { analyzeLyrics } from "../music/prosody/lyrics-analyzer";
import type { LyricsSaved, LyricsState } from "../shared/lyrics";
import { LyricsSections } from "../shared/lyrics-sections";
import type { LeadSheet } from "../shared/song";
import { VersionAuthor } from "../shared/versions";
import { LyricsText } from "./lyrics-text";
import type { PreferencesStore } from "./preferences";
import type { SongStore } from "./song-store";
import type { MutationReceipt } from "../shared/mutation-receipt";

/** Ode saved lyrics edited from a revision whose text is gone from the store, so the merge is missing its base. */
export class StaleLyricsError extends Error {}

/** Whose lines stay where both sides changed the same lines: the side being saved, or the side already stored. */
enum Keep {
  Saved = "saved",
  Stored = "stored",
}

/** A three-way merge of two edits of the same lyrics, line by line. */
class LineMerge {
  private readonly lines: string[] = [];
  /** Line numbers (from 1) of the kept lines where both sides changed the same lines. */
  private readonly conflicts = new Set<number>();

  private constructor(private readonly keep: Keep) {}

  /**
   * `saved` and `stored` are both edits of `base`. Changes to different lines are both kept; where both changed the
   * same lines, `keep` decides whose lines stay, and those lines are listed as conflicts.
   */
  static run(base: string[], saved: string[], stored: string[], keep: Keep): { lines: string[]; conflicts: number[] } {
    const merge = new LineMerge(keep);
    for (const region of diff3MergeRegions(saved, base, stored)) {
      if (region.stable) merge.lines.push(...region.bufferContent);
      else merge.resolve(region.oContent, region.aContent, region.bContent);
    }
    return { lines: merge.lines, conflicts: merge.lineNumbers() };
  }

  /**
   * A stretch both sides changed: lines both added at the same place are all kept, the kept side's first; lines both
   * changed are compared one by one when both sides have as many as there were, otherwise the kept side's stay.
   */
  private resolve(base: string[], saved: string[], stored: string[]): void {
    if (saved.length === stored.length && saved.every((line, index) => line === stored[index])) {
      this.lines.push(...saved);
      return;
    }
    if (base.length === 0) {
      this.lines.push(...(this.keep === Keep.Saved ? [...saved, ...stored] : [...stored, ...saved]));
      return;
    }
    if (saved.length === base.length && stored.length === base.length) {
      for (let index = 0; index < base.length; index++) this.resolveLine(base[index] ?? "", saved[index] ?? "", stored[index] ?? "");
      return;
    }
    const kept = this.keep === Keep.Saved ? saved : stored;
    if (kept.length === 0) this.conflicts.add(this.lines.length + 1);
    for (const line of kept) {
      this.lines.push(line);
      this.conflicts.add(this.lines.length);
    }
  }

  private resolveLine(base: string, saved: string, stored: string): void {
    if (saved === stored || stored === base) {
      this.lines.push(saved);
    } else if (saved === base) {
      this.lines.push(stored);
    } else {
      this.lines.push(this.keep === Keep.Saved ? saved : stored);
      this.conflicts.add(this.lines.length);
    }
  }

  /** In order, each within the merged text (a conflict where the kept side removed lines points at the line after). */
  private lineNumbers(): number[] {
    const last = Math.max(1, this.lines.length);
    return [...new Set([...this.conflicts].map((line) => Math.min(line, last)))].sort((a, b) => a - b);
  }
}

/** A save made in one song that arrived after the musician opened another. */
export class LyricsForAnotherSongError extends Error {}

/**
 * The song's lyrics, one text that the musician (from the window) and Ode both edit. Every save names the revision it
 * was edited from; when someone else saved in between, both changes are merged line by line, and where both changed the
 * same lines the musician's lines are kept. Saves wait their turn, and every save is a new revision.
 */
export class LyricsStore {
  private queue: Promise<unknown> = Promise.resolve();
  /** The texts of the revisions read or saved since the server started, for the song whose data is in `dir`. */
  private known: { dir: string; texts: Map<number, string> } = { dir: "", texts: new Map() };

  constructor(
    private readonly song: SongStore,
    private readonly prefs: PreferencesStore,
    private readonly onChange: (lyrics: LyricsState) => void,
  ) {}

  read(): Promise<LyricsState> {
    return this.enqueue(async () => {
      const song = this.song.songId;
      const texts = this.texts();
      const sheet = await this.song.read();
      texts.set(sheet.lyricsRevision, sheet.lyrics);
      return this.state(sheet, song);
    });
  }

  /**
   * Saves `text`, edited from `baseRevision`. The musician's lines win where both changed the same lines: theirs when
   * they save, the stored ones when Ode saves. When the base revision's text is unknown, a save by the musician is
   * stored as sent and a save by Ode is refused, so Ode reads the lyrics again first.
   */
  write(text: string, baseRevision: number, author: VersionAuthor, songId?: string): Promise<LyricsSaved & { receipt?: MutationReceipt }> {
    return this.enqueue(async () => {
      const song = this.song.songId;
      if (songId !== undefined && songId !== song) {
        throw new LyricsForAnotherSongError("These lyrics belong to another song: open that song in the Lyrics dialog to save them.");
      }
      const saved = LyricsText.normalize(text);
      const texts = this.texts();
      let conflicts: number[] = [];
      let before = "";
      let beforeRevision = 0;
      // Linked copies (sections that share a name) stay identical: the copy the save changed reaches the others.
      const sheet = await this.song.saveLyrics((current) => {
        before = current.lyrics;
        beforeRevision = current.lyricsRevision;
        texts.set(current.lyricsRevision, current.lyrics);
        if (baseRevision === current.lyricsRevision) return LyricsSections.unifyLinked(current.lyrics, saved);
        const base = texts.get(baseRevision);
        if (base === undefined) {
          if (author === VersionAuthor.Musician) return LyricsSections.unifyLinked(current.lyrics, saved);
          throw new StaleLyricsError(
            `The lyrics have changed since revision ${baseRevision}: read them again with lyrics_read and make the change on that text.`,
          );
        }
        const keep = author === VersionAuthor.Musician ? Keep.Saved : Keep.Stored;
        const merged = LineMerge.run(LyricsText.lines(base), LyricsText.lines(saved), LyricsText.lines(current.lyrics), keep);
        conflicts = merged.conflicts;
        return LyricsSections.unifyLinked(base, merged.lines.join("\n"));
      });
      return { ...(await this.stored(sheet, song, texts)), conflicts, ...(author === VersionAuthor.Ode ? {
        receipt: { kind: "lyrics" as const, songId: song, before, after: sheet.lyrics, beforeRevision, afterRevision: sheet.lyricsRevision },
      } : {}) };
    });
  }

  /** Turns perfect rhymes on or off for the sections called `name`, and tells the windows. */
  setStrictRhymes(name: string, strict: boolean): Promise<LyricsState> {
    return this.enqueue(async () => {
      const song = this.song.songId;
      const current = (await this.song.read()).strictRhymes.filter((each) => each !== name);
      const sheet = await this.song.update({ strictRhymes: strict ? [...current, name] : current });
      return this.stored(sheet, song, this.texts());
    });
  }

  /** Stores `text` as a new revision as it is, without merging (a restore puts back the lyrics of a version). */
  replace(text: string): Promise<LyricsState> {
    return this.enqueue(async () => {
      const song = this.song.songId;
      const texts = this.texts();
      return this.stored(await this.song.saveLyrics(() => LyricsText.normalize(text)), song, texts);
    });
  }

  /** Invert only this write; later musician lines win when they overlap the change. */
  revert(receipt: Extract<MutationReceipt, { kind: "lyrics" }>): Promise<LyricsSaved & { receipt: MutationReceipt }> {
    return this.enqueue(async () => {
      const songId = this.song.songId;
      if (receipt.songId !== songId) throw new LyricsForAnotherSongError("The lyric change belongs to another song.");
      const texts = this.texts();
      let before = "";
      let beforeRevision = 0;
      let conflicts: number[] = [];
      const sheet = await this.song.saveLyrics((current) => {
        before = current.lyrics;
        beforeRevision = current.lyricsRevision;
        const merged = LineMerge.run(LyricsText.lines(receipt.after), LyricsText.lines(receipt.before), LyricsText.lines(current.lyrics), Keep.Stored);
        conflicts = merged.conflicts;
        return LyricsSections.unifyLinked(receipt.after, merged.lines.join("\n"));
      });
      return { ...(await this.stored(sheet, songId, texts)), conflicts,
        receipt: { kind: "lyrics", songId, before, after: sheet.lyrics, beforeRevision, afterRevision: sheet.lyricsRevision } };
    });
  }

  /** Keeps the saved text among the song's known revisions and tells the windows, while that song is still in use. */
  private async stored(sheet: LeadSheet, song: string, texts: Map<number, string>): Promise<LyricsState> {
    texts.set(sheet.lyricsRevision, sheet.lyrics);
    const state = await this.state(sheet, song);
    if (song === this.song.songId) this.onChange(state);
    return state;
  }

  /** The text with its analysis in the song's pronunciation; blank and label lines are analysed as empty lines. */
  private async state(sheet: LeadSheet, song: string): Promise<LyricsState> {
    const accent = (await this.prefs.effective(sheet)).pronunciation;
    return {
      songId: song,
      text: sheet.lyrics,
      revision: sheet.lyricsRevision,
      analysis: analyzeLyrics(LyricsText.forAnalysis(sheet.lyrics), accent),
      strictRhymes: sheet.strictRhymes,
    };
  }

  /** The known texts of the open song; another song's revisions start again. */
  private texts(): Map<number, string> {
    const dir = this.song.dataDir;
    if (this.known.dir !== dir) this.known = { dir, texts: new Map() };
    return this.known.texts;
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
