import type { UiEvent } from "../shared/events";

export type UiListener = (event: UiEvent) => void;

/** Fans events out to every connected UI. */
export class EventBus {
  private readonly listeners = new Set<UiListener>();

  subscribe(listener: UiListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit = (event: UiEvent): void => {
    for (const listener of this.listeners) listener(event);
  };
}
