import type { LivePointer } from "../shared/live";

/** The last explicit right-click target, supplied to Ode alongside fresh Set context and the conversation. */
export class SelectionState {
  private pointedAt: LivePointer | null = null;

  get pointer(): LivePointer | null {
    return this.pointedAt;
  }

  point(pointer: LivePointer | null): void {
    this.pointedAt = pointer;
  }
}
