import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { VersionListItem } from "../../shared/versions";
import { EmptyState, Notice, Toggle, Tone } from "../../ui-kit";
import { useAppState, useToday } from "../app/hooks";
import { VersionGrouping } from "./history-groups";
import type { DateGroup, VersionRun } from "./history-groups";
import { HistoryVersion } from "./HistoryVersion";
import type { RunFold, VersionNote } from "./HistoryVersion";
import "./HistoryView.css";

/** The version history of the whole Set, like a document's: grouped by date, newest first, with a way back to any version. */
export function HistoryView() {
  const versions = useAppState((state) => state.versions);
  const error = useAppState((state) => state.historyError);
  const groupMinutes = useAppState((state) => state.versionGroupMinutes);
  const today = useToday();
  const titleId = useId();
  const [onlyNamed, setOnlyNamed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [outcome, setOutcome] = useState<VersionNote[]>([]);
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outcome.length > 0) outcomeRef.current?.scrollIntoView({ block: "nearest" });
  }, [outcome]);

  const all = useMemo(() => versions ?? [], [versions]);
  const shown = useMemo(() => (onlyNamed ? all.filter((version) => version.name) : all), [all, onlyNamed]);
  const groups = useMemo(() => new VersionGrouping(groupMinutes ?? 0, new Date(today)).group(shown), [shown, groupMinutes, today]);
  const newer = useMemo(() => new Map(all.map((version, index): [string, number] => [version.id, index])), [all]);

  // A run is open while any of its versions is marked open, so it stays open when a newer version joins it.
  const toggleRun = useCallback(
    (run: VersionRun, open: boolean) => {
      const ids = [run.head, ...run.rest].map((version) => version.id);
      setExpanded((current) => {
        const next = new Set(current);
        for (const id of ids) {
          if (open) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      if (open && selectedId !== null && ids.includes(selectedId) && selectedId !== run.head.id) setSelectedId(null);
    },
    [selectedId],
  );

  return (
    <section className="history" aria-labelledby={titleId}>
      <div className="pane-header">
        <h2 id={titleId} className="pane-header__title">
          History
        </h2>
        <Toggle label="Only named versions" checked={onlyNamed} onChange={setOnlyNamed} />
      </div>
      <div className="history__body">
        {outcome.length > 0 && (
          <div ref={outcomeRef} className="history__outcome">
            {outcome.map((note, index) => (
              <Notice key={index} tone={note.tone}>
                {note.text}
              </Notice>
            ))}
          </div>
        )}
        {error && <Notice tone={Tone.Danger}>{error}</Notice>}
        {!versions && !error && <p className="muted">Reading the history…</p>}
        {versions && shown.length === 0 && <EmptyState title={onlyNamed ? "Named versions show here" : "Versions show here as you and Ode work"} />}
        {groups.map((group) => (
          <HistoryGroup
            key={group.key}
            group={group}
            expanded={expanded}
            onToggleRun={toggleRun}
            selectedId={selectedId}
            onSelect={setSelectedId}
            newer={newer}
            onOutcome={setOutcome}
          />
        ))}
      </div>
    </section>
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
  onToggleRun: (run: VersionRun, open: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Each version's place in the full history, newest first: how many versions are newer. */
  newer: ReadonlyMap<string, number>;
  onOutcome: (notes: VersionNote[]) => void;
}

/**
 * One date group. Rows are siblings keyed by version, folded ones included when their run is open, so a row keeps
 * its state when a new version changes how the runs fall; an open version keeps its run open.
 */
function HistoryGroup({ group, expanded, onToggleRun, selectedId, onSelect, newer, onOutcome }: HistoryGroupProps) {
  const rows: HistoryRow[] = group.runs.flatMap((run) => {
    const open = [run.head, ...run.rest].some((version) => expanded.has(version.id)) || run.rest.some((version) => version.id === selectedId);
    const fold = run.rest.length > 0 ? { count: run.rest.length, open, onToggle: () => onToggleRun(run, open) } : undefined;
    const head: HistoryRow = { version: run.head, nested: false, fold };
    return open ? [head, ...run.rest.map((version) => ({ version, nested: true }))] : [head];
  });

  return (
    <section className="history__group" aria-label={group.label}>
      <h3 className="history__date">{group.label}</h3>
      <ol className="history__list">
        {rows.map(({ version, nested, fold }) => (
          <HistoryVersion
            key={version.id}
            version={version}
            kind={group.kind}
            selected={version.id === selectedId}
            onSelect={onSelect}
            newer={newer.get(version.id) ?? 0}
            onOutcome={onOutcome}
            fold={fold}
            nested={nested}
          />
        ))}
      </ol>
    </section>
  );
}
