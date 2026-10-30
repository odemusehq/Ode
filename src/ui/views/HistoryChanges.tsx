import { t } from "../../shared/i18n";
import { useCallback } from "react";
import type { Note } from "../../shared/live";
import type { SetChange } from "../../shared/versions";
import { Notice, PianoRoll, Tone, cx, pitchRangeOf } from "../../ui-kit";
import { useClient, useRequest } from "../app/hooks";
import { isLyricsChange, labelUnder, lyricsHunks, notesChange, notesEnd } from "./change-values";

// Persisted labels keep their original prefixes even when the catalogue headings are edited.
const SAVED_SONG_HEADING = "Song";
const SAVED_LYRICS_HEADING = "Lyrics";

export interface HistoryChangesProps {
  versionId: string;
  /** Id of the element, so the version's row can point at it. */
  id: string;
}

/**
 * What a version changed: the song's changes, the lyrics' lines old above new, then each track it touched,
 * highlighted, with its notes before and after.
 */
export function HistoryChanges({ versionId, id }: HistoryChangesProps) {
  const client = useClient();
  const load = useCallback(() => client.api.getVersion(versionId), [client, versionId]);
  const detail = useRequest(load);

  if (detail.error) {
    return (
      <div id={id} className="history-detail">
        <Notice tone={Tone.Danger}>{t("history.changesFailed", { error: (detail.error) })}</Notice>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div id={id} className="history-detail">
        <p className="muted small">{t("history.readingChanges")}</p>
      </div>
    );
  }

  const { version, tracks, song, beatsPerBar } = detail.data;
  const lyrics = song.filter(isLyricsChange);
  const songChanges = song.filter((change) => !isLyricsChange(change));
  return (
    <div id={id} className="history-detail">
      {version.request && <p className="muted small">{t("history.request", { request: (version.request) })}</p>}
      {songChanges.length > 0 && <ChangePart title={t("common.song")} savedHeading={SAVED_SONG_HEADING} changes={songChanges} beatsPerBar={beatsPerBar} />}
      {lyrics.map((change, index) => (
        <LyricsPart key={index} change={change} />
      ))}
      {tracks.map((track, index) => (
        <ChangePart key={`${index}-${track.track}`} title={track.track} changes={track.changes} beatsPerBar={beatsPerBar} track />
      ))}
      {song.length === 0 && tracks.length === 0 && <p className="muted small">{t("history.unchanged")}</p>}
    </div>
  );
}

interface ChangePartProps {
  title: string;
  savedHeading?: string;
  changes: readonly SetChange[];
  beatsPerBar: number | null;
  /** A track the version touched: highlighted. */
  track?: boolean;
}

function ChangePart({ title, savedHeading = title, changes, beatsPerBar, track }: ChangePartProps) {
  return (
    <section className={cx("history-detail__part", track && "history-detail__part--track")} aria-label={title}>
      <h3 className="history-detail__title">{title}</h3>
      <ul className="history-detail__changes">
        {changes.map((change, index) => (
          <ChangeItem key={index} change={change} heading={savedHeading} beatsPerBar={beatsPerBar} />
        ))}
      </ul>
    </section>
  );
}

interface ChangeItemProps {
  change: SetChange;
  heading: string;
  beatsPerBar: number | null;
}

function ChangeItem({ change, heading, beatsPerBar }: ChangeItemProps) {
  const label = labelUnder(change.label, heading);
  const notes = notesChange(change);
  return (
    <li className="history-change">
      <p className="history-change__label">{label}</p>
      {notes && <NotesBeforeAfter label={label} before={notes.before} after={notes.after} beatsPerBar={beatsPerBar} />}
    </li>
  );
}

interface LyricsPartProps {
  change: SetChange;
}

/** The lyrics that changed: each old line struck through above the new one. */
function LyricsPart({ change }: LyricsPartProps) {
  const hunks = lyricsHunks(change);
  return (
    <section className="history-detail__part" aria-label={t("common.lyrics")}>
      <h3 className="history-detail__title">{t("common.lyrics")}</h3>
      <p className="history-change__label">{labelUnder(change.label, SAVED_LYRICS_HEADING)}</p>
      {hunks.map((hunk, index) => (
        <div key={index} className="history-lines">
          {hunk.removed.map((line, lineIndex) => (
            <del key={`removed-${lineIndex}`} className="history-lines__old">
              <span className="ode-visually-hidden">{t("history.previousLine")}</span>
              {line}
            </del>
          ))}
          {hunk.added.map((line, lineIndex) => (
            <ins key={`added-${lineIndex}`} className="history-lines__new">
              <span className="ode-visually-hidden">{t("history.currentLine")}</span>
              {line}
            </ins>
          ))}
        </div>
      ))}
    </section>
  );
}

interface NotesBeforeAfterProps {
  label: string;
  before?: Note[];
  after?: Note[];
  beatsPerBar: number | null;
}

/** The notes before and after on two rolls with the same rows and length, so they line up. */
function NotesBeforeAfter({ label, before, after, beatsPerBar }: NotesBeforeAfterProps) {
  const all = [...(before ?? []), ...(after ?? [])];
  const range = pitchRangeOf(all);
  const length = notesEnd(all);
  return (
    <div className="history-change__rolls">
      {before && (
        <figure className="history-change__roll">
          <figcaption className="history-change__caption">{t("common.before")}</figcaption>
          <PianoRoll label={t("history.notesBefore", { label: (label) })} notes={before} pitchRange={range} lengthBeats={length} beatsPerBar={beatsPerBar} />
        </figure>
      )}
      {after && (
        <figure className="history-change__roll">
          <figcaption className="history-change__caption">{t("common.after")}</figcaption>
          <PianoRoll label={t("history.notesAfter", { label: (label) })} notes={after} pitchRange={range} lengthBeats={length} beatsPerBar={beatsPerBar} />
        </figure>
      )}
    </div>
  );
}
