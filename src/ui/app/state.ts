import type { StatusResponse } from "../../shared/api";
import type { UiEvent } from "../../shared/events";
import type { LeadSheet } from "../../shared/song";
import type { ApprovalStatus } from "../../ui-kit";
import { initialState } from "./model";
import type { AppState, StreamState } from "./model";
import { addError, addUserMessage, reduceEvent, setApprovalStatus } from "./reducer";
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
    this.update({ ...this.state, live: status.live, busy: status.busy, projectDir: status.projectDir });
  }

  setSong(song: LeadSheet): void {
    this.update({ ...this.state, song });
  }

  addLocalMessage(text: string): void {
    this.update(addUserMessage(this.state, text));
  }

  addError(message: string): void {
    this.update(addError(this.state, message));
  }

  setApprovalStatus(id: string, status: ApprovalStatus): void {
    this.update(setApprovalStatus(this.state, id, status));
  }

  private update(next: AppState): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
