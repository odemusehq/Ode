import { ComposerDraftSchema, type ComposerAttachment, type ComposerDraft, type ComposerPending, type ComposerState, type ComposerWrite } from "../../shared/composer";
import { ApiError, errorMessage, type OdeApi } from "./api";

export interface ComposerSnapshot {
  songId: string | null;
  draft: ComposerDraft;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  pending: ComposerPending | null;
  conflicts: ComposerState["conflicts"];
  valid: boolean;
}
export interface ComposerCapture { songId: string; draft: ComposerDraft; generation: number }
interface SongDraft {
  songId: string;
  draft: ComposerDraft;
  server: ComposerState | null;
  loaded: boolean;
  generation: number;
  dirty: boolean;
  error: string | null;
  loading: Promise<void> | null;
  saving: Promise<void> | null;
  attempt: { write: ComposerWrite; generation: number } | null;
  timer: ReturnType<typeof setTimeout> | null;
  conflictBase: number | null;
  preparing: Promise<ComposerState> | null;
}
const empty = (): ComposerDraft => ({ text: "", textEditId: crypto.randomUUID(), attachments: [] });

/** Per-song drafts live on the server; this controller keeps later typing separate from pending acknowledgements. */
export class Composer {
  readonly writerId = crypto.randomUUID();
  private readonly songs = new Map<string, SongDraft>();
  private readonly listeners = new Set<() => void>();
  private current: string | null = null;
  private snapshot: ComposerSnapshot = { songId: null, draft: empty(), loaded: false, saving: false, error: null, pending: null, conflicts: [], valid: true };

  constructor(private readonly api: OdeApi) {}
  readonly subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  readonly getSnapshot = (): ComposerSnapshot => this.snapshot;

  async open(songId: string | null, refresh = false): Promise<void> {
    this.current = songId;
    this.publish();
    if (!songId) return;
    const song = this.entry(songId);
    if (song.loading) return song.loading;
    if (song.loaded && !refresh) return;
    if (song.dirty || song.saving) { if (!await this.flush(songId)) return; }
    const generation = song.generation;
    const recovering = !song.loaded;
    song.loading = (async () => {
      try {
        const stored = await this.api.getComposer(songId, this.writerId);
        if (stored.songId !== songId) throw new Error("The saved draft belongs to another song.");
        if (song.generation === generation && !song.dirty) this.take(song, stored, true, recovering);
        else if (!song.server || stored.revision === song.server.revision) this.take(song, stored, false);
        song.loaded = true;
        song.error = null;
      } catch (error) { song.error = `Reading the draft stopped: ${errorMessage(error)}`; }
      finally { song.loading = null; this.publish(); }
    })();
    return song.loading;
  }

  editText(text: string): void {
    const song = this.selected();
    if (!song || text === song.draft.text) return;
    this.edit(song, { ...song.draft, text, textEditId: crypto.randomUUID() });
  }

  appendText(text: string): void {
    const current = this.selected()?.draft.text ?? "";
    this.editText(current + (current && !/\s$/.test(current) ? " " : "") + text);
  }

  addAttachment(attachment: ComposerAttachment, songId = this.current): void {
    if (!songId) return;
    const song = this.entry(songId);
    if (!song.draft.attachments.some((entry) => entry.entryId === attachment.entryId)) this.edit(song, { ...song.draft, attachments: [...song.draft.attachments, attachment] });
  }

  removeAttachment(entryId: string): void {
    const song = this.selected();
    if (song) this.edit(song, { ...song.draft, attachments: song.draft.attachments.filter((entry) => entry.entryId !== entryId) });
  }

  capture(): ComposerCapture | null {
    const song = this.selected();
    return song?.loaded ? { songId: song.songId, draft: structuredClone(song.draft), generation: song.generation } : null;
  }

  async flush(songId = this.current): Promise<boolean> {
    if (!songId) return true;
    const song = this.entry(songId);
    this.clearTimer(song);
    if (song.loading) await song.loading;
    if (song.preparing) await song.preparing.catch(() => undefined);
    if (!song.loaded) return false;
    if (!song.dirty && song.error && !song.server?.conflicts.length) {
      try {
        const stored = await this.api.getComposer(songId, this.writerId);
        if (song.server && JSON.stringify(stored.draft) !== JSON.stringify(song.server.draft) && JSON.stringify(song.draft) !== JSON.stringify(stored.draft)) song.conflictBase ??= song.server.revision;
        this.take(song, stored, false); song.error = null;
      }
      catch (error) { this.failed(song, error); return false; }
    }
    while (song.dirty || song.saving) {
      await (song.saving ?? this.save(song));
      if (song.error || song.server?.conflicts.length) return false;
    }
    return !song.error && !song.server?.conflicts.length;
  }

