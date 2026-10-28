import type { LeadSheet } from "./song";
import type { LivePointer, LiveStatus } from "./live";
import type { SelectionInfo } from "./live-ops";
import type { Mode } from "./personalisation";
import type { VersionListItem } from "./versions";

export interface Suggestion {
  id: string;
  label: string;
  /** What Ode is asked when the musician taps it. */
  request: string;
  /** A fix for a problem a check found; fixes come first. */
  fix: boolean;
}

/** Events the local server streams to the UI over server-sent events. */
export type UiEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "started" | "done" | "error"; summary?: string }
  | { type: "subagent"; id: string; task: string; status: "started" | "done" }
  /** Manual mode: a change waiting for Apply or Skip. */
  | { type: "approval"; id: string; tool: string; summary: string; input: unknown }
  | { type: "approval-resolved"; id: string; decision: "allow" | "deny" }
  | { type: "busy"; busy: boolean }
  /** One line of progress while Ode works. */
  | { type: "progress"; text: string }
  /** Ode's one-line result; versionId is the version it made, null when the Set didn't change. */
  | { type: "result"; text: string; versionId: string | null }
  /** A one-line question with two to four answers. */
  | { type: "question"; id: string; text: string; options: string[] }
  | { type: "question-resolved"; id: string; choice: string | null }
  /** What the musician has selected in Live, in words: "Bass · clip Bass A · bars 9–16". */
  | { type: "selection"; selection: SelectionInfo; label: string }
  | { type: "suggestions"; items: Suggestion[] }
  | { type: "version"; version: VersionListItem }
  /** A restore deleted every version after this one. */
  | { type: "versions-truncated"; afterId: string }
  | { type: "mode"; mode: Mode }
  | { type: "done"; costUsd?: number }
  | { type: "error"; message: string }
  | { type: "live-status"; status: LiveStatus }
  | { type: "song"; leadSheet: LeadSheet }
  | { type: "pointer"; pointer: LivePointer }
  /** Levels as Live draws its meters, 0 to 1 (not decibels). */
  | { type: "meters"; tracks: { name: string; level: number }[]; master?: { level: number } };
