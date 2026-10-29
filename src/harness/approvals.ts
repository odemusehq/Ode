import { randomUUID } from "node:crypto";
import type { UiEvent } from "../shared/events";

export enum Decision {
  Allow = "allow",
  Deny = "deny",
}

interface WaitingApproval {
  tool: string;
  summary: string;
  input: unknown;
  resolve: (decision: Decision) => void;
}

export interface ApprovalView {
  id: string;
  tool: string;
  summary: string;
  input: unknown;
}

/**
 * Changes waiting for the musician's Apply or Skip: every change in Manual mode, and in every mode consent for the
 * singer's voice and deleting what lies beyond Undo's reach.
 */
export class Approvals {
  private readonly waiting = new Map<string, WaitingApproval>();

  constructor(private readonly emit: (event: UiEvent) => void) {}

  request(tool: string, input: unknown, summary: string, signal: AbortSignal): Promise<Decision> {
    // Stop pressed before the change came up: it is skipped, and its card stays away.
    if (signal.aborted) return Promise.resolve(Decision.Deny);
    const id = randomUUID();
    return new Promise<Decision>((resolve) => {
      this.waiting.set(id, { tool, summary, input, resolve });
      signal.addEventListener("abort", () => this.settle(id, Decision.Deny), { once: true });
      this.emit({ type: "approval", id, tool, summary, input });
    });
  }

  decide(id: string, decision: Decision): boolean {
    if (!this.waiting.has(id)) return false;
    this.settle(id, decision);
    return true;
  }

  pending(): ApprovalView[] {
    return [...this.waiting].map(([id, { tool, summary, input }]) => ({ id, tool, summary, input }));
  }

  denyAll(): void {
    for (const id of [...this.waiting.keys()]) this.settle(id, Decision.Deny);
  }

  private settle(id: string, decision: Decision): void {
    const approval = this.waiting.get(id);
    if (!approval) return;
    this.waiting.delete(id);
    approval.resolve(decision);
    this.emit({ type: "approval-resolved", id, decision });
  }
}