  async prepare(captured: ComposerCapture): Promise<ComposerState> {
    if (!await this.flush(captured.songId)) throw new Error(this.entry(captured.songId).error ?? "Resolve the saved draft before sending.");
    const song = this.entry(captured.songId);
    const generation = song.generation;
    song.preparing = this.api.prepareComposerSend({ songId: song.songId, writerId: this.writerId, writeId: crypto.randomUUID(), baseRevision: song.server!.revision, snapshot: captured.draft });
    try {
      const stored = await song.preparing;
      if (stored.pending && JSON.stringify(ComposerDraftSchema.parse(stored.pending.snapshot)) !== JSON.stringify(ComposerDraftSchema.parse(captured.draft))) {
        throw new ApiError(409, "An earlier send still awaits acknowledgement. Stop it before sending an edited draft.", stored);
      }
      this.take(song, stored, song.generation === generation && !song.dirty);
      if (!stored.pending && !stored.acceptedRequestId) throw new Error("The saved request has no delivery receipt. Refresh the conversation before sending again.");
      return stored;
    } catch (error) { this.failed(song, error); throw error; }
    finally { song.preparing = null; if (song.dirty && !song.error) this.schedule(song); }
  }

  /** Only the clicked text identity and selection ids are consumed; later typing remains an unsent draft. */
  acknowledge(captured: ComposerCapture, stored?: ComposerState): void {
    const song = this.entry(captured.songId);
    const ids = new Set(captured.draft.attachments.map((entry) => entry.entryId));
    const unchanged = song.draft.textEditId === captured.draft.textEditId && song.draft.text === captured.draft.text;
    song.draft = { ...song.draft, ...(unchanged ? { text: "", textEditId: stored?.draft.textEditId ?? crypto.randomUUID() } : {}), attachments: song.draft.attachments.filter((entry) => !ids.has(entry.entryId)) };
    song.generation++;
    song.attempt = null;
    if (stored) this.take(song, stored, false);
    else if (song.server) song.server = { ...song.server, pending: null };
    song.dirty = !stored || JSON.stringify(song.draft) !== JSON.stringify(stored.draft);
    if (song.dirty) this.schedule(song);
    this.publish();
  }

  pendingRequests(): (ComposerCapture & { requestId: string })[] {
    return [...this.songs.values()].flatMap((song) => song.server?.pending ? [{ songId: song.songId, requestId: song.server.pending.requestId, draft: structuredClone(song.draft), generation: song.generation }] : []);
  }

  async cancelPending(requests: readonly { songId: string; requestId: string; draft?: ComposerDraft; generation?: number }[]): Promise<void> {
    for (const request of requests) {
      const song = this.entry(request.songId);
      const generation = song.generation;
      const visible = request.draft && request.generation === generation ? request.draft : structuredClone(song.draft);
      const previous = song.server;
      const stored = await this.api.cancelComposerSend({ songId: request.songId, requestId: request.requestId });
      const kept = song.generation === generation ? visible : song.draft;
      this.take(song, stored, false);
      // Stop preserves visible material as a new unsent intention, even if an earlier lost ACK consumed its ids.
      song.draft = { ...kept, textEditId: crypto.randomUUID(), attachments: kept.attachments.map((entry) => ({ ...entry, entryId: crypto.randomUUID() })) };
      if (previous && stored.draft.text && JSON.stringify(stored.draft) !== JSON.stringify(previous.draft)) song.conflictBase ??= previous.revision;
      song.generation++; song.attempt = null; song.dirty = true; song.error = null;
      this.schedule(song); this.publish();
    }
  }

