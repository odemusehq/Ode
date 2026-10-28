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

/** Changes waiting for the musician's Apply or Skip (Manual mode, and consent for the singer's voice in every mode). */
export class Approvals {
  private readonly waiting = new Map<string, WaitingApproval>();

  constructor(private readonly emit: (event: UiEvent) => void) {}

  request(tool: string, input: unknown, summary: string, signal: AbortSignal): Promise<Decision> {
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
