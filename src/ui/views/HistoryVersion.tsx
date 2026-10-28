import { useId, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { RestoreResult } from "../../shared/api";
import { VersionAuthor } from "../../shared/versions";
import type { VersionListItem } from "../../shared/versions";
import { Button, ButtonVariant, ConfirmCard, Dot, IconName, Menu, MenuAlign, Notice, TextInput, Tone, cx } from "../../ui-kit";
import type { MenuItem } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useClient } from "../app/hooks";
import { HistoryChanges } from "./HistoryChanges";
import { momentOf, rowTime } from "./history-groups";
import type { DateGroupKind } from "./history-groups";

/** One line saying how an action on a version went. */
export interface VersionNote {
  tone: Tone;
  text: string;
}

/** The first row of a run: how many versions fold under it, and whether they show. */
export interface RunFold {
  count: number;
  open: boolean;
  onToggle: () => void;
}

enum VersionAction {
  Restore = "restore",
  Name = "name",
  Copy = "copy",
}

enum Task {
  None = "none",
  Confirming = "confirming",
  Restoring = "restoring",
  Naming = "naming",
  SavingName = "saving-name",
  Copying = "copying",
}

const MENU_ITEMS: readonly MenuItem<VersionAction>[] = [
  { id: VersionAction.Restore, label: "Restore this version", icon: IconName.Restore },
  { id: VersionAction.Name, label: "Name this version", icon: IconName.Edit },
  { id: VersionAction.Copy, label: "Make a copy", icon: IconName.Copy },
];

const AUTHOR_LABELS: Record<VersionAuthor, string> = {
  [VersionAuthor.Musician]: "You",
  [VersionAuthor.Ode]: "Ode",
};

/** Each author's colour from the brand: cyan for the musician, violet for Ode. */
const AUTHOR_TONES: Record<VersionAuthor, Tone> = {
  [VersionAuthor.Musician]: Tone.Info,
  [VersionAuthor.Ode]: Tone.Accent,
};

const AUTHOR_SEPARATOR = " · ";

export interface HistoryVersionProps {
  version: VersionListItem;
  kind: DateGroupKind;
  selected: boolean;
  onSelect: (id: string | null) => void;
  /** How many versions are newer than this one; restoring it deletes them. */
  newer: number;
  /** Says how a restore or a copy went. */
  onOutcome: (notes: VersionNote[]) => void;
  fold?: RunFold;
  /** A row folded under the first row of its run. */
  nested?: boolean;
}

