/** Lets a fixed number of tasks run at once; the others wait their turn in order. */
export class Semaphore {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly size: number) {}

  async use<T>(task: () => Promise<T>): Promise<T> {
    if (this.running < this.size) this.running++;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await task();
    } finally {
      // A finished task hands its place straight to the next one waiting.
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    }
  }
}
