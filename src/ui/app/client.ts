import { API } from "../../shared/api";
import type { RestoreResult, SongsResponse } from "../../shared/api";
import type { Suggestion, UiEvent } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import { ApiError, OdeApi, errorMessage } from "./api";
import { DialogResult, LiveDialog } from "./dialog";
import { EventStream } from "./events";
import { Layout } from "./layout";
import type { Decision } from "./model";
import { SharedLyrics } from "./shared-lyrics";
import { Store } from "./state";
import { Composer } from "./composer";
import type { AudioScope } from "./api";

/** Ode as the UI sees it: the server's API, its event stream and the state they feed. */
export class OdeClient {
  readonly store = new Store();
  readonly api = new OdeApi();
  readonly composer = new Composer(this.api);
  /** The lyrics the musician and Ode both edit; the Lyrics dialog keeps them in step. */
  readonly lyrics = new SharedLyrics(this.api);
  private readonly stream: EventStream;
  /** An Undo is on its way; a second press meanwhile is ignored, so each Undo goes back one version. */
  private undoing = false;
  private conversationRead = 0;
  private versionsRead = 0;
  private sendEpoch = 0;
  private readonly sending = new Set<AbortController>();
  private readonly pendingIds = new Map<string, string>();

  constructor(readonly layout: Layout) {
    this.stream = new EventStream(API.events, {
      onEvent: (event) => this.receive(event),
      onState: (state) => this.store.setStream(state),
      onOpen: () => this.opened(),
    });
  }

  /** Settings reads its own data; the other dialogs follow Ode's event stream. History first saves what changed in Live by hand. */
  start(): void {
    if (this.layout === Layout.Settings) return;
    this.stream.start();
    if (this.layout === Layout.Ask) window.addEventListener("pagehide", () => this.composer.pagehide());
    if (this.layout === Layout.History) void this.checkVersions();
  }

  /**
   * Reads again what events may have missed: the status, the lyrics in the Lyrics dialog and the history in History.
   * The server sends the selection, its suggestions and anything waiting for the musician when the stream opens.
   */
  async refresh(): Promise<void> {
    const reads = [this.refreshStatus()];
    if (this.layout === Layout.Lyrics) reads.push(this.lyrics.load(true));
    if (this.layout === Layout.History) reads.push(this.loadVersions());
    if (this.layout === Layout.Ask) reads.push(this.loadConversation().then(() => this.loadVersions()));
    await Promise.allSettled(reads);
  }

  songs(): Promise<SongsResponse> {
    return this.api.getSongs();
  }

  /** Saves the lyrics waiting to be saved, then switches Ode to another song and reads its title, lyrics or history. Throws when it fails. */
  async openSong(id: string): Promise<void> {
    await this.saveComposer();
    await this.saveLyrics();
    await this.api.openSong(id);
    await this.refresh();
  }

  /** Saves the lyrics waiting to be saved, then starts a new song and switches to it. Throws when it fails. */
  async createSong(title: string): Promise<void> {
    await this.saveComposer();
    await this.saveLyrics();
    await this.api.createSong(title);
    await this.refresh();
  }

  /** Saves the lyrics waiting to be saved, then closes the dialog back to Live; a failed save keeps it open, with the reason on the panel. */
  async close(): Promise<void> {
    if (!await this.composer.flush()) return;
    if (!await this.lyrics.flush()) return;
    LiveDialog.close(DialogResult.Done);
  }

  async refreshStatus(): Promise<void> {
    this.store.setStatus(await this.api.getStatus());
  }

  async loadVersions(): Promise<void> {
    const read = ++this.versionsRead;
    const songId = this.store.getSnapshot().songId;
    try {
      const versions = await this.api.getVersions();
      if (read === this.versionsRead && songId === this.store.getSnapshot().songId) this.store.setVersions(versions);
    } catch (error) {
      if (read === this.versionsRead && songId === this.store.getSnapshot().songId) this.store.setHistoryError(`Reading the history stopped: ${errorMessage(error)}`);
    }
  }

