import { API } from "../../shared/api";
import type { RestoreResult, SongsResponse } from "../../shared/api";
import type { Suggestion, UiEvent } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import { OdeApi, errorMessage } from "./api";
import { DialogResult, LiveDialog } from "./dialog";
import { EventStream } from "./events";
import { Layout } from "./layout";
import type { Decision } from "./model";
import { SharedLyrics } from "./shared-lyrics";
import { Store } from "./state";

/** Ode as the UI sees it: the server's API, its event stream and the state they feed. */
export class OdeClient {
  readonly store = new Store();
  readonly api = new OdeApi();
  /** The lyrics the musician and Ode both edit; the Lyrics dialog keeps them in step. */
  readonly lyrics = new SharedLyrics(this.api);
  private readonly stream: EventStream;
  /** An Undo is on its way; a second press doesn't go back a second version. */
  private undoing = false;

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
    if (this.layout === Layout.History) void this.checkVersions();
  }

  stop(): void {
    this.stream.stop();
  }

  /**
   * Reads again what events may have missed: the status, the lyrics in the Lyrics dialog and the history in History.
   * The server sends the selection, its suggestions and anything waiting for the musician when the stream opens.
   */
  async refresh(): Promise<void> {
    const reads = [this.refreshStatus()];
    if (this.layout === Layout.Lyrics) reads.push(this.lyrics.load(true));
    if (this.layout === Layout.History) reads.push(this.loadVersions());
    await Promise.allSettled(reads);
  }

  songs(): Promise<SongsResponse> {
    return this.api.getSongs();
  }

  /** Saves the lyrics waiting to be saved, then switches Ode to another song and reads its title, lyrics or history. Throws when it fails. */
  async openSong(id: string): Promise<void> {
    await this.lyrics.flush();
    await this.api.openSong(id);
    await this.refresh();
  }

  /** Saves the lyrics waiting to be saved, then starts a new song and switches to it. Throws when it fails. */
  async createSong(title: string): Promise<void> {
    await this.lyrics.flush();
    await this.api.createSong(title);
    await this.refresh();
  }

  /** Saves the lyrics waiting to be saved, then closes the dialog back to Live. */
  async close(): Promise<void> {
    await this.lyrics.flush();
    LiveDialog.close(DialogResult.Done);
  }

  async refreshStatus(): Promise<void> {
    this.store.setStatus(await this.api.getStatus());
  }

  async loadVersions(): Promise<void> {
    try {
      this.store.setVersions(await this.api.getVersions());
    } catch (error) {
      this.store.setHistoryError(`The history couldn't be read: ${errorMessage(error)}`);
    }
  }

  /** Sends a typed line or a tapped suggestion; Ode answers with a result line. */
  async send(text: string): Promise<void> {
    const request = text.trim();
    if (!request) return;
    this.store.startRequest();
    await this.lyrics.flush();
    try {
      await this.api.chat({ text: request });
    } catch (error) {
      this.store.setError(`Ode didn't get that: ${errorMessage(error)}`);
    }
  }

  tap(suggestion: Suggestion): Promise<void> {
    return this.send(suggestion.request);
  }

  /** Asks why Ode made the change with this version; the short answer goes under its result line. */
  async askWhy(versionId: string): Promise<void> {
    this.store.startRequest();
    await this.lyrics.flush();
    try {
      await this.api.why({ versionId });
    } catch (error) {
      this.store.setError(`Ode couldn't answer: ${errorMessage(error)}`);
    }
  }

  /** Another take of the change with this version, in place. */
  async again(versionId: string): Promise<void> {
    this.store.startRequest();
    await this.lyrics.flush();
    try {
      await this.api.again({ versionId });
    } catch (error) {
      this.store.setError(`Ode couldn't try again: ${errorMessage(error)}`);
    }
  }

  /** Back to the version before the change with this version; the server's result line says how it went. */
  async undo(versionId: string): Promise<void> {
    if (this.undoing) return;
    this.undoing = true;
    this.store.startRequest();
    try {
      const outcome = await this.api.undo({ versionId });
      if (!outcome.restored) this.store.setError(refusal("Couldn't undo", outcome));
    } catch (error) {
      this.store.setError(`Couldn't undo: ${errorMessage(error)}`);
    } finally {
      this.undoing = false;
    }
  }

  async stopRequest(): Promise<void> {
    try {
      await this.api.stop();
    } catch (error) {
      this.store.setError(`Ode couldn't stop: ${errorMessage(error)}`);
    }
  }

  async answer(questionId: string, choice: string): Promise<void> {
    this.store.setQuestionAnswered(questionId, true);
    try {
      await this.api.answer(questionId, { choice });
    } catch (error) {
      this.store.setQuestionAnswered(questionId, false);
      this.store.setError(`Your answer didn't reach Ode: ${errorMessage(error)}`);
    }
  }

  /** Apply ("allow") or Skip ("deny") a change Ode wants to make. */
  async decide(approvalId: string, decision: Decision): Promise<void> {
    this.store.setApprovalDecided(approvalId, true);
    try {
      await this.api.decide(approvalId, { decision });
    } catch (error) {
      this.store.setApprovalDecided(approvalId, false);
      this.store.setError(`Your choice didn't reach Ode: ${errorMessage(error)}`);
    }
  }

  async setMode(mode: Mode): Promise<void> {
    const previous = this.store.getSnapshot().mode;
    this.store.setMode(mode);
    try {
      this.store.setMode((await this.api.setMode({ mode })).mode);
    } catch (error) {
      this.store.setMode(previous);
      this.store.setError(`The mode didn't change: ${errorMessage(error)}`);
    }
  }

  /** Restores a version the musician confirmed; the versions after it are deleted. Throws when it fails. */
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
    this.store.apply(event);
    if (event.type === "lyrics" && this.layout === Layout.Lyrics) this.lyrics.receive(event.lyrics);
    // Another song is in use: its lyrics and history replace these.
    if (event.type === "title") void this.refresh();
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

/** "Couldn't undo: You have changed the Set since…", from the reasons the server gave. */
function refusal(what: string, outcome: RestoreResult): string {
  const reasons = outcome.skipped.join("; ");
  return reasons ? `${what}: ${reasons}` : `${what}.`;
}
