import type { LiveRequest, LiveResponse } from "../../../shared/live";
import type { Live } from "../sdk";
import { GroupedFollowUps } from "./follow-ups";
import { OperationKind, type FollowUps } from "./operation";
import { OperationRegistry } from "./registry";

/**
 * The changes Ode queued while the extension was not connected, applied in order when the
 * musician picks "Ode: Apply changes". Consecutive changes share one transaction; a change that
 * creates or deletes something closes it, so the changes after it can find what it made.
 */
export class QueuedChanges {
  constructor(
    private readonly live: Live,
    private readonly registry: OperationRegistry,
  ) {}

  async apply(requests: readonly LiveRequest[], progress: (applied: number) => Promise<void>): Promise<LiveResponse[]> {
    const responses: LiveResponse[] = [];
    for (const group of this.groups(requests)) {
      responses.push(...(await this.applyGroup(group)));
      await progress(responses.length);
    }
    return responses;
  }

  private groups(requests: readonly LiveRequest[]): LiveRequest[][] {
    const groups: LiveRequest[][] = [];
    let group: LiveRequest[] = [];
    for (const request of requests) {
      group.push(request);
      if (this.registry.kindOf(request.op) === OperationKind.Structure) {
        groups.push(group);
        group = [];
      }
    }
    if (group.length > 0) groups.push(group);
    return groups;
  }

  private async applyGroup(group: readonly LiveRequest[]): Promise<LiveResponse[]> {
    const followUps = new GroupedFollowUps(this.live);
    const responses = this.live.withinTransaction(() =>
      Promise.all(group.map((request) => OperationRegistry.response(request.id, this.start(request, followUps)))),
    );
    await followUps.flush();
    return responses;
  }

  private start(request: LiveRequest, followUps: FollowUps): Promise<unknown> {
    try {
      return this.registry.prepare(request.op, request.args, followUps).run();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