  /** Sends a typed line or a tapped suggestion; Ode answers with a result line. */
  async send(text: string): Promise<boolean> {
    const request = text.trim();
    if (!request) return false;
    const epoch = this.sendEpoch;
    const songId = this.store.getSnapshot().songId;
    const scope = `${songId ?? ""}\n${request}`;
    const requestId = this.pendingIds.get(scope) ?? crypto.randomUUID();
    this.pendingIds.set(scope, requestId);
    if (this.pendingIds.size > 128) this.pendingIds.delete(this.pendingIds.keys().next().value!);
    const controller = new AbortController();
    this.sending.add(controller);
    this.store.startRequest();
    try {
      await this.saveLyrics();
      if (epoch !== this.sendEpoch) return false;
      if (!songId || songId !== this.store.getSnapshot().songId) throw new Error("The open song changed or is still loading. Send this message again in the intended song.");
      await this.api.chat({ text: request, requestId, songId }, controller.signal);
      this.pendingIds.delete(scope);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) this.store.setError(`Send was not confirmed: ${errorMessage(error)}`);
      return false;
    } finally {
      this.sending.delete(controller);
    }
  }

  tap(suggestion: Suggestion): Promise<boolean> {
    return this.send(suggestion.request);
  }

  /** The clicked draft and its durable request id are frozen before dispatch; later edits remain unsent. */
  async sendDraft(): Promise<boolean> {
    const captured = this.composer.capture();
    if (!captured || (!captured.draft.text.trim() && !captured.draft.attachments.length)) return false;
    const epoch = this.sendEpoch;
    const controller = new AbortController();
    this.sending.add(controller);
    this.store.startRequest();
    try {
      await this.saveLyrics();
      if (epoch !== this.sendEpoch) return false;
      if (captured.songId !== this.store.getSnapshot().songId) throw new Error("The open song changed. Your draft stays with its song.");
      const prepared = await this.composer.prepare(captured);
      if (epoch !== this.sendEpoch || controller.signal.aborted) {
        const requestId = prepared.pending?.requestId ?? prepared.acceptedRequestId;
        if (requestId) await this.composer.cancelPending([{ ...captured, requestId }]);
        return false;
      }
      if (prepared.acceptedRequestId) { this.composer.acknowledge(captured, prepared); return true; }
      const pending = prepared.pending!;
      if (captured.songId !== this.store.getSnapshot().songId) throw new Error("The open song changed. Your draft stays with its song.");
      const response = await this.api.chat({ text: pending.payload, requestId: pending.requestId, songId: captured.songId }, controller.signal);
      if (epoch !== this.sendEpoch || controller.signal.aborted) return false;
      this.composer.acknowledge(captured, response.composer);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) this.store.setError(`Send was not confirmed: ${errorMessage(error)}`);
      return false;
    } finally { this.sending.delete(controller); }
  }

  async attachAudio(file: File, scope: AudioScope, source: string, songId: string): Promise<void> {
    if (!await this.composer.flush(songId)) throw new Error("Save or resolve the draft before attaching audio.");
    const entryId = crypto.randomUUID();
    const context = this.composer.uploadContext(songId);
    try {
      const uploaded = await this.api.importAudio(file, scope, source, { ...context, entryId });
      if (!uploaded.composer) throw new Error("The audio was uploaded but its draft link was not acknowledged. Refresh the saved draft.");
      this.composer.uploaded(songId, entryId, uploaded.composer, uploaded.linked !== false);
    } catch (error) {
      if (error instanceof ApiError && error.composer) this.composer.uploaded(songId, entryId, error.composer);
      throw error;
    }
  }

  /** Asks why Ode made the change with this version; the short answer goes under its result line. */
  async askWhy(versionId: string): Promise<void> {
    const epoch = this.sendEpoch;
    this.store.startRequest();
    try {
      await this.saveLyrics();
      if (epoch !== this.sendEpoch) return;
      await this.api.why({ versionId });
    } catch (error) {
      this.store.setError(`Ode's answer stopped: ${errorMessage(error)}`);
    }
  }

  /** Another take of the change with this version, in place. */
  async again(versionId: string): Promise<void> {
    const epoch = this.sendEpoch;
    this.store.startRequest();
    try {
      await this.saveLyrics();
      if (epoch !== this.sendEpoch) return;
      await this.api.again({ versionId });
    } catch (error) {
      this.store.setError(`Another take stopped: ${errorMessage(error)}`);
    } finally {
      await this.loadVersions();
    }
  }

  /** Back to the version before the change with this version; the server's result line says how it went. */
  async undo(versionId: string): Promise<void> {
    if (this.undoing) return;
    this.undoing = true;
    this.store.startRequest();
    try {
      const outcome = await this.api.undo({ versionId });
      if (!outcome.restored) this.store.setError(refusal("Undo stopped", outcome));
    } catch (error) {
      this.store.setError(`Undo stopped: ${errorMessage(error)}`);
    } finally {
      await this.loadVersions();
      this.undoing = false;
    }
  }

  async stopRequest(): Promise<void> {
    this.sendEpoch += 1;
    for (const controller of this.sending) controller.abort();
    const cancelled = new Set(this.pendingIds.values());
    const drafts = this.composer.pendingRequests();
    for (const draft of drafts) cancelled.add(draft.requestId);
    try {
      await this.api.stop([...cancelled]);
      for (const [scope, id] of this.pendingIds) if (cancelled.has(id)) this.pendingIds.delete(scope);
      await this.composer.cancelPending(drafts);
      await this.refreshStatus();
    } catch (error) {
      this.store.setError(`Stop stayed here: ${errorMessage(error)}`);
    }
  }

  async answer(questionId: string, choice: string): Promise<void> {
    this.store.setQuestionAnswered(questionId, true);
    try {
      await this.api.answer(questionId, { choice });
    } catch (error) {
      this.store.setQuestionAnswered(questionId, false);
      this.store.setError(`Your answer stayed here: ${errorMessage(error)}`);
    }
  }

  /** Apply ("allow") or Skip ("deny") a change Ode wants to make. */
  async decide(approvalId: string, decision: Decision): Promise<void> {
    this.store.setApprovalDecided(approvalId, true);
    try {
      await this.api.decide(approvalId, { decision });
    } catch (error) {
      this.store.setApprovalDecided(approvalId, false);
      this.store.setError(`Your choice stayed here: ${errorMessage(error)}`);
    }
  }

  async setMode(mode: Mode): Promise<void> {
    const previous = this.store.getSnapshot().mode;
    this.store.setMode(mode);
    try {
      this.store.setMode((await this.api.setMode({ mode })).mode);
    } catch (error) {
      this.store.setMode(previous);
      this.store.setError(`The mode stayed as it was: ${errorMessage(error)}`);
    }
  }

  /** Restores supported state after confirmation and keeps the saved history. Throws when it fails. */
  async restoreVersion(id: string): Promise<RestoreResult> {
    const outcome = await this.api.restoreVersion(id);
    await this.loadVersions();
    return outcome;
  }

  /** Throws when it fails. */
  async nameVersion(id: string, name: string): Promise<void> {
    this.store.putVersion(await this.api.nameVersion(id, { name }));
  }

  private opened(): void {
    this.store.streamOpened();
    void this.refresh();
  }

  private receive(event: UiEvent): void {
    if (event.type === "conversation" || event.type === "title") this.conversationRead += 1;
    this.store.apply(event);
    if (event.type === "lyrics" && this.layout === Layout.Lyrics) this.lyrics.receive(event.lyrics);
    // Another song is in use: its lyrics and history replace these.
    if (event.type === "title") void this.refresh();
  }

  private async loadConversation(): Promise<void> {
    const read = ++this.conversationRead;
    try {
      const conversation = await this.api.getConversation();
      if (read === this.conversationRead) this.store.setConversation(conversation.songId, conversation.exchanges);
      if (read === this.conversationRead && this.layout === Layout.Ask) await this.composer.open(conversation.songId, true);
    } catch (error) {
      if (read === this.conversationRead) this.store.setError(`Reading the conversation stopped: ${errorMessage(error)}`);
    }
  }

  private async saveLyrics(): Promise<void> {
    if (!await this.lyrics.flush()) throw new Error(this.lyrics.getSnapshot().saveError ?? "Save the lyrics before continuing.");
  }

  private async saveComposer(): Promise<void> {
    if (!await this.composer.flush()) throw new Error(this.composer.getSnapshot().error ?? "Save or resolve the current draft before changing songs.");
  }

  private async checkVersions(): Promise<void> {
    try {
      const version = await this.api.checkVersions();
      if (version) this.store.putVersion(version);
    } catch {
      // The next request saves the hand edits anyway.
    }
  }
}

/** "Undo stopped: You have changed the Set since…", from the reasons the server gave. */
function refusal(what: string, outcome: RestoreResult): string {
  const reasons = outcome.skipped.join("; ");
  return reasons ? `${what}: ${reasons}` : `${what}.`;
}
