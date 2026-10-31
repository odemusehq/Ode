import type { ApprovalRequest } from "../../shared/api";
import type { ConversationExchange, ResultKind } from "../../shared/events";
import type { Mode } from "../../shared/personalisation";
import type { VersionListItem } from "../../shared/versions";
import { Layout } from "./layout";
import type { SidebarView } from "./layout";

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
  /** A brief public purpose recorded with this action, when available. */
  reason?: string;
}

/** Ode's short answer to Why? about one of its changes. */
export interface WhyAnswer {
  versionId: string;
  text: string;
}

export interface AppState {
  songId: string | null;
  exchanges: readonly ConversationExchange[];
  /** A panel is open beside the chat; hiding it keeps the selected panel. */
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  stream: StreamState;
  busy: boolean;
  /** Stop can interrupt what Ode is doing now. */
  stoppable: boolean;
  /** The configured transcription service is available; no provider request is made to check it. */
  dictationReady: boolean;
  /** Null until the server says which mode Ode is in. */
  mode: Mode | null;
  /** The song's title. */
  title: string;
  /** History groups consecutive versions by the same author within this many minutes; null until known. */
  versionGroupMinutes: number | null;
  /** The line the chosen model's licence asks Ode to show. */
  credit: string | null;
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
    songId: null,
    exchanges: [],
    sidebarOpen: false,
    sidebarView: Layout.Lyrics,
    stream: StreamState.Connecting,
    busy: false,
    stoppable: false,
    dictationReady: false,
    mode: null,
    title: "",
    versionGroupMinutes: null,
    credit: null,
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
