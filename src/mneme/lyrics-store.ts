import { diff3MergeRegions } from "node-diff3";
import { analyzeLyrics } from "../music/prosody/lyrics-analyzer";
import type { LyricsSaved, LyricsState } from "../shared/lyrics";
import type { LeadSheet } from "../shared/song";
import { VersionAuthor } from "../shared/versions";
import { LyricsText } from "./lyrics-text";
import type { PreferencesStore } from "./preferences";
import type { SongStore } from "./song-store";

/** Ode saved lyrics edited from a revision whose text isn't known any more, so its change can't be merged. */
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
      const sheet = await this.song.read();
      this.texts().set(sheet.lyricsRevision, sheet.lyrics);
      return this.state(sheet);
    });
  }

  /**
   * Saves `text`, edited from `baseRevision`. The musician's lines win where both changed the same lines: theirs when
   * they save, the stored ones when Ode saves. When the base revision's text isn't known, a save by the musician is
   * stored as sent and a save by Ode is refused, so Ode reads the lyrics again first.
   */
  write(text: string, baseRevision: number, author: VersionAuthor): Promise<LyricsSaved> {
    return this.enqueue(async () => {
      const saved = LyricsText.normalize(text);
      const texts = this.texts();
      let conflicts: number[] = [];
      const sheet = await this.song.saveLyrics((current) => {
        texts.set(current.lyricsRevision, current.lyrics);
        if (baseRevision === current.lyricsRevision) return saved;
        const base = texts.get(baseRevision);
        if (base === undefined) {
          if (author === VersionAuthor.Musician) return saved;
          throw new StaleLyricsError(
            `The lyrics have changed since revision ${baseRevision}: read them again with lyrics_read and make the change on that text.`,
          );
        }
        const keep = author === VersionAuthor.Musician ? Keep.Saved : Keep.Stored;
        const merged = LineMerge.run(LyricsText.lines(base), LyricsText.lines(saved), LyricsText.lines(current.lyrics), keep);
        conflicts = merged.conflicts;
        return merged.lines.join("\n");
      });
      return { ...(await this.stored(sheet)), conflicts };
    });
  }

  /** Stores `text` as a new revision as it is, without merging (a restore puts back the lyrics of a version). */
  replace(text: string): Promise<LyricsState> {
    return this.enqueue(async () => this.stored(await this.song.saveLyrics(() => LyricsText.normalize(text))));
  }

  private async stored(sheet: LeadSheet): Promise<LyricsState> {
    this.texts().set(sheet.lyricsRevision, sheet.lyrics);
    const state = await this.state(sheet);
    this.onChange(state);
    return state;
  }

  /** The text with its analysis in the song's pronunciation; blank and label lines are analysed as empty lines. */
  private async state(sheet: LeadSheet): Promise<LyricsState> {
    const accent = (await this.prefs.effective(sheet)).pronunciation;
    return { text: sheet.lyrics, revision: sheet.lyricsRevision, analysis: analyzeLyrics(LyricsText.forAnalysis(sheet.lyrics), accent) };
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
