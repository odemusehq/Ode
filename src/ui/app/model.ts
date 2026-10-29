import type { ApprovalRequest } from "../../shared/api";
import type { ResultKind, Suggestion } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import type { VersionListItem } from "../../shared/versions";

export enum StreamState {
  /** First connection, still opening. */
  Connecting = "connecting",
  Open = "open",
  /** The connection was lost; trying again. */
  Reconnecting = "reconnecting",
  Closed = "closed",
}

export type Decision = ApprovalRequest["decision"];

/** A one-line question from Ode with two to four answers. */
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** Release files shown as the answers, one per option; empty for answers in words. */
  images: string[];
  /** The musician answered and the answer is still on its way to Ode. */
  answered: boolean;
}

/** A change Ode wants to make, waiting for Apply or Skip. */
export interface Approval {
  id: string;
  summary: string;
  /** The musician decided and the decision is still on its way to Ode. */
  decided: boolean;
}

/** What Ode last did, in one line. */
export interface ResultLine {
  text: string;
  /** The version the line is about; null when the Set stayed the same. */
  versionId: string | null;
  kind: ResultKind;
  /** The musician changed the Set since, so Undo, Again and Why? are out of date for it. */
  overtaken: boolean;
}

/** One step of Ode's work, as the working view lists it. */
export interface Step {
  id: string;
  /** In the musician's words: "Writing a bass line for Verse 1". */
  label: string;
  status: "running" | "done" | "error";
}

/** Ode's short answer to Why? about one of its changes. */
export interface WhyAnswer {
  versionId: string;
  text: string;
}

export interface AppState {
  stream: StreamState;
  busy: boolean;
  /** Stop can interrupt what Ode is doing now. */
  stoppable: boolean;
  /** Null until the server says which mode Ode is in. */
  mode: Mode | null;
  /** The song's title. */
  title: string;
  /** History groups consecutive versions by the same author within this many minutes; null until known. */
  versionGroupMinutes: number | null;
  /** The line the chosen model's licence asks Ode to show. */
  credit: string | null;
  /** What the musician selected or pointed at in Live, in words; null means the whole song. */
  focus: string | null;
  /** One-tap actions for what is selected, fixes first. */
  suggestions: readonly Suggestion[];
  /** The latest progress line while Ode works. */
  progress: string | null;
  /** Ode's latest note about its next step, while it works. */
  thought: string | null;
  /** The steps of the latest request, in order. */
  steps: readonly Step[];
  result: ResultLine | null;
  answer: WhyAnswer | null;
  /** One line saying what went wrong. */
  error: string | null;
  questions: readonly Question[];
  approvals: readonly Approval[];
  /** The version history, newest first; null until it has been read. */
  versions: readonly VersionListItem[] | null;
  /** Why reading the history stopped. */
  historyError: string | null;
}

export function initialState(): AppState {
  return {
    stream: StreamState.Connecting,
    busy: false,
    stoppable: false,
    mode: null,
    title: "",
    versionGroupMinutes: null,
    credit: null,
    focus: null,
    suggestions: [],
    progress: null,
    thought: null,
    steps: [],
    result: null,
    answer: null,
    error: null,
    questions: [],
    approvals: [],
    versions: null,
    historyError: null,
  };
}
