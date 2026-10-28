import { API } from "../../shared/api";
import type { CopyResult, RestoreResult } from "../../shared/api";
import type { Suggestion, UiEvent } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import type { LeadSheet } from "../../shared/song";
import { OdeApi, errorMessage } from "./api";
import { UI_CONFIG } from "./config";
import { Debouncer } from "./debounce";
import { EventStream } from "./events";
import type { Decision } from "./model";
import { REQUESTS } from "./requests";
import { Store } from "./state";
import { ViewId } from "./views";

/** Ode as the UI sees it: the server's API, its event stream and the state they feed. */
export class OdeClient {
  readonly store = new Store();
  readonly api = new OdeApi();
  private readonly stream: EventStream;
  private readonly suggestionsLater = new Debouncer(UI_CONFIG.suggestionsDelayMs);
  /** An Undo is on its way; a second press doesn't go back a second version. */
  private undoing = false;

  constructor() {
    this.stream = new EventStream(API.events, {
      onEvent: (event) => this.receive(event),
      onState: (state) => this.store.setStream(state),
      onOpen: () => void this.refresh(),
    });
  }

  start(): void {
    this.stream.start();
  }

  stop(): void {
    this.suggestionsLater.cancel();
    this.stream.stop();
  }

  /**
   * Reads again what events may have missed: the status, the lead sheet and the suggestions, and the versions
   * when History is showing them (History reads them itself when it opens).
   */
  async refresh(): Promise<void> {
    const { view, versions } = this.store.getSnapshot();
    const reads = [this.refreshStatus(), this.refreshSong(), this.loadSuggestions()];
    if (view === ViewId.History && versions !== null) reads.push(this.loadVersions());
    await Promise.allSettled(reads);
  }

  async refreshStatus(): Promise<void> {
    this.store.setStatus(await this.api.getStatus());
  }

  async refreshSong(): Promise<void> {
    this.store.setSong(await this.api.getSong());
  }

  async loadSuggestions(): Promise<void> {
    this.store.setSuggestions(await this.api.getSuggestions());
  }

  async loadVersions(): Promise<void> {
    this.store.setVersions(await this.api.getVersions());
  }

  /** Sends a typed line or a request from a button; Ode answers with a result line. */
  async send(text: string): Promise<void> {
    const request = text.trim();
    if (!request) return;
    this.store.startRequest();
    try {
      await this.api.chat({ text: request });
    } catch (error) {
      this.store.setError(`Ode didn't get that: ${errorMessage(error)}`);
    }
  }

  tap(suggestion: Suggestion): Promise<void> {
    return this.send(suggestion.request);
  }

  hum(): Promise<void> {
    return this.send(REQUESTS.hum);
  }

  /** Sends what the musician said; the server writes it down and sends it to Ode. Returns the words, or null. */
  async sendSpeech(wav: Blob): Promise<string | null> {
    this.store.startRequest();
    try {
      return (await this.api.speech(wav)).text;
    } catch (error) {
      this.store.setError(`Ode didn't get what you said: ${errorMessage(error)}`);
      return null;
    }
  }

  /** Asks Ode why it made its last change; the short answer goes under the result line. */
  async askWhy(): Promise<void> {
    this.store.askWhy();
    try {
      await this.api.chat({ text: REQUESTS.why });
    } catch (error) {
      this.store.cancelWhy();
      this.store.setError(`Ode didn't get that: ${errorMessage(error)}`);
    }
  }

  async stopRequest(): Promise<void> {
    try {
      await this.api.stop();
    } catch (error) {
      this.store.setError(`Ode couldn't stop: ${errorMessage(error)}`);
    }
  }

  /** Back to the version before Ode's last change, without asking. */
  async undo(): Promise<void> {
    if (this.undoing) return;
    this.undoing = true;
    try {
      this.store.setResult({ text: undoLine(await this.api.undo()), versionId: null, undone: true });
      this.refreshSuggestionsSoon();
    } catch (error) {
      this.store.setError(`Undo didn't work: ${errorMessage(error)}`);
    } finally {
      this.undoing = false;
    }
  }

  /** Another take of Ode's last change, in place. */
  async again(): Promise<void> {
    this.store.startRequest();
    try {
      await this.api.again();
    } catch (error) {
      this.store.setError(`Ode couldn't try again: ${errorMessage(error)}`);
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

  /** Manual mode: Apply ("allow") or Skip ("deny") a change Ode wants to make. */
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
    await this.loadVersions().catch(() => undefined);
    return outcome;
  }

  /** Throws when it fails. */
  async nameVersion(id: string, name: string): Promise<void> {
    this.store.putVersion(await this.api.nameVersion(id, { name }));
  }

  /** Copies the project folder; opening the copy in Live brings it to this version. Throws when it fails. */
  copyVersion(id: string): Promise<CopyResult> {
    return this.api.copyVersion(id);
  }

  async saveSong(leadSheet: LeadSheet): Promise<LeadSheet> {
    const saved = await this.api.saveSong(leadSheet);
    this.store.setSong(saved);
    return saved;
  }

  private receive(event: UiEvent): void {
    this.store.apply(event);
    const setChanged = event.type === "result" && event.versionId !== null;
    if (event.type === "selection" || setChanged) this.refreshSuggestionsSoon();
  }

  /** The selection or the Set changed: ask for suggestions once things settle. */
  private refreshSuggestionsSoon(): void {
    this.suggestionsLater.schedule(() => void this.loadSuggestions().catch(() => undefined));
  }
}

/** The result line after Undo, with anything that couldn't be put back. */
function undoLine(outcome: RestoreResult): string {
  const skipped = outcome.skipped.join("; ");
  if (outcome.restored) return skipped ? `Undone, except: ${skipped}` : "Undone.";
  return skipped ? `Couldn't undo: ${skipped}` : "Nothing to undo.";
}
