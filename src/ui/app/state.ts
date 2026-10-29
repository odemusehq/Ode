import type { StatusResponse } from "../../shared/api";
import type { UiEvent } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import type { VersionListItem } from "../../shared/versions";
import { StreamState, initialState } from "./model";
import type { AppState } from "./model";
import { finishWork, reduceEvent } from "./reducer";

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

  /** While the stream is down nothing says Ode is working; the server says it again when the stream opens. */
  setStream(stream: StreamState): void {
    if (stream === this.state.stream) return;
    const lost = stream === StreamState.Reconnecting || stream === StreamState.Closed;
    this.update(lost ? { ...finishWork(this.state), stream } : { ...this.state, stream });
  }

  /** The stream opened: the server sends the questions and changes still waiting, so the old cards go. */
  streamOpened(): void {
    this.update({ ...this.state, questions: [], approvals: [] });
  }

  setStatus(status: StatusResponse): void {
    this.update({
      ...this.state,
      busy: status.busy,
      stoppable: status.busy && status.stoppable,
      progress: status.busy ? this.state.progress : null,
      mode: status.mode,
      title: status.title,
      versionGroupMinutes: status.versionGroupMinutes,
      credit: status.credit,
    });
  }

  setMode(mode: Mode | null): void {
    if (mode !== this.state.mode) this.update({ ...this.state, mode });
  }

  setVersions(versions: readonly VersionListItem[]): void {
    this.update({ ...this.state, versions, historyError: null });
  }

  setHistoryError(message: string): void {
    this.update({ ...this.state, historyError: message });
  }

  /** A version the server answered with, as if it had arrived as an event. */
  putVersion(version: VersionListItem): void {
    this.apply({ type: "version", version });
  }

  /** A request is on its way: an old error no longer applies. */
  startRequest(): void {
    this.setError(null);
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
