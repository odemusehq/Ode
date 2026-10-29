import type { SelectionInfo } from "./live-ops";
import type { LyricsState } from "./lyrics";
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

/** What a result line is about; it decides which actions the line offers. */
export enum ResultKind {
  /** Ode changed the Set or the lyrics: Undo, Again and Why? apply. */
  Change = "change",
  /** Ode was stopped part-way; what it had changed is saved as a version, so Undo applies. */
  Stopped = "stopped",
  /** Ode answered without changing anything. */
  Reply = "reply",
  Undo = "undo",
  Restore = "restore",
}

/** Events the local server streams to the UI over server-sent events. */
export type UiEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "tool"; id: string; name: string; status: "started" | "done" | "error"; summary?: string }
  | { type: "subagent"; id: string; task: string; status: "started" | "done" }
  /** Manual mode, or a change beyond Undo's reach: waiting for Apply or Skip. */
  | { type: "approval"; id: string; tool: string; summary: string; input: unknown }
  | { type: "approval-resolved"; id: string; decision: "allow" | "deny" }
  /** stoppable is false for work that runs to the end once started (Undo, a restore, putting the Set back for Again). */
  | { type: "busy"; busy: boolean; stoppable: boolean }
  /** One line of progress while Ode works. */
  | { type: "progress"; text: string }
  /** One line about what just happened; versionId is the version it made, null when the Set stayed the same. */
  | { type: "result"; text: string; versionId: string | null; kind: ResultKind }
  /** The answer to Why? about the change with this version id. */
  | { type: "answer"; versionId: string; text: string }
  /** A one-line question with two to four answers; images, when given, are release files shown as the answers. */
  | { type: "question"; id: string; text: string; options: string[]; images?: string[] }
  | { type: "question-resolved"; id: string; choice: string | null }
  /** What the musician has selected in Live, in words: "Bass · clip Bass A · bars 9–16". */
  | { type: "selection"; selection: SelectionInfo; label: string }
  | { type: "suggestions"; items: Suggestion[] }
  | { type: "version"; version: VersionListItem }
  /** A restore deleted every version after this one. */
  | { type: "versions-truncated"; afterId: string }
  | { type: "mode"; mode: Mode }
  /** Ode's short note about its next step, written before it calls tools. */
  | { type: "thought"; text: string }
  /** A request finished; tokens is what its model calls used. */
  | { type: "done"; tokens?: number }
  | { type: "error"; message: string }
  /** The shared lyrics changed: saved from the window, by Ode, or by a restore. */
  | { type: "lyrics"; lyrics: LyricsState }
  /** The song's title, when it changes or another song opens. */
  | { type: "title"; title: string };
