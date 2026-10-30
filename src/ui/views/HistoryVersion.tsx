import { t } from "../../shared/i18n";
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
}

enum Task {
  None = "none",
  Confirming = "confirming",
  Restoring = "restoring",
  Naming = "naming",
  SavingName = "saving-name",
}

const MENU_ITEMS: readonly MenuItem<VersionAction>[] = [
  { id: VersionAction.Restore, label: t("history.restoreVersion"), icon: IconName.Restore },
  { id: VersionAction.Name, label: t("history.nameVersion"), icon: IconName.Edit },
];

const AUTHOR_LABELS: Record<VersionAuthor, string> = {
  [VersionAuthor.Musician]: t("common.you"),
  [VersionAuthor.Ode]: t("common.ode"),
  [VersionAuthor.Observed]: t("history.observedAuthor"),
};

/** Each author's colour from the brand: cyan for the musician, violet for Ode. */
const AUTHOR_TONES: Record<VersionAuthor, Tone> = {
  [VersionAuthor.Musician]: Tone.Info,
  [VersionAuthor.Ode]: Tone.Accent,
  [VersionAuthor.Observed]: Tone.Neutral,
};

// These prefixes belong to saved summaries and must not follow editable display labels.
const SAVED_AUTHOR_PREFIXES: Record<VersionAuthor, RegExp> = {
  [VersionAuthor.Musician]: /^You · /,
  [VersionAuthor.Ode]: /^Ode · /,
  [VersionAuthor.Observed]: /^Observed during Ode[’']s work · /,
};

export interface HistoryVersionProps {
  version: VersionListItem;
  kind: DateGroupKind;
  selected: boolean;
  onSelect: (id: string | null) => void;
  /** How many versions are newer than this one; restoring keeps them in history. */
  newer: number;
  /** Says how a restore went. */
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
  const working = task === Task.Restoring || task === Task.SavingName;
  const author = AUTHOR_LABELS[version.author];

  const restore = async () => {
    setTask(Task.Restoring);
    const notes: VersionNote[] = [];
    try {
      notes.push(restoreNote(await client.restoreVersion(version.id), moment));
    } catch (error) {
      notes.push({ tone: Tone.Danger, text: t("history.restoreFailed", { error: (errorMessage(error)) }) });
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
          <span className="history-row__summary">{version.changeCount === 0 ? t("common.initialVersion") : withoutAuthor(version.summary, version.author)}</span>
        </button>
        {fold && (
          <Button
            variant={ButtonVariant.Quiet}
            icon={fold.open ? IconName.ChevronDown : IconName.ChevronRight}
            className="history-row__fold"
            aria-expanded={fold.open}
            onClick={fold.onToggle}
          >
            {t("history.moreVersions", { count: (fold.count) })}
          </Button>
        )}
        <Menu label={t("history.versionActions")} icon={IconName.More} items={MENU_ITEMS} onSelect={startAction} align={MenuAlign.End} disabled={working} />
      </div>
      {(task === Task.Naming || task === Task.SavingName) && (
        <form className="history-row__name-form" onSubmit={(event) => void saveName(event)}>
          <TextInput
            aria-label={t("history.versionName")}
            value={draft}
            placeholder={t("history.versionNamePlaceholder")}
            autoFocus
            disabled={task === Task.SavingName}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleNameKeyDown}
          />
          <Button type="submit" variant={ButtonVariant.Primary} disabled={task === Task.SavingName}>
            {t("common.save")}
          </Button>
          <Button onClick={() => setTask(Task.None)} disabled={task === Task.SavingName}>
            {t("common.cancel")}
          </Button>
          {nameError && <Notice tone={Tone.Danger}>{t("history.nameSaveFailed", { error: (nameError) })}</Notice>}
        </form>
      )}
      {(task === Task.Confirming || task === Task.Restoring) && (
        <ConfirmCard
          message={confirmMessage(moment, newer)}
          confirmLabel={t("common.restore")}
          busy={task === Task.Restoring}
          onConfirm={() => void restore()}
          onCancel={() => setTask(Task.None)}
        />
      )}
      {selected && <HistoryChanges versionId={version.id} id={detailId} />}
    </li>
  );
}

/** A restore changes the current Set while keeping the saved history. */
function confirmMessage(moment: string, newer: number): string {
  return t("history.confirmRestore", { moment: (moment), newer: (newer) });
}

/** How the restore went, under the version: back, back with what stayed as it is, or stopped and why. */
function restoreNote(outcome: RestoreResult, moment: string): VersionNote {
  const skipped = outcome.skipped.join("; ");
  if (!outcome.restored) {
    return { tone: Tone.Danger, text: t("history.restoreIncomplete", { moment: (moment), hasSkipped: Boolean((skipped)), skipped: (skipped) }) };
  }
  return skipped ? { tone: Tone.Warning, text: t("history.restoredWithSkipped", { moment: (moment), skipped: (skipped) }) } : { tone: Tone.Success, text: t("history.restored", { moment: (moment) }) };
}

/** "You · 12 edits on Drums and Pad" under "You" reads as "12 edits on Drums and Pad". */
function withoutAuthor(summary: string, author: VersionAuthor): string {
  return summary.replace(SAVED_AUTHOR_PREFIXES[author], "");
}