/** A version in the history: when, who, its name and summary; it opens to show its changes and has a menu. */
export function HistoryVersion({ version, kind, selected, onSelect, newer, onOutcome, fold, nested }: HistoryVersionProps) {
  const client = useClient();
  const [task, setTask] = useState(Task.None);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const detailId = useId();
  const moment = momentOf(version.time, kind);
  const working = task === Task.Restoring || task === Task.SavingName || task === Task.Copying;
  const author = AUTHOR_LABELS[version.author];

  const copy = async () => {
    setTask(Task.Copying);
    try {
      const result = await client.copyVersion(version.id);
      onOutcome([{ tone: Tone.Success, text: `A copy is in ${result.path}. Open it in Live to carry on from ${moment}.` }]);
    } catch (error) {
      onOutcome([{ tone: Tone.Danger, text: `The copy wasn't made: ${errorMessage(error)}` }]);
    } finally {
      setTask(Task.None);
    }
  };

  const restore = async (copyFirst: boolean) => {
    setTask(Task.Restoring);
    const notes: VersionNote[] = [];
    try {
      if (copyFirst) {
        const result = await client.copyNow();
        notes.push({ tone: Tone.Success, text: `A copy of the project as it is now is in ${result.path}.` });
      }
      const note = restoreNote(await client.restoreVersion(version.id), moment);
      if (note) notes.push(note);
    } catch (error) {
      const what = copyFirst && notes.length === 0 ? "The copy wasn't made, so nothing was restored" : "The version wasn't restored";
      notes.push({ tone: Tone.Danger, text: `${what}: ${errorMessage(error)}` });
    }
    onOutcome(notes);
    setTask(Task.None);
  };

  const startAction = (action: VersionAction) => {
    switch (action) {
      case VersionAction.Restore:
        setTask(Task.Confirming);
        return;
      case VersionAction.Name:
        setDraft(version.name ?? "");
        setNameError(null);
        setTask(Task.Naming);
        return;
      case VersionAction.Copy:
        void copy();
        return;
    }
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTask(Task.SavingName);
    try {
      await client.nameVersion(version.id, draft.trim());
      setTask(Task.None);
    } catch (error) {
      setNameError(errorMessage(error));
      setTask(Task.Naming);
    }
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setTask(Task.None);
  };

  return (
    <li className={cx("history-row", nested && "history-row--nested", selected && "history-row--selected")}>
      <div className="history-row__line">
        <button
          type="button"
          className="history-row__main"
          aria-expanded={selected}
          aria-controls={selected ? detailId : undefined}
          onClick={() => onSelect(selected ? null : version.id)}
        >
          <span className="history-row__meta">
            <time className="history-row__time" dateTime={version.time}>
              {rowTime(version.time, kind)}
            </time>
            <Dot tone={AUTHOR_TONES[version.author]} />
            <span className="history-row__author">{author}</span>
            {version.name && <strong className="history-row__name">{version.name}</strong>}
          </span>
          <span className="history-row__summary">{withoutAuthor(version.summary, author)}</span>
        </button>
        {fold && (
          <Button
            variant={ButtonVariant.Quiet}
            icon={fold.open ? IconName.ChevronDown : IconName.ChevronRight}
            className="history-row__fold"
            aria-expanded={fold.open}
            onClick={fold.onToggle}
          >
            {fold.count} more
          </Button>
        )}
        <Menu label="Version actions" icon={IconName.More} items={MENU_ITEMS} onSelect={startAction} align={MenuAlign.End} disabled={working} />
      </div>
      {(task === Task.Naming || task === Task.SavingName) && (
        <form className="history-row__name-form" onSubmit={(event) => void saveName(event)}>
          <TextInput
            aria-label="Name of this version"
            value={draft}
            placeholder="e.g. Chorus idea"
            autoFocus
            disabled={task === Task.SavingName}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleNameKeyDown}
          />
          <Button type="submit" variant={ButtonVariant.Primary} disabled={task === Task.SavingName}>
            Save
          </Button>
          <Button onClick={() => setTask(Task.None)} disabled={task === Task.SavingName}>
            Cancel
          </Button>
          {nameError && <Notice tone={Tone.Danger}>The name wasn't saved: {nameError}</Notice>}
        </form>
      )}
      {(task === Task.Confirming || task === Task.Restoring) && (
        <ConfirmCard
          message={confirmMessage(moment, newer)}
          confirmLabel="Restore"
          busy={task === Task.Restoring}
          onConfirm={() => void restore(false)}
          onCancel={() => setTask(Task.None)}
          extra={
            <Button icon={IconName.Copy} onClick={() => void restore(true)} disabled={task === Task.Restoring}>
              Make a copy first
            </Button>
          }
        />
      )}
      {task === Task.Copying && <p className="muted small">Copying the project…</p>}
      {selected && <HistoryChanges versionId={version.id} id={detailId} />}
    </li>
  );
}

/** Restoring deletes the later versions and anything changed by hand since the last one. */
function confirmMessage(moment: string, newer: number): string {
  if (newer === 0) return `Go back to ${moment}? Anything changed since then will be deleted.`;
  return `Go back to ${moment}? Later versions, and anything changed since the last one, will be deleted.`;
}

/** Ode's result line says the restore worked; a note only for what couldn't be put back. */
function restoreNote(outcome: RestoreResult, moment: string): VersionNote | null {
  const skipped = outcome.skipped.join("; ");
  if (!outcome.restored) {
    return { tone: Tone.Danger, text: skipped ? `Couldn't go back to ${moment}: ${skipped}` : `Couldn't go back to ${moment}.` };
  }
  return skipped ? { tone: Tone.Warning, text: `Back to ${moment}. Not restored: ${skipped}` } : null;
}

/** "You · 12 edits on Drums and Pad" under "You" reads as "12 edits on Drums and Pad". */
function withoutAuthor(summary: string, author: string): string {
  const prefix = `${author}${AUTHOR_SEPARATOR}`;
  return summary.startsWith(prefix) ? summary.slice(prefix.length) : summary;
}
