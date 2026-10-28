import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VersionListItem } from "../../shared/versions";
import { EmptyState, IconButton, IconName, Notice, Toggle, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";
import { VersionGrouping } from "./history-groups";
import type { DateGroup } from "./history-groups";
import { HistoryVersion } from "./HistoryVersion";
import type { RunFold, VersionNote } from "./HistoryVersion";
import "./HistoryView.css";
import "./views.css";

/** The version history of the whole Set, like a document's: grouped by date, newest first, with a way back to any version. */
export function HistoryView() {
  const client = useClient();
  const versions = useAppState((state) => state.versions);
  const groupMinutes = useAppState((state) => state.versionGroupMinutes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyNamed, setOnlyNamed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [outcome, setOutcome] = useState<VersionNote[]>([]);
  const outcomeRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await client.loadVersions();
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (outcome.length > 0) outcomeRef.current?.scrollIntoView({ block: "nearest" });
  }, [outcome]);

  const all = useMemo(() => versions ?? [], [versions]);
  const shown = useMemo(() => (onlyNamed ? all.filter((version) => version.name) : all), [all, onlyNamed]);
  const groups = useMemo(() => new VersionGrouping(groupMinutes ?? 0, new Date()).group(shown), [shown, groupMinutes]);
  const newer = useMemo(() => new Map(all.map((version, index): [string, number] => [version.id, index])), [all]);
  const newestId = all[0]?.id ?? "";

  const toggleRun = useCallback((headId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(headId)) next.add(headId);
      return next;
    });
  }, []);

  return (
    <div className="view history">
      <div className="view-toolbar">
        <div className="view-toolbar__grow">
          <Toggle label="Only named versions" checked={onlyNamed} onChange={setOnlyNamed} />
        </div>
        <IconButton icon={IconName.Refresh} label="Read the history again" onClick={() => void load()} disabled={loading} />
      </div>
      {outcome.length > 0 && (
        <div ref={outcomeRef} className="history__outcome">
          {outcome.map((note, index) => (
            <Notice key={index} tone={note.tone}>
              {note.text}
            </Notice>
          ))}
        </div>
      )}
      {error && <Notice tone={Tone.Danger}>The history couldn't be read: {error}</Notice>}
      {loading && !versions && <p className="muted">Reading the history…</p>}
      {versions && shown.length === 0 && <NoVersions onlyNamed={onlyNamed} />}
      {groups.map((group) => (
        <HistoryGroup
          key={group.key}
          group={group}
          expanded={expanded}
          onToggleRun={toggleRun}
          selectedId={selectedId}
          onSelect={setSelectedId}
          newer={newer}
          newestId={newestId}
          onOutcome={setOutcome}
        />
      ))}
      <p className="history__small-print">
        Versions don't include automation. Plugins keep only the parameters they expose. Recorded audio is kept as files.
      </p>
    </div>
  );
}

interface NoVersionsProps {
  onlyNamed: boolean;
}

function NoVersions({ onlyNamed }: NoVersionsProps) {
  if (onlyNamed) return <EmptyState title="No named versions">Name a version from its menu to find it here.</EmptyState>;
  return (
    <EmptyState title="No versions yet">
      Ode saves a version of the whole Set before every request and after every change it makes.
    </EmptyState>
  );
}

interface HistoryRow {
  version: VersionListItem;
  nested: boolean;
  fold?: RunFold;
}

interface HistoryGroupProps {
  group: DateGroup;
  expanded: ReadonlySet<string>;
  onToggleRun: (headId: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Each version's place in the full history, newest first: how many versions are newer. */
  newer: ReadonlyMap<string, number>;
  newestId: string;
  onOutcome: (notes: VersionNote[]) => void;
}

/**
 * One date group. Rows are siblings keyed by version, folded ones included when their run is open,
 * so a row keeps its state when a new version changes how the runs fall.
 */
function HistoryGroup({ group, expanded, onToggleRun, selectedId, onSelect, newer, newestId, onOutcome }: HistoryGroupProps) {
  const rows: HistoryRow[] = group.runs.flatMap((run) => {
    const open = expanded.has(run.head.id);
    const fold = run.rest.length > 0 ? { count: run.rest.length, open, onToggle: () => onToggleRun(run.head.id) } : undefined;
    const head: HistoryRow = { version: run.head, nested: false, fold };
    return open ? [head, ...run.rest.map((version) => ({ version, nested: true }))] : [head];
  });

  return (
    <section className="history__group" aria-label={group.label}>
      <h2 className="history__date">{group.label}</h2>
      <ol className="history__list">
        {rows.map(({ version, nested, fold }) => (
          <HistoryVersion
            key={version.id}
            version={version}
            kind={group.kind}
            selected={version.id === selectedId}
            onSelect={onSelect}
            newer={newer.get(version.id) ?? 0}
            newestId={newestId}
            onOutcome={onOutcome}
            fold={fold}
            nested={nested}
          />
        ))}
      </ol>
    </section>
  );
}
