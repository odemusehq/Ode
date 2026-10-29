import type { LyricsSaved, LyricsState, LyricsWrite } from "../../shared/lyrics";
import { errorMessage } from "./api";
import type { OdeApi } from "./api";
import { UI_CONFIG } from "./config";
import { Debouncer } from "./debounce";

/** The lyrics as the panel shows them. */
export interface LyricsSnapshot {
  /** The text in the editor, with the musician's unsaved edits. */
  text: string;
  /** The lyrics as last stored, with their analysis; null until they have been read. */
  stored: LyricsState | null;
  /** Goes up each time the stored text replaces the editor's, so the panel can put the caret back. */
  replaced: number;
  /** Why the last save failed, until a save works. */
  saveError: string | null;
  /** Why reading the lyrics stopped, until a read succeeds. */
  loadError: string | null;
}

/**
 * The lyrics the musician and Ode both edit. The musician's edits are saved after a pause with the revision they
 * were made from, so the server merges them with anything Ode saved in between; whenever every edit is
 * saved, the editor shows the stored text.
 */
export class SharedLyrics {
  private snapshot: LyricsSnapshot = { text: "", stored: null, replaced: 0, saveError: null, loadError: null };
  private readonly listeners = new Set<() => void>();
  private readonly saver = new Debouncer(UI_CONFIG.lyricsSaveDelayMs);
  /** The revision the editor's text was edited from. */
  private base = 0;
  /** The editor has edits still waiting to be sent. */
  private changed = false;
  private saving: Promise<void> | null = null;
  /** Counts the newer lyrics taken from the event stream, so a read that started earlier leaves them in place. */
  private received = 0;

  constructor(private readonly api: OdeApi) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): LyricsSnapshot => this.snapshot;

  /**
   * Reads the stored lyrics, for what the event stream may have missed. When another song may be in use, its lyrics
   * replace the editor's text unless edits are waiting to be saved.
   */
  async load(anotherSong = false): Promise<void> {
    const seen = this.received;
    let state: LyricsState;
    try {
      state = await this.api.getLyrics();
    } catch (error) {
      if (!this.snapshot.stored) this.update({ loadError: `Reading the lyrics stopped: ${errorMessage(error)}` });
      return;
    }
    if (this.received !== seen) return;
    if (anotherSong && !this.changed && !this.saving) this.adopt(state);
    else this.take(state);
  }

  /** New lyrics from the event stream: saved from a window, by Ode or by a restore. */
  receive(state: LyricsState): void {
    if (this.take(state)) this.received += 1;
  }

  /** The musician changed the text; it is saved once they pause. */
  edit(text: string): void {
    if (text === this.snapshot.text) return;
    this.changed = true;
    this.update({ text });
    this.saver.schedule(() => void this.save());
  }

  /** Saves every pending edit. False keeps the draft in place when saving fails. */
  async flush(): Promise<boolean> {
    this.saver.cancel();
    while (this.saving || this.changed) {
      await (this.saving ?? this.save());
      if (this.snapshot.saveError !== null) return false;
    }
    return this.snapshot.saveError === null;
  }

  retrySave(): void {
    this.saver.cancel();
    void this.save();
  }

  /** Turns perfect rhymes on or off for the sections called `name`. */
  async setStrictRhymes(name: string, strict: boolean): Promise<void> {
    this.takeStrictRhymes(await this.api.setStrictRhymes({ name, strict }));
  }

  /** The sections asking for perfect rhymes changed while the text stayed the same. */
  private takeStrictRhymes(state: LyricsState): void {
    const { stored } = this.snapshot;
    if (stored && stored.songId === state.songId && stored.strictRhymes.join("\n") !== state.strictRhymes.join("\n")) {
      this.update({ stored: { ...stored, strictRhymes: state.strictRhymes } });
    }
  }

  /**
   * Stored lyrics newer than the ones known: shown at once unless the musician has edits on the way. Another song's
   * lyrics always replace these, since its revisions count from its own start. False when older.
   */
  private take(state: LyricsState): boolean {
    const { stored } = this.snapshot;
    if (stored && state.songId !== stored.songId) {
      if (this.changed || this.saving) {
        this.update({ saveError: "The song changed while these lyrics were unsaved. Your draft is still here; save it before leaving." });
        return false;
      }
      this.saver.cancel();
      this.changed = false;
      this.adopt(state);
      return true;
    }
    if (stored && state.revision <= stored.revision) {
      if (state.revision === stored.revision) this.takeStrictRhymes(state);
      return false;
    }
    if (this.saving) {
      // The save's answer decides what the editor shows.
      this.update({ stored: state, loadError: null });
    } else if (this.changed) {
      // Saved now with the revision the edits were made from: the server merges them with these lyrics.
      this.update({ stored: state, loadError: null });
      this.saver.cancel();
      void this.save();
    } else {
      this.adopt(state);
    }
    return true;
  }

  /** The editor shows the stored text; every edit is saved. */
  private adopt(state: LyricsState): void {
    this.base = state.revision;
    const { text, replaced } = this.snapshot;
    this.update({ stored: state, text: state.text, replaced: state.text === text ? replaced : replaced + 1, saveError: null, loadError: null });
  }

  private save(): Promise<void> {
    if (!this.saving) {
      this.saving = this.send().finally(() => {
        this.saving = null;
        // Edits made while the text was on its way wait for their own save.
        if (this.changed && this.snapshot.saveError === null) this.saver.schedule(() => void this.save());
      });
    }
    return this.saving;
  }

  private async send(): Promise<void> {
    if (!this.changed) return;
    const songId = this.snapshot.stored?.songId;
    const write: LyricsWrite = { text: this.snapshot.text, baseRevision: this.base, ...(songId ? { songId } : {}) };
    this.changed = false;
    let saved: LyricsSaved;
    try {
      saved = await this.api.saveLyrics(write);
    } catch (error) {
      this.changed = true;
      this.update({ saveError: `Your lyrics are waiting to be saved: ${errorMessage(error)}` });
      return;
    }
    this.accept(saved, write.text);
  }

  private accept(saved: LyricsSaved, sent: string): void {
    const { stored } = this.snapshot;
    const newest = stored && stored.revision > saved.revision ? stored : saved;
    if (!this.changed) {
      this.adopt(newest);
      return;
    }
    // The musician typed while the text was on its way. Stored as sent, their edits build on that revision; merged
    // with lines saved in between, the base stays, so the next save is merged again and keeps both.
    if (saved.text === sent) this.base = saved.revision;
    this.update({ stored: newest, saveError: null });
  }

  private update(patch: Partial<LyricsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
