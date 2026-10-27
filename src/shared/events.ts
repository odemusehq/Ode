import type { LeadSheet } from "./song";
import type { LivePointer, LiveStatus } from "./live";

/** Events the local server streams to the UI over server-sent events. */
export type UiEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "started" | "done" | "error"; summary?: string }
  | { type: "subagent"; id: string; task: string; status: "started" | "done" }
  | { type: "approval"; id: string; tool: string; summary: string; input: unknown }
  | { type: "approval-resolved"; id: string; decision: "allow" | "deny" }
  | { type: "busy"; busy: boolean }
  | { type: "done"; costUsd?: number }
  | { type: "error"; message: string }
  | { type: "live-status"; status: LiveStatus }
  | { type: "song"; leadSheet: LeadSheet }
  | { type: "pointer"; pointer: LivePointer }
  /** Levels as Live draws its meters, 0 to 1 (not decibels). */
  | { type: "meters"; tracks: { name: string; level: number }[]; master?: { level: number } };
