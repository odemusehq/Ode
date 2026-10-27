import type { LivePointer } from "../shared/live";

/** What the musician last pointed at with "Ask Ode" in Live. */
export class PointerState {
  private pointer: LivePointer | null = null;

  get current(): LivePointer | null {
    return this.pointer;
  }

  set(pointer: LivePointer): void {
    this.pointer = pointer;
  }
}
