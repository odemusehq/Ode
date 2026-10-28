import type { StatusResponse } from "../../shared/api";
import type { Suggestion, UiEvent } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import type { LeadSheet } from "../../shared/song";
import type { VersionListItem } from "../../shared/versions";
import { WhyStatus, initialState } from "./model";
import type { AppState, ResultLine, StreamState } from "./model";
import { fixesFirst, reduceEvent, upsertVersion } from "./reducer";
import type { ViewId } from "./views";

/** Holds the app state and tells subscribers when it changes; read it with useSyncExternalStore. */
export class Store {
  private state: AppState = initialState();
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): AppState => this.state;

  apply(event: UiEvent): void {
    this.update(reduceEvent(this.state, event));
  }

  setView(view: ViewId): void {
    if (view !== this.state.view) this.update({ ...this.state, view });
  }

  setStream(stream: StreamState): void {
    if (stream !== this.state.stream) this.update({ ...this.state, stream });
  }

  setStatus(status: StatusResponse): void {
    this.update({
      ...this.state,
      live: status.live,
      busy: status.busy,
      projectDir: status.projectDir,
      mode: status.mode,
      versionGroupMinutes: status.versionGroupMinutes,
    });
  }

  setSong(song: LeadSheet): void {
    this.update({ ...this.state, song });
  }

  setMode(mode: Mode | null): void {
    if (mode !== this.state.mode) this.update({ ...this.state, mode });
  }

  setSuggestions(items: readonly Suggestion[]): void {
    this.update({ ...this.state, suggestions: fixesFirst(items) });
  }

  setVersions(versions: readonly VersionListItem[]): void {
    this.update({ ...this.state, versions });
  }

  putVersion(version: VersionListItem): void {
    const { versions } = this.state;
    if (versions) this.update({ ...this.state, versions: upsertVersion(versions, version) });
  }

  /** A request is on its way: an old error and an old "Why?" answer no longer apply. */
  startRequest(): void {
    this.update({ ...this.state, error: null, why: null });
  }

  askWhy(): void {
    this.update({ ...this.state, error: null, why: { status: WhyStatus.Asking, text: "" } });
  }

  cancelWhy(): void {
    this.update({ ...this.state, why: null });
  }

  setResult(result: ResultLine): void {
    this.update({ ...this.state, result, why: null });
  }

  setError(message: string | null): void {
    if (message !== this.state.error) this.update({ ...this.state, error: message });
  }

  setQuestionAnswered(id: string, answered: boolean): void {
    const questions = this.state.questions.map((question) => (question.id === id ? { ...question, answered } : question));
    this.update({ ...this.state, questions });
  }

  setApprovalDecided(id: string, decided: boolean): void {
    const approvals = this.state.approvals.map((approval) => (approval.id === id ? { ...approval, decided } : approval));
    this.update({ ...this.state, approvals });
  }

  private update(next: AppState): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