  async resolve(choice: "local" | "saved", conflictId?: string): Promise<void> {
    const song = this.selected();
    let conflict = song?.server?.conflicts.find((entry) => entry.id === conflictId) ?? song?.server?.conflicts.find((entry) => entry.writerId === this.writerId) ?? song?.server?.conflicts[0];
    if (!song?.server || !conflict) return;
    this.clearTimer(song);
    if (song.saving) await song.saving;
    // Preserve any edits since the conflict was reported before choosing a copy.
    const displayedCanonical = JSON.stringify(song.draft) === JSON.stringify(song.server.draft);
    if (!displayedCanonical && JSON.stringify(song.draft) !== JSON.stringify(conflict.draft)) {
      song.dirty = true;
      song.conflictBase ??= conflict.baseRevision;
      await this.save(song);
      conflict = song.server?.conflicts.find((entry) => entry.writerId === this.writerId);
      if (!conflict || JSON.stringify(song.draft) !== JSON.stringify(conflict.draft)) throw new Error(song.error ?? "Your latest draft must be retained before choosing a copy.");
    }
    const generation = song.generation;
    const backendChoice = displayedCanonical ? choice === "local" ? "saved" : "local" : choice;
    song.preparing = this.api.resolveComposer({ songId: song.songId, writerId: this.writerId, writeId: crypto.randomUUID(), baseRevision: song.server.revision, conflictId: conflict.id, choice: backendChoice });
    this.publish();
    try {
      const stored = await song.preparing;
      const untouched = song.generation === generation;
      if (untouched) { song.dirty = false; song.attempt = null; song.error = null; song.conflictBase = null; }
      this.take(song, stored, untouched);
    } catch (error) { this.failed(song, error); throw error; }
    finally { song.preparing = null; this.publish(); if (song.dirty && !song.error) this.schedule(song); }
  }

  uploadContext(songId: string): { songId: string; writerId: string; baseRevision: number; snapshot: ComposerDraft } {
    const song = this.entry(songId);
    if (!song.loaded || !song.server) throw new Error("Read the saved draft before attaching audio.");
    return { songId, writerId: this.writerId, baseRevision: song.server.revision, snapshot: structuredClone(song.draft) };
  }

  uploaded(songId: string, entryId: string, stored: ComposerState, linked = true): void {
    const song = this.entry(songId);
    if (!linked) {
      const preserve = song.dirty || Boolean(song.saving);
      if (preserve && song.server && JSON.stringify(stored.draft) !== JSON.stringify(song.server.draft)) song.conflictBase ??= song.server.revision;
      this.take(song, stored, !preserve); return;
    }
    const conflict = stored.conflicts.find((entry) => entry.writerId === this.writerId && entry.draft.attachments.some((item) => item.entryId === entryId));
    const attachment = (conflict?.draft ?? stored.draft).attachments.find((entry) => entry.entryId === entryId);
    if (!attachment) { this.take(song, stored, false); return; }
    const previous = song.server;
    const otherEntries = stored.draft.attachments.filter((entry) => entry.entryId !== attachment.entryId);
    const ownAppend = previous && stored.draft.textEditId === previous.draft.textEditId && stored.draft.text === previous.draft.text && JSON.stringify(otherEntries) === JSON.stringify(previous.draft.attachments);
    if (ownAppend && !song.saving) this.take(song, stored, false);
    if (!song.draft.attachments.some((entry) => entry.entryId === attachment.entryId)) { song.draft = { ...song.draft, attachments: [...song.draft.attachments, attachment] }; song.generation++; }
    if (conflict) { song.conflictBase = conflict.baseRevision; this.take(song, stored, false); song.error = "Both drafts are saved; choose which to use."; }
    if (!ownAppend || song.saving) { song.dirty = true; this.schedule(song); }
    this.publish();
  }

  /** Bounded best effort only. Explicit close/switch awaits flush; an abrupt process death can still lose the tail. */
  pagehide(): void {
    let remaining = 48 * 1_024;
    const songs = [...this.songs.values()].sort((left) => left.songId === this.current ? -1 : 1);
    for (const song of songs) {
      if (!song.loaded || !song.dirty || !song.server) continue;
      if (!ComposerDraftSchema.safeParse(song.draft).success) continue;
      const write = this.write(song);
      const bytes = new TextEncoder().encode(JSON.stringify(write)).length;
      if (bytes > remaining) continue;
      remaining -= bytes;
      void this.api.saveComposer(write, true).catch(() => undefined);
    }
  }

  dispose(): void { for (const song of this.songs.values()) this.clearTimer(song); }

