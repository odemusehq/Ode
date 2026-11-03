import { t } from "../shared/i18n";
import { diff3MergeRegions } from "node-diff3";
import type { LyricsCheck, LyricsCheckResponse, LyricsSaved, LyricsState } from "../shared/lyrics";
import { LyricsDocument, LyricsChoiceSchema, LyricsCheckSchema, VocalClipSchema, type LyricsChoiceWrite, type WordChoice, type VocalClip } from "../shared/lyrics-document";
import type { Accent } from "../shared/personalisation";
import type { LyricsChecker } from "../services/lyrics-checker";
import type { ClipRef, Note } from "../shared/live";
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
    _prefs: PreferencesStore,
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

  /** The configured Lyricist supplies interpretation. Unchanged input is served by its exact context cache. */
  async analyse(checker: LyricsChecker, accent: Accent, signal?: AbortSignal, request?: string): Promise<LyricsCheckResponse> {
    const current = await this.read();
    const notation = current.notation ?? LyricsDocument.empty();
    const answer = await checker.check(LyricsText.sung(current.text), accent, signal, { text: current.text, choices: notation.choices, clips: notation.clips, ...(request ? { request } : {}) });
    signal?.throwIfAborted();
    if (answer.status !== "ok") return answer;
    if (!await this.saveCheck(current.songId, current.text, accent, answer.check, notation.choices)) {
      return { status: "unreachable", detail: t("lyrics.document.checkChanged") };
    }
    const saved = await this.read();
    if (saved.songId !== current.songId) return { status: "unreachable", detail: t("lyrics.document.songChanged") };
    return { status: "ok", check: saved.check ?? answer.check };
  }

  /** A late answer never annotates another text/song. Newer musician choices remain authoritative. */
  saveCheck(songId: string, text: string, accent: Accent, check: LyricsCheck, choices?: WordChoice[]): Promise<boolean> {
    return this.enqueue(async () => {
      if (songId !== this.song.songId) return false;
      const texts = this.texts();
      const current = await this.song.read();
      if (current.lyrics !== text) return false;
      const valid = LyricsCheckSchema.parse(check);
      if (valid.lines.length !== LyricsText.sung(text).length) throw new Error(t("lyrics.document.checkIncomplete"));
      const sheet = await this.song.updateNotation(stored => {
        if (songId !== this.song.songId) throw new LyricsForAnotherSongError(t("lyrics.document.songChanged"));
        if (stored.lyrics !== text) throw new StaleLyricsError(t("lyrics.document.checkStale"));
        const notation = stored.notation ?? LyricsDocument.empty();
        const next = structuredClone({ ...notation, revision: notation.revision + 1,
          analysis: { text, accent, check: valid, choices: structuredClone(choices ?? notation.choices) } });
        const previous = LyricsDocument.check(notation, text), updated = LyricsDocument.check(next, text);
        const lines = LyricsText.lines(text);
        for (const clip of next.clips) for (const binding of clip.bindings) {
          const at = lines.slice(0, binding.line - 1).filter(LyricsText.isSung).length;
          const before = previous?.lines[at]?.words[binding.word], after = updated?.lines[at]?.words[binding.word];
          if (!before || !after || before.text !== after.text || JSON.stringify(before.syllables) !== JSON.stringify(after.syllables)) binding.stale = true;
        }
        return next;
      });
      await this.stored(sheet, songId, texts);
      return true;
    });
  }

  /** Save a literal musician/model pronunciation choice, without guessing a split or rewriting text. */
  choose(input: LyricsChoiceWrite): Promise<LyricsState> {
    const choice = LyricsChoiceSchema.parse(input);
    return this.enqueue(async () => {
      const texts = this.texts();
      const sheet = await this.song.updateNotation(current => {
        this.assertRevision(current, choice.songId, choice.baseRevision, choice.notationRevision);
        const notation = structuredClone(current.notation ?? LyricsDocument.empty());
        const lines = LyricsText.lines(current.lyrics);
        const lineText = lines[choice.line - 1];
        const sungIndex = lines.slice(0, choice.line - 1).filter(LyricsText.isSung).length;
        const previous = LyricsDocument.check(notation, current.lyrics)?.lines[sungIndex]?.words[choice.word];
        if (!lineText || !LyricsText.isSung(lineText) || !previous || previous.text !== choice.value.text || choice.value.syllables.join("") !== previous.text) {
          throw new Error(t("lyrics.document.chooseWord"));
        }
        notation.choices = notation.choices.filter(item => item.line !== choice.line || item.word !== choice.word);
        notation.choices.push({ line: choice.line, lineText, word: choice.word, value: choice.value });
        if (JSON.stringify(previous.syllables) !== JSON.stringify(choice.value.syllables)) {
          for (const clip of notation.clips) for (const binding of clip.bindings) {
            if (binding.line === choice.line && binding.word === choice.word) binding.stale = true;
          }
        }
        notation.revision++;
        return notation;
      });
      return this.stored(sheet, choice.songId, texts);
    });
  }

  /** Bind model-chosen syllables to notes actually read from Live. Other lines on this clip keep their bindings. */
  bind(songId: string, baseRevision: number, notationRevision: number, input: VocalClip): Promise<LyricsState> {
    const clip = VocalClipSchema.parse(input);
    return this.enqueue(async () => {
      const texts = this.texts();
      const sheet = await this.song.updateNotation(current => {
        this.assertRevision(current, songId, baseRevision, notationRevision);
        const notation = structuredClone(current.notation ?? LyricsDocument.empty());
        const lines = LyricsText.lines(current.lyrics);
        const check = LyricsDocument.check(notation, current.lyrics);
        for (const binding of clip.bindings) {
          const lineText = lines[binding.line - 1];
          const sungIndex = lines.slice(0, binding.line - 1).filter(LyricsText.isSung).length;
          const word = check?.lines[sungIndex]?.words[binding.word];
          if (lineText !== binding.text || !word?.syllables[binding.syllable] || binding.notes.some(index => !clip.notes[index]) || new Set(binding.notes).size !== binding.notes.length) {
            throw new Error(t("lyrics.document.bindingChanged"));
          }
        }
        const previous = notation.clips.find(item => JSON.stringify(item.clip) === JSON.stringify(clip.clip));
        const replaced = new Set(clip.bindings.map(binding => binding.line));
        if (previous) {
          const sameNotes = JSON.stringify(previous.notes) === JSON.stringify(clip.notes);
          clip.bindings = [...previous.bindings.filter(binding => !replaced.has(binding.line)).map(binding => sameNotes ? binding : { ...binding, stale: true }), ...clip.bindings];
          clip.id = previous.id;
        }
        notation.clips = [...notation.clips.filter(item => JSON.stringify(item.clip) !== JSON.stringify(clip.clip)), clip];
        notation.revision++;
        return notation;
      });
      return this.stored(sheet, songId, texts);
    });
  }

  /** Re-read native notes without inventing their identity. Changed geometry requires explicit re-association. */
  async refreshMelody(read: (clip: ClipRef) => Promise<Note[]>, signal?: AbortSignal): Promise<{ lyrics: LyricsState; verified: boolean }> {
    const current = await this.read();
    const notation = current.notation;
    if (!notation?.clips.length) return { lyrics: current, verified: true };
    const results = await Promise.allSettled(notation.clips.map(clip => read(clip.clip)));
    signal?.throwIfAborted();
    if (current.songId !== this.song.songId) throw new LyricsForAnotherSongError(t("lyrics.document.melodySongChanged"));
    const changed = results.some((result, index) => result.status === "fulfilled" && JSON.stringify(result.value) !== JSON.stringify(notation.clips[index]!.notes));
    if (!changed) {
      const latest = await this.read();
      return { lyrics: latest, verified: latest.songId === current.songId && latest.revision === current.revision && latest.notation?.revision === notation.revision && results.every(result => result.status === "fulfilled") };
    }
    return this.enqueue(async () => {
      const texts = this.texts();
      let verified = results.every(result => result.status === "fulfilled");
      const sheet = await this.song.updateNotation(stored => {
        if (current.songId !== this.song.songId) throw new LyricsForAnotherSongError(t("lyrics.document.melodySongChanged"));
        if (stored.notation?.revision !== notation.revision || stored.lyricsRevision !== current.revision) {
          verified = false;
          return stored.notation ?? LyricsDocument.empty();
        }
        const next = structuredClone(notation);
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const clip = next.clips[index]!;
          const previous = clip.notes;
          clip.notes = result.value;
          for (const binding of clip.bindings) {
            if (previous.length !== result.value.length || binding.notes.some(at => {
              const before = previous[at], after = result.value[at];
              return !before || !after || before.pitch !== after.pitch || before.start !== after.start || before.duration !== after.duration;
            })) binding.stale = true;
          }
        });
        next.revision++;
        return next;
      });
      return { lyrics: await this.stored(sheet, current.songId, texts), verified };
    });
  }

  private assertRevision(sheet: LeadSheet, songId: string, textRevision: number, notationRevision: number): void {
    if (songId !== this.song.songId) throw new LyricsForAnotherSongError(t("lyrics.document.annotationsSongChanged"));
    if (sheet.lyricsRevision !== textRevision || (sheet.notation?.revision ?? 0) !== notationRevision) {
      throw new StaleLyricsError(t("lyrics.document.annotationsChanged"));
    }
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

  /** Literal saved text only; lyric interpretation belongs to the configured Lyricist. */
  private state(sheet: LeadSheet, song: string): LyricsState {
    const check = sheet.notation ? LyricsDocument.check(sheet.notation, sheet.lyrics) : undefined;
    return {
      songId: song,
      text: sheet.lyrics,
      revision: sheet.lyricsRevision,
      strictRhymes: sheet.strictRhymes,
      ...(sheet.notation ? { notation: sheet.notation } : {}),
      ...(check ? { check } : {}),
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
