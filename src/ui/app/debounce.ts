/** Runs the latest scheduled task once nothing new has been scheduled for a while. */
export class Debouncer {
  private readonly delayMs: number;
  private timer: number | undefined;
  private task: (() => void) | null = null;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  schedule(task: () => void): void {
    this.cancel();
    this.task = task;
    this.timer = window.setTimeout(() => this.flush(), this.delayMs);
  }

  /** Runs the waiting task now, if there is one. */
  flush(): void {
    const task = this.task;
    this.cancel();
    task?.();
  }

  cancel(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.task = null;
  }
}
