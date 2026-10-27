import type { UiEvent } from "../../shared/events";
import { ApprovalStatus } from "../../ui-kit";
import type { ChatRole } from "../../ui-kit";
import { UI_CONFIG } from "./config";
import { ChatEntryKind } from "./model";
import type { ApprovalEvent, AppState, ChatEntry, MessageEntry, SubagentEvent, ToolEvent } from "./model";

/** Applies one server event to the app state. */
export function reduceEvent(state: AppState, event: UiEvent): AppState {
  switch (event.type) {
    case "message":
      return receiveMessage(state, event.role, event.text);
    case "text":
      return appendText(state, event.delta);
    case "tool":
      return upsertTool(state, event);
    case "subagent":
      return upsertSubagent(state, event);
    case "approval":
      return addApproval(state, event);
    case "approval-resolved":
      return setApprovalStatus(state, event.id, event.decision === "allow" ? ApprovalStatus.Allowed : ApprovalStatus.Denied);
    case "busy":
      return { ...state, busy: event.busy };
    case "done":
      return { ...finishStreaming(state), busy: false, costUsd: event.costUsd ?? state.costUsd };
    case "error":
      return addError(finishStreaming(state), event.message);
    case "live-status":
      return { ...state, live: event.status };
    case "song":
      return { ...state, song: event.leadSheet };
    case "pointer":
      return { ...state, pointer: event.pointer };
    case "meters":
      return { ...state, meters: { tracks: event.tracks, master: event.master } };
  }
}

export function addUserMessage(state: AppState, text: string): AppState {
  return append(state, { kind: ChatEntryKind.Message, id: nextId(state), role: "user", text, streaming: false, pending: true });
}

export function addError(state: AppState, message: string): AppState {
  return append(state, { kind: ChatEntryKind.Error, id: nextId(state), message });
}

export function setApprovalStatus(state: AppState, id: string, status: ApprovalStatus): AppState {
  const approvals = state.approvals.map((approval) => {
    if (approval.id !== id) return approval;
    const keepsAlways = approval.status === ApprovalStatus.AlwaysAllowed && status === ApprovalStatus.Allowed;
    return keepsAlways ? approval : { ...approval, status };
  });
  return { ...state, approvals };
}

function nextId(state: AppState): string {
  return `entry-${state.nextEntry}`;
}

function append(state: AppState, entry: ChatEntry): AppState {
  const chat = [...state.chat, entry].slice(-UI_CONFIG.chatEntryLimit);
  return { ...state, chat, nextEntry: state.nextEntry + 1 };
}

function replaceAt(state: AppState, index: number, entry: ChatEntry): AppState {
  const chat = state.chat.slice();
  chat[index] = entry;
  return { ...state, chat };
}

function lastIndexWhere(entries: readonly ChatEntry[], matches: (entry: ChatEntry) => boolean): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry && matches(entry)) return index;
  }
  return -1;
}

function isMessage(entry: ChatEntry): entry is MessageEntry {
  return entry.kind === ChatEntryKind.Message;
}

function receiveMessage(state: AppState, role: ChatRole, text: string): AppState {
  const index =
    role === "user"
      ? lastIndexWhere(state.chat, (entry) => isMessage(entry) && entry.role === "user" && entry.pending && entry.text === text)
      : lastIndexWhere(state.chat, (entry) => isMessage(entry) && entry.role === "assistant" && entry.streaming);
  const existing = state.chat[index];
  if (existing && isMessage(existing)) {
    return replaceAt(state, index, { ...existing, text, streaming: false, pending: false });
  }
  return append(state, { kind: ChatEntryKind.Message, id: nextId(state), role, text, streaming: false, pending: false });
}

function appendText(state: AppState, delta: string): AppState {
  const index = state.chat.length - 1;
  const last = state.chat[index];
  if (last && isMessage(last) && last.role === "assistant" && last.streaming) {
    return replaceAt(state, index, { ...last, text: last.text + delta });
  }
  const finished = finishStreaming(state);
  return append(finished, {
    kind: ChatEntryKind.Message,
    id: nextId(finished),
    role: "assistant",
    text: delta,
    streaming: true,
    pending: false,
  });
}

function finishStreaming(state: AppState): AppState {
  if (!state.chat.some((entry) => isMessage(entry) && entry.streaming)) return state;
  const chat = state.chat.map((entry) => (isMessage(entry) && entry.streaming ? { ...entry, streaming: false } : entry));
  return { ...state, chat };
}

function upsertTool(state: AppState, event: ToolEvent): AppState {
  const index = lastIndexWhere(state.chat, (entry) => entry.kind === ChatEntryKind.Tool && entry.toolId === event.id);
  const existing = state.chat[index];
  if (existing && existing.kind === ChatEntryKind.Tool) {
    return replaceAt(state, index, {
      ...existing,
      name: event.name || existing.name,
      status: event.status,
      summary: event.summary ?? existing.summary,
    });
  }
  return append(state, {
    kind: ChatEntryKind.Tool,
    id: nextId(state),
    toolId: event.id,
    name: event.name,
    status: event.status,
    summary: event.summary,
  });
}

function upsertSubagent(state: AppState, event: SubagentEvent): AppState {
  const index = lastIndexWhere(state.chat, (entry) => entry.kind === ChatEntryKind.Subagent && entry.taskId === event.id);
  const existing = state.chat[index];
  if (existing && existing.kind === ChatEntryKind.Subagent) {
    return replaceAt(state, index, { ...existing, task: event.task || existing.task, status: event.status });
  }
  return append(state, { kind: ChatEntryKind.Subagent, id: nextId(state), taskId: event.id, task: event.task, status: event.status });
}

function addApproval(state: AppState, event: ApprovalEvent): AppState {
  const details = { tool: event.tool, summary: event.summary, input: event.input };
  if (state.approvals.some((approval) => approval.id === event.id)) {
    const approvals = state.approvals.map((approval) => (approval.id === event.id ? { ...approval, ...details } : approval));
    return { ...state, approvals };
  }
  const withApproval = { ...state, approvals: [...state.approvals, { id: event.id, ...details, status: ApprovalStatus.Pending }] };
  return append(withApproval, { kind: ChatEntryKind.Approval, id: nextId(withApproval), approvalId: event.id });
}
