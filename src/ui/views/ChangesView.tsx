import { useCallback, useMemo } from "react";
import type { HistoryEntry } from "../../shared/song";
import { ApprovalStatus, Badge, IconButton, IconName, Notice, Panel, Tone } from "../../ui-kit";
import { UI_CONFIG } from "../app/config";
import { formatDateTime } from "../app/format";
import { useAppState, useClient, useReloadOnChange, useRequest } from "../app/hooks";
import { AllowedChanges } from "./AllowedChanges";
import { ApprovalItem } from "./ApprovalItem";
import "./views.css";

type HistoryKind = HistoryEntry["kind"];

const KIND_LABELS: Record<HistoryKind, string> = {
  suggested: "Suggested",
  kept: "Kept",
  changed: "Changed",
  rejected: "Rejected",
};

const KIND_TONES: Record<HistoryKind, Tone> = {
  suggested: Tone.Info,
  kept: Tone.Success,
  changed: Tone.Accent,
  rejected: Tone.Danger,
};

export function ChangesView() {
  const client = useClient();
  const approvals = useAppState((state) => state.approvals);
  const waiting = useMemo(() => approvals.filter((approval) => approval.status === ApprovalStatus.Pending), [approvals]);
  const decided = approvals.length - waiting.length;
  const loadHistory = useCallback(() => client.api.getHistory(), [client]);
  const history = useRequest(loadHistory);
  const recent = useMemo(() => newestFirst(history.data ?? []).slice(0, UI_CONFIG.historyLimit), [history.data]);
  useReloadOnChange(decided, history.reload);

  return (
    <div className="view">
      <Panel title="Waiting for approval">
        {waiting.length === 0 ? (
          <p className="muted">Nothing is waiting. Ode asks here and in the chat before it changes your Set.</p>
        ) : (
          waiting.map((approval) => <ApprovalItem key={approval.id} approval={approval} />)
        )}
      </Panel>
      <Panel
        title="Recent changes"
        actions={<IconButton icon={IconName.Refresh} label="Load the history again" onClick={history.reload} disabled={history.loading} />}
      >
        {history.error && <Notice tone={Tone.Danger}>The history couldn't be read: {history.error}</Notice>}
        {recent.length === 0 ? (
          <p className="muted">No changes yet.</p>
        ) : (
          <ol className="plain-list">
            {recent.map((entry, index) => (
              <HistoryRow key={`${entry.time}-${index}`} entry={entry} />
            ))}
          </ol>
        )}
      </Panel>
      <AllowedChanges refreshKey={decided} />
    </div>
  );
}

interface HistoryRowProps {
  entry: HistoryEntry;
}

function HistoryRow({ entry }: HistoryRowProps) {
  return (
    <li className="list-row">
      <Badge tone={KIND_TONES[entry.kind]}>{KIND_LABELS[entry.kind]}</Badge>
      <span className="list-row__main">
        {entry.what}
        {entry.reason && <span className="muted"> · {entry.reason}</span>}
      </span>
      <time className="muted small" dateTime={entry.time}>
        {formatDateTime(entry.time)}
      </time>
    </li>
  );
}

function newestFirst(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => b.time.localeCompare(a.time));
}