  private entry(songId: string): SongDraft {
    let song = this.songs.get(songId);
    if (!song) { song = { songId, draft: empty(), server: null, loaded: false, generation: 0, dirty: false, error: null, loading: null, saving: null, attempt: null, timer: null, conflictBase: null, preparing: null }; this.songs.set(songId, song); }
    return song;
  }
  private selected(): SongDraft | null { return this.current ? this.entry(this.current) : null; }
  private edit(song: SongDraft, draft: ComposerDraft): void {
    const parsed = ComposerDraftSchema.safeParse(draft);
    if (!parsed.success) {
      this.clearTimer(song);
      if (ComposerDraftSchema.safeParse({ ...draft, text: "" }).success) { song.draft = draft; song.generation++; song.dirty = true; song.error = "Draft too long to save. Shorten it to send."; }
      else song.error = parsed.error.issues[0]?.message ?? "The attachment metadata is invalid.";
      this.publish(); return;
    }
    song.draft = parsed.data; song.generation++; song.dirty = true; song.error = null;
    this.schedule(song); this.publish();
  }
  private schedule(song: SongDraft): void { this.clearTimer(song); song.timer = setTimeout(() => { song.timer = null; void this.save(song); }, 300); }
  private clearTimer(song: SongDraft): void { if (song.timer !== null) clearTimeout(song.timer); song.timer = null; }
  private write(song: SongDraft): ComposerWrite { return { songId: song.songId, writerId: this.writerId, writeId: crypto.randomUUID(), sequence: song.generation, baseRevision: song.conflictBase ?? song.server?.revision ?? 0, draft: structuredClone(song.draft) }; }
  private save(song: SongDraft): Promise<void> {
    if (song.preparing) return song.preparing.catch(() => undefined).then(() => this.save(song));
    if (song.saving) return song.saving;
    if (!song.loaded || !song.dirty) return Promise.resolve();
    if (!ComposerDraftSchema.safeParse(song.draft).success) { song.error = "Draft too long to save. Shorten it to send."; this.publish(); return Promise.resolve(); }
    this.clearTimer(song);
    const attempt = song.attempt ?? { write: this.write(song), generation: song.generation };
    song.attempt = attempt;
    song.saving = (async () => {
      try {
        const stored = await this.api.saveComposer(attempt.write);
        const unchanged = song.generation === attempt.generation;
        // A replayed write id can return a newer canonical draft from another window. It is not our new edits' base.
        if (!unchanged && JSON.stringify(stored.draft) !== JSON.stringify(attempt.write.draft)) song.conflictBase ??= attempt.write.baseRevision;
        song.attempt = null; song.dirty = !unchanged; song.error = null;
        this.take(song, stored, unchanged);
      } catch (error) { this.failed(song, error); }
      finally { song.saving = null; this.publish(); if (song.dirty && !song.error) this.schedule(song); }
    })();
    this.publish();
    return song.saving;
  }
  private failed(song: SongDraft, error: unknown): void {
    if (error instanceof ApiError && error.composer) {
      if (error.composer.conflicts.length) song.conflictBase ??= song.attempt?.write.baseRevision ?? error.composer.conflicts[0]!.baseRevision;
      song.server = error.composer; song.attempt = null;
    }
    song.error = errorMessage(error); this.publish();
  }
  private take(song: SongDraft, stored: ComposerState, replace: boolean, recover = false): void {
    if (stored.songId !== song.songId || stored.revision < (song.server?.revision ?? 0)) return;
    song.server = stored;
    if (replace) {
      const conflict = recover ? stored.conflicts.find((entry) => entry.writerId === this.writerId) ?? stored.conflicts[0] : undefined;
      song.draft = structuredClone(conflict?.draft ?? stored.draft);
      song.conflictBase = conflict?.baseRevision ?? null;
    }
    this.publish();
  }
  private publish(): void {
    const song = this.selected();
    this.snapshot = song ? { songId: song.songId, draft: song.draft, loaded: song.loaded, saving: Boolean(song.saving || song.preparing), error: song.error, pending: song.server?.pending ?? null, conflicts: song.server?.conflicts ?? [], valid: ComposerDraftSchema.safeParse(song.draft).success } : { songId: null, draft: empty(), loaded: false, saving: false, error: null, pending: null, conflicts: [], valid: true };
    for (const listener of this.listeners) listener();
  }
}
