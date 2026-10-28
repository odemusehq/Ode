import type { ApprovalRequest } from "../../shared/api";
import type { Suggestion, UiEvent } from "../../shared/events";
import type { LiveStatus } from "../../shared/live";
import type { Mode } from "../../shared/personalisation";
import type { LeadSheet } from "../../shared/song";
import type { VersionListItem } from "../../shared/versions";
import { ViewId } from "./views";

export enum StreamState {
  /** First connection, not open yet. */
  Connecting = "connecting",
  Open = "open",
  /** The connection was lost; trying again. */
  Reconnecting = "reconnecting",
  Closed = "closed",
}

export type MeterReadings = Omit<Extract<UiEvent, { type: "meters" }>, "type">;
export type Decision = ApprovalRequest["decision"];

/** A one-line question from Ode with two to four answers. */
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** The musician answered and Ode hasn't taken the answer yet. */
  answered: boolean;
}

/** Manual mode: a change Ode wants to make, waiting for Apply or Skip. */
export interface Approval {
  id: string;
  summary: string;
  /** The musician decided and Ode hasn't taken the decision yet. */
  decided: boolean;
}

/** What Ode last did, in one line. */
export interface ResultLine {
  text: string;
  /** The version Ode's change made; null when the Set didn't change, or after Undo. */
  versionId: string | null;
  /** The line says how Undo went, not what Ode did. */
  undone: boolean;
}

export enum WhyStatus {
  Asking = "asking",
  Answered = "answered",
}

/** The short answer to "Why?", shown under the result line. */
export interface WhyAnswer {
  status: WhyStatus;
  text: string;
}

export interface AppState {
  view: ViewId;
  stream: StreamState;
  busy: boolean;
  /** Null until the server says which mode Ode is in. */
  mode: Mode | null;
  /** History groups consecutive versions by the same author within this many minutes; null until known. */
  versionGroupMinutes: number | null;
  live: LiveStatus | null;
  projectDir: string | null;
  song: LeadSheet | null;
  /** What the musician selected or pointed at in Live, in words; null means the whole song. */
  focus: string | null;
  /** One-tap actions for what is selected, fixes first. */
  suggestions: readonly Suggestion[];
  /** The latest progress line while Ode works. */
  progress: string | null;
  result: ResultLine | null;
  why: WhyAnswer | null;
  /** One line saying what went wrong. */
  error: string | null;
  questions: readonly Question[];
  approvals: readonly Approval[];
  /** The version history, newest first; null until History has read it. */
  versions: readonly VersionListItem[] | null;
  /** Counts the versions the server announced, so a view can read again what a new version may have changed. */
  versionStamp: number;
  meters: MeterReadings | null;
}

export function initialState(): AppState {
  return {
    view: ViewId.History,
    stream: StreamState.Connecting,
    busy: false,
    mode: null,
    versionGroupMinutes: null,
    live: null,
    projectDir: null,
    song: null,
    focus: null,
    suggestions: [],
    progress: null,
    result: null,
    why: null,
    error: null,
    questions: [],
    approvals: [],
    versions: null,
    versionStamp: 0,
    meters: null,
  };
}
