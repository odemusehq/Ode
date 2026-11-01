import type { ConversationExchange, UiEvent } from "../../shared/events";
import { VersionAuthor } from "../../shared/versions";
import type { VersionListItem } from "../../shared/versions";
import type { AppState, Step } from "./model";

type QuestionEvent = Extract<UiEvent, { type: "question" }>;
type ApprovalEvent = Extract<UiEvent, { type: "approval" }>;

/**
 * Applies one server event to the app state. Ode acts directly on the Set: its replies arrive as result lines, and
 * while it works its steps and its short notes show. The lyrics are kept by SharedLyrics.
 */
export function reduceEvent(state: AppState, event: UiEvent): AppState {
  switch (event.type) {
    case "conversation": {
      const next = state.songId !== event.songId ? clearSong(state) : state;
      const before = next.exchanges.find((exchange) => exchange.status === "running")?.id;
      const after = event.exchanges.find((exchange) => exchange.status === "running")?.id;
      return { ...next, ...(before !== after ? { steps: [], thought: null, progress: null } : {}), songId: event.songId, exchanges: event.exchanges };
    }
    case "message":
      return addMessage(state, event);
    case "lyrics":
      return state;
    case "tool":
      return event.status === "started"
        ? addStep(state, { id: event.id, label: event.summary ?? event.name, status: "running" })
        : setStep(state, event.id, event.status);
    case "subagent":
      return event.status === "started" ? addStep(state, { id: event.id, label: event.task, status: "running" }) : setStep(state, event.id, "done");
    case "approval":
      return addApproval(state, event);
    case "approval-resolved":
      return { ...state, approvals: state.approvals.filter((approval) => approval.id !== event.id) };
    case "busy":
      return event.busy ? startWork(state, event.stoppable) : finishWork(state);
    case "progress":
      return { ...state, progress: event.text };
    case "thought":
      return { ...state, thought: event.text };
    case "result":
      // An error the same request reported just before stays on screen.
      return { ...state, result: { text: event.text, versionId: event.versionId, kind: event.kind, overtaken: false } };
    case "answer":
      return { ...state, answer: { versionId: event.versionId, text: event.text } };
    case "question":
      return addQuestion(state, event);
    case "question-resolved":
      return { ...state, questions: state.questions.filter((question) => question.id !== event.id) };
    case "version":
      return addVersion(state, event.version);
    case "versions-truncated":
      return state.versions ? { ...state, versions: truncateAfter(state.versions, event.afterId) } : state;
    case "mode":
      return { ...state, mode: event.mode };
    case "done":
      // A turn can finish while its queued continuation starts. Global busy comes from the busy event.
      return state;
    case "error":
      return { ...state, error: event.message, progress: null };
    case "title":
      return event.songId && event.songId === state.songId
        ? { ...state, title: event.title }
        : { ...clearSong(state), songId: event.songId ?? null, title: event.title };
  }
}

/** A title may arrive before the new song's conversation. Never keep old action targets under it. */
function clearSong(state: AppState): AppState {
  return { ...state, exchanges: [], result: null, answer: null, steps: [], questions: [], approvals: [], versions: null, historyError: null, error: null };
}

function addMessage(state: AppState, event: Extract<UiEvent, { type: "message" }>): AppState {
  const exchanges = [...state.exchanges];
  const at = event.id ? exchanges.findIndex((exchange) => exchange.id === event.id) : exchanges.findLastIndex((exchange) => exchange.status === "running");
  const known = exchanges[at];
  if (event.role === "user") {
    if (known && known.request === event.text) return state;
    const exchange: ConversationExchange = { id: event.id ?? `message-${Date.now()}-${exchanges.length}`, request: event.text, ...(event.attachments?.length ? { attachments: event.attachments } : {}), reply: "", at: new Date().toISOString(), status: "running" };
    if (known && event.id) exchanges[at] = { ...known, ...exchange };
    else exchanges.push(exchange);
  } else if (known) {
    exchanges[at] = { ...known, reply: event.text, status: "complete" };
  } else {
    exchanges.push({ id: event.id ?? `message-${Date.now()}-${exchanges.length}`, request: "", reply: event.text, at: new Date().toISOString(), status: "complete" });
  }
  return { ...state, exchanges };
}

/** A new request: the old progress, steps and error go. */
function startWork(state: AppState, stoppable: boolean): AppState {
  return { ...state, busy: true, stoppable, progress: null, thought: null, steps: [], error: null };
}

/** The work ended: its steps stay listed under the result. */
export function finishWork(state: AppState): AppState {
  return { ...state, busy: false, stoppable: false, progress: null, thought: null };
}

function addStep(state: AppState, step: Step): AppState {
  return { ...state, steps: [...state.steps.filter((item) => item.id !== step.id), step] };
}

function setStep(state: AppState, id: string, status: Step["status"]): AppState {
  return { ...state, steps: state.steps.map((step) => (step.id === id ? { ...step, status } : step)) };
}

/**
 * Adds a version, or replaces it if it is already listed; the list stays newest first. A new version by the
 * musician after a result line means the Set changed since, so the line's actions are out of date.
 */
function addVersion(state: AppState, version: VersionListItem): AppState {
  const known = state.versions?.some((item) => item.id === version.id) ?? false;
  const versions = upsertVersion(state.versions ?? [], version);
  const { result } = state;
  const overtakes = !known && version.author === VersionAuthor.Musician && result !== null && result.versionId !== version.id;
  return { ...state, versions, result: overtakes && result ? { ...result, overtaken: true } : result };
}

function upsertVersion(versions: readonly VersionListItem[], version: VersionListItem): VersionListItem[] {
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
