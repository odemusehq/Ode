import { useCallback } from "react";
import type { Note } from "../../shared/live";
import { ChangeKind } from "../../shared/versions";
import type { SetChange } from "../../shared/versions";
import { Badge, Notice, PianoRoll, Tone, pitchRangeOf } from "../../ui-kit";
import { beatsPerBar } from "../app/format";
import { useAppState, useClient, useRequest } from "../app/hooks";
import { ChangeViewKind, changeView, notesEnd, sectionDifference } from "./change-values";

const KIND_LABELS: Record<ChangeKind, string> = {
  [ChangeKind.Added]: "Added",
  [ChangeKind.Removed]: "Removed",
  [ChangeKind.Changed]: "Changed",
};

const KIND_TONES: Record<ChangeKind, Tone> = {
  [ChangeKind.Added]: Tone.Success,
  [ChangeKind.Removed]: Tone.Danger,
  [ChangeKind.Changed]: Tone.Info,
};

export interface HistoryChangesProps {
  versionId: string;
  /** Id of the element, so the version's row can point at it. */
  id: string;
}

/**
 * What a version changed: song-level changes on top, then the lead sheet's (under Lyrics), then each track it touched,
 * highlighted, with how it was before.
 */
export function HistoryChanges({ versionId, id }: HistoryChangesProps) {
  const client = useClient();
  const song = useAppState((state) => state.song);
  const load = useCallback(() => client.api.getVersion(versionId), [client, versionId]);
  const detail = useRequest(load);
  const perBar = beatsPerBar(song);

  if (detail.error) {
    return (
      <div id={id} className="history-detail">
        <Notice tone={Tone.Danger}>This version's changes couldn't be read: {detail.error}</Notice>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div id={id} className="history-detail">
        <p className="muted small">Reading the changes…</p>
      </div>
    );
  }

  const { version, tracks, song: songChanges } = detail.data;
  const setChanges = songChanges.filter((change) => change.target.scope !== "sheet");
  const sheetChanges = songChanges.filter((change) => change.target.scope === "sheet");
  return (
    <div id={id} className="history-detail">
      {version.request && <p className="muted small">Asked: “{version.request}”</p>}
      {setChanges.length > 0 && (
        <section className="history-detail__part" aria-label="Song">
          <h3 className="history-detail__title">Song</h3>
          <ChangeList changes={setChanges} perBar={perBar} />
        </section>
      )}
      {sheetChanges.length > 0 && (
        <section className="history-detail__part" aria-label="Lyrics">
          <h3 className="history-detail__title">Lyrics</h3>
          <ul className="history-detail__changes">
            {sheetChanges.map((change, index) => (
              <SheetChangeItem key={index} change={change} perBar={perBar} />
            ))}
          </ul>
        </section>
      )}
      {tracks.map((track, index) => (
        <section key={`${index}-${track.track}`} className="history-detail__part history-detail__part--track" aria-label={track.track}>
          <h3 className="history-detail__title">{track.track}</h3>
          <ChangeList changes={track.changes} perBar={perBar} />
        </section>
      ))}
      {songChanges.length === 0 && tracks.length === 0 && <p className="muted small">Nothing changed.</p>}
    </div>
  );
}

interface ChangeListProps {
  changes: readonly SetChange[];
  perBar: number;
}

function ChangeList({ changes, perBar }: ChangeListProps) {
  return (
    <ul className="history-detail__changes">
      {changes.map((change, index) => (
        <ChangeItem key={index} change={change} perBar={perBar} />
      ))}
    </ul>
  );
}

interface ChangeItemProps {
  change: SetChange;
  perBar: number;
}

function ChangeItem({ change, perBar }: ChangeItemProps) {
  const view = changeView(change);
  return (
    <li className="history-change">
      <div className="history-change__line">
        <Badge tone={KIND_TONES[change.kind]}>{KIND_LABELS[change.kind]}</Badge>
        <span className="history-change__label">{change.label}</span>
      </div>
      {view.kind === ChangeViewKind.Text && (
        <p className="history-change__values">
          <span className="history-change__before">{view.before}</span>
          <span aria-hidden="true"> → </span>
          <span className="ode-visually-hidden"> changed to </span>
          <span>{view.after}</span>
        </p>
      )}
      {view.kind === ChangeViewKind.Notes && <NotesBeforeAfter label={change.label} before={view.before} after={view.after} perBar={perBar} />}
    </li>
  );
}

/**
 * A lead-sheet change. A section that changed shows each line that differs, the old words struck through above
 * the new, and its chords before and after; an added or removed section, or the rest of the lead sheet, its label.
 */
function SheetChangeItem({ change, perBar }: ChangeItemProps) {
  const difference = sectionDifference(change, perBar);
  return (
    <li className="history-change">
      <div className="history-change__line">
        <Badge tone={KIND_TONES[change.kind]}>{KIND_LABELS[change.kind]}</Badge>
        <span className="history-change__label">{change.label}</span>
      </div>
      {difference && difference.lines.length > 0 && (
        <ul className="history-sheet__lines">
          {difference.lines.map((line, index) => (
            <li key={index} className="history-sheet__line">
              <span className="history-sheet__number">Line {line.number}</span>
              {line.before !== undefined && (
                <del className="history-sheet__old">
                  <span className="ode-visually-hidden">Was: </span>
                  {line.before}
                </del>
              )}
              {line.after !== undefined && (
                <ins className="history-sheet__new">
                  <span className="ode-visually-hidden">Now: </span>
                  {line.after}
                </ins>
              )}
            </li>
          ))}
        </ul>
      )}
      {difference?.chords && (
        <p className="history-change__values">
          <span className="history-sheet__chords">Chords </span>
          <span className="history-change__before">{difference.chords.before}</span>
          <span aria-hidden="true"> → </span>
          <span className="ode-visually-hidden"> changed to </span>
          <span>{difference.chords.after}</span>
        </p>
      )}
    </li>
  );
}

interface NotesBeforeAfterProps {
  label: string;
  before?: Note[];
  after?: Note[];
  perBar: number;
}

/** The notes before and after on two piano rolls with the same rows and length, so they line up. */
function NotesBeforeAfter({ label, before, after, perBar }: NotesBeforeAfterProps) {
  const all = [...(before ?? []), ...(after ?? [])];
  const range = pitchRangeOf(all);
  const length = notesEnd(all);
  return (
    <div className="history-change__rolls">
      {before && (
        <figure className="history-change__roll">
          <figcaption className="history-change__caption">Before</figcaption>
          <PianoRoll label={`${label}, before`} notes={before} pitchRange={range} lengthBeats={length} beatsPerBar={perBar} />
        </figure>
      )}
      {after && (
        <figure className="history-change__roll">
          <figcaption className="history-change__caption">After</figcaption>
          <PianoRoll label={`${label}, after`} notes={after} pitchRange={range} lengthBeats={length} beatsPerBar={perBar} />
        </figure>
      )}
    </div>
  );
}
