import type { ApprovalRequest } from "../../shared/api";
import type { UiEvent } from "../../shared/events";
import type { LivePointer, LiveStatus } from "../../shared/live";
import type { LeadSheet } from "../../shared/song";
import type { ApprovalStatus, ChatRole } from "../../ui-kit";
import { ViewId } from "./views";

export enum StreamState {
  /** First connection, not open yet. */
  Connecting = "connecting",
  Open = "open",
  /** The connection was lost; trying again. */
  Reconnecting = "reconnecting",
  Closed = "closed",
}

export enum ChatEntryKind {
  Message = "message",
  Tool = "tool",
  Subagent = "subagent",
  Approval = "approval",
  Error = "error",
}

export type ToolEvent = Extract<UiEvent, { type: "tool" }>;
export type SubagentEvent = Extract<UiEvent, { type: "subagent" }>;
export type ApprovalEvent = Extract<UiEvent, { type: "approval" }>;
export type MeterReadings = Omit<Extract<UiEvent, { type: "meters" }>, "type">;
export type Decision = ApprovalRequest["decision"];

export interface MessageEntry {
  kind: ChatEntryKind.Message;
  id: string;
  role: ChatRole;
  text: string;
  /** Text deltas are still arriving. */
  streaming: boolean;
  /** Typed here and not yet echoed back by the server. */
  pending: boolean;
}

export interface ToolEntry {
  kind: ChatEntryKind.Tool;
  id: string;
  toolId: string;
  name: string;
  status: ToolEvent["status"];
  summary?: string;
}

export interface SubagentEntry {
  kind: ChatEntryKind.Subagent;
  id: string;
  taskId: string;
  task: string;
  status: SubagentEvent["status"];
}

export interface ApprovalEntry {
  kind: ChatEntryKind.Approval;
  id: string;
  approvalId: string;
}

export interface ErrorEntry {
  kind: ChatEntryKind.Error;
  id: string;
  message: string;
}

export type ChatEntry = MessageEntry | ToolEntry | SubagentEntry | ApprovalEntry | ErrorEntry;

export interface Approval {
  id: string;
  tool: string;
  summary: string;
  input: unknown;
  status: ApprovalStatus;
}

export interface AppState {
  view: ViewId;
  stream: StreamState;
  busy: boolean;
  chat: readonly ChatEntry[];
  /** Number used for the next chat entry id. */
  nextEntry: number;
  approvals: readonly Approval[];
  live: LiveStatus | null;
  projectDir: string | null;
  song: LeadSheet | null;
  pointer: LivePointer | null;
  meters: MeterReadings | null;
  costUsd: number | null;
}

export function initialState(): AppState {
  return {
    view: ViewId.Chat,
    stream: StreamState.Connecting,
    busy: false,
    chat: [],
    nextEntry: 1,
    approvals: [],
    live: null,
    projectDir: null,
    song: null,
    pointer: null,
    meters: null,
    costUsd: null,
  };
}
