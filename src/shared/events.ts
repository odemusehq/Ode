import type { LeadSheet } from "./song";
import type { LivePointer, LiveStatus } from "./live";

/** Events the local server streams to the UI over server-sent events. */
export type UiEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "started" | "done" | "error"; summary?: string }
  | { type: "helper"; id: string; task: string; status: "started" | "done" }
  | { type: "approval"; id: string; tool: string; summary: string; input: unknown }
  | { type: "approval-resolved"; id: string; decision: "allow" | "deny" }
  | { type: "busy"; busy: boolean }
  | { type: "done"; costUsd?: number }
  | { type: "error"; message: string }
  | { type: "live-status"; status: LiveStatus }
  | { type: "song"; leadSheet: LeadSheet }
  | { type: "pointer"; pointer: LivePointer }
  | { type: "meters"; tracks: { name: string; peak: number }[]; master?: { peak: number } };
