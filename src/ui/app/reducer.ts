import type { Suggestion, UiEvent } from "../../shared/events";
import type { VersionListItem } from "../../shared/versions";
import { WhyStatus } from "./model";
import type { AppState, ResultLine, WhyAnswer } from "./model";

type QuestionEvent = Extract<UiEvent, { type: "question" }>;
type ApprovalEvent = Extract<UiEvent, { type: "approval" }>;

/**
 * Applies one server event to the app state. Ode is not a chat: its replies arrive as result lines,
 * so streamed text, tool calls and subagents are not shown (only "Why?" listens to Ode's words).
 */
export function reduceEvent(state: AppState, event: UiEvent): AppState {
  switch (event.type) {
    case "message":
      return event.role === "assistant" ? hearWhy(state, event.text) : state;
    case "text":
    case "tool":
    case "subagent":
      return state;
    case "approval":
      return addApproval(state, event);
    case "approval-resolved":
      return { ...state, approvals: state.approvals.filter((approval) => approval.id !== event.id) };
    case "busy":
      return event.busy ? startRequest(state) : finishRequest(state);
    case "progress":
      return { ...state, progress: event.text };
    case "result":
      return receiveResult(state, { text: event.text, versionId: event.versionId, undone: false });
    case "question":
      return addQuestion(state, event);
    case "question-resolved":
      return { ...state, questions: state.questions.filter((question) => question.id !== event.id) };
    case "selection":
      return { ...state, focus: event.label.trim() || null };
    case "pointer":
      return { ...state, focus: event.pointer.description.trim() || state.focus };
    case "suggestions":
      return { ...state, suggestions: fixesFirst(event.items) };
    case "version":
      return {
        ...state,
        versions: state.versions ? upsertVersion(state.versions, event.version) : null,
        versionStamp: state.versionStamp + 1,
      };
    case "versions-truncated":
      return state.versions ? { ...state, versions: truncateAfter(state.versions, event.afterId) } : state;
    case "mode":
      return { ...state, mode: event.mode };
    case "done":
      return finishRequest(state);
    case "error":
      return { ...state, error: event.message, progress: null, why: isAsking(state.why) ? null : state.why };
    case "live-status":
      return { ...state, live: event.status };
    case "song":
      return { ...state, song: event.leadSheet };
    case "meters":
      return { ...state, meters: { tracks: event.tracks, master: event.master } };
  }
}

/** Suggestions with the fixes for problems first, otherwise in the server's order. */
export function fixesFirst(items: readonly Suggestion[]): Suggestion[] {
  return [...items.filter((item) => item.fix), ...items.filter((item) => !item.fix)];
}

/** Adds a version, or replaces it if it is already listed; the list stays newest first. */
export function upsertVersion(versions: readonly VersionListItem[], version: VersionListItem): VersionListItem[] {
  if (versions.some((item) => item.id === version.id)) {
    return versions.map((item) => (item.id === version.id ? version : item));
  }
  const time = Date.parse(version.time);
  const index = versions.findIndex((item) => Date.parse(item.time) < time);
  const position = index < 0 ? versions.length : index;
  return [...versions.slice(0, position), version, ...versions.slice(position)];
}

/** A restore deleted every version after this one: the list keeps it and everything older. */
function truncateAfter(versions: readonly VersionListItem[], afterId: string): readonly VersionListItem[] {
  const index = versions.findIndex((item) => item.id === afterId);
  return index <= 0 ? versions : versions.slice(index);
}

function isAsking(why: WhyAnswer | null): boolean {
  return why?.status === WhyStatus.Asking;
}

/** A new request: the old progress and error go, and so does an old "Why?" answer. */
function startRequest(state: AppState): AppState {
  return { ...state, busy: true, progress: null, error: null, why: isAsking(state.why) ? state.why : null };
}

/** The request ended: a "Why?" still waiting keeps what Ode said, or goes if it said nothing. */
function finishRequest(state: AppState): AppState {
  const { why } = state;
  const settled = why && isAsking(why) ? (why.text ? { status: WhyStatus.Answered, text: why.text } : null) : why;
  return { ...state, busy: false, progress: null, why: settled };
}

/** The answer to "Why?" changes nothing in the Set, so it goes under the result line instead of replacing it. */
function receiveResult(state: AppState, line: ResultLine): AppState {
  if (isAsking(state.why) && line.versionId === null) {
    return { ...state, why: { status: WhyStatus.Answered, text: line.text } };
  }
  return { ...state, result: line, why: null, error: null };
}

function hearWhy(state: AppState, text: string): AppState {
  return isAsking(state.why) ? { ...state, why: { status: WhyStatus.Asking, text } } : state;
}

function addQuestion(state: AppState, event: QuestionEvent): AppState {
  const question = { id: event.id, text: event.text, options: event.options, answered: false };
  const known = state.questions.some((item) => item.id === event.id);
  const questions = known ? state.questions.map((item) => (item.id === event.id ? question : item)) : [...state.questions, question];
  return { ...state, questions };
}

function addApproval(state: AppState, event: ApprovalEvent): AppState {
  const approval = { id: event.id, summary: event.summary, decided: false };
  const known = state.approvals.some((item) => item.id === event.id);
  const approvals = known ? state.approvals.map((item) => (item.id === event.id ? approval : item)) : [...state.approvals, approval];
  return { ...state, approvals };
}
