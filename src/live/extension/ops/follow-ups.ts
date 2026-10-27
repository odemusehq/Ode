import type { Live } from "../sdk";
import type { FollowUps } from "./operation";

/** For one operation: its follow-up changes run, as one undo step, as soon as Live has created the object. */
export class DirectFollowUps implements FollowUps {
  constructor(private readonly live: Live) {}

  async after<T, R>(started: Promise<T>, apply: (value: T) => R): Promise<R> {
    const value = await started;
    return this.live.withinTransaction(() => apply(value));
  }
}

interface Waiting {
  readonly started: Promise<unknown>;
  finish(value: unknown): void;
  fail(error: unknown): void;
}

/**
 * For operations started together: their follow-up changes wait until every object exists, then
 * run together as one undo step. Call flush() once every operation has started.
 */
export class GroupedFollowUps implements FollowUps {
  private readonly waiting: Waiting[] = [];
  private flushed = false;

  constructor(private readonly live: Live) {}

  after<T, R>(started: Promise<T>, apply: (value: T) => R): Promise<R> {
    if (this.flushed) return new DirectFollowUps(this.live).after(started, apply);
    return new Promise<R>((resolve, reject) => {
      this.waiting.push({ started, finish: (value) => resolve(apply(value as T)), fail: reject });
    });
  }

  async flush(): Promise<void> {
    this.flushed = true;
    const waiting = this.waiting.splice(0);
    if (waiting.length === 0) return;
    const outcomes = await Promise.allSettled(waiting.map((entry) => entry.started));
    this.live.withinTransaction(() => {
      waiting.forEach((entry, index) => GroupedFollowUps.settle(entry, outcomes[index]));
    });
  }

  private static settle(entry: Waiting, outcome: PromiseSettledResult<unknown> | undefined): void {
    try {
      if (outcome?.status === "fulfilled") entry.finish(outcome.value);
      else entry.fail(outcome?.reason);
    } catch (error) {
      entry.fail(error);
    }
  }
}
