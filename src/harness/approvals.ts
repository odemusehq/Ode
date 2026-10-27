import { randomUUID } from "node:crypto";
import type { UiEvent } from "../shared/events";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongStore } from "../mneme/song-store";

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

/** Changes waiting for the musician's approval, and the record of what they decided. */
export class Approvals {
  private readonly waiting = new Map<string, WaitingApproval>();

  constructor(
    private readonly emit: (event: UiEvent) => void,
    private readonly prefs: PreferencesStore,
    private readonly song: SongStore,
  ) {}

  async request(tool: string, input: unknown, summary: string, signal: AbortSignal): Promise<Decision> {
    if (await this.prefs.isAllowed(tool)) return Decision.Allow;
    const id = randomUUID();
    const decision = await new Promise<Decision>((resolve) => {
      this.waiting.set(id, { tool, summary, input, resolve });
      signal.addEventListener("abort", () => this.settle(id, Decision.Deny), { once: true });
      this.emit({ type: "approval", id, tool, summary, input });
    });
    await this.song.appendHistory({ kind: decision === Decision.Allow ? "kept" : "rejected", what: summary, detail: { tool, input } });
    return decision;
  }

  async decide(id: string, decision: Decision, always = false): Promise<boolean> {
    const approval = this.waiting.get(id);
    if (!approval) return false;
    if (always && decision === Decision.Allow) await this.prefs.allow(approval.tool);
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
