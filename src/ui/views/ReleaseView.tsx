import { useCallback, useState } from "react";
import { COVER_CHOICE, COVER_FILE, type ReleaseResponse } from "../../shared/api";
import type { Credit } from "../../shared/song";
import { Button, ButtonVariant, IconButton, IconName, Notice, Panel, Tone, cx } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { formatBytes } from "../app/format";
import { useAppState, useClient, useReloadOnChange, useRequest } from "../app/hooks";
import { REQUESTS } from "../app/requests";
import "./views.css";

type ReleaseFile = ReleaseResponse["files"][number];

/** One of the cover art images Ode made, to pick from. */
interface CoverChoiceFile extends ReleaseFile {
  number: number;
}

const LYRIC_SHEET_FILE = "lyrics.txt";

export function ReleaseView() {
  const client = useClient();
  const song = useAppState((state) => state.song);
  const busy = useAppState((state) => state.busy);
  const loadFiles = useCallback(() => client.api.getRelease(), [client]);
  const release = useRequest(loadFiles);
  useReloadOnChange(busy, release.reload);
  const files = release.data?.files ?? [];
  const lyricSheetSize = files.find((file) => file.name === LYRIC_SHEET_FILE)?.size;

  const loadLyricSheet = useCallback(
    (): Promise<string | null> => (lyricSheetSize === undefined ? Promise.resolve(null) : client.api.getReleaseText(LYRIC_SHEET_FILE)),
    [client, lyricSheetSize],
  );
  const lyricSheet = useRequest(loadLyricSheet);
  const title = song?.title || "this song";

  return (
    <div className="view">
      <div className="view-toolbar">
        <p className="view-toolbar__text">Files are saved in the Ode folder of your Live project.</p>
        <IconButton icon={IconName.Refresh} label="Look for files again" onClick={release.reload} disabled={release.loading} />
        <Button variant={ButtonVariant.Primary} disabled={busy} onClick={() => void client.send(REQUESTS.prepareRelease)}>
          Prepare release files
        </Button>
      </div>
      {release.error && <Notice tone={Tone.Danger}>The release files couldn't be read: {release.error}</Notice>}
      <CoverArtPanel files={files} title={title} onChosen={release.setData} />
      <Panel title="Lyric sheet">
        {lyricSheet.error && <Notice tone={Tone.Warning}>The lyric sheet couldn't be read: {lyricSheet.error}</Notice>}
        {lyricSheet.data ? <pre className="lyric-sheet">{lyricSheet.data}</pre> : <p className="muted">No lyric sheet yet.</p>}
      </Panel>
      <Panel title="Credits">
        <CreditList credits={song?.credits ?? []} />
      </Panel>
      <Panel title="Files">
        {files.length === 0 ? (
          <p className="muted">No release files yet.</p>
        ) : (
          <ul className="plain-list">
            {files.map((file) => (
              <li key={file.name} className="list-row">
                <span className="list-row__main mono">{file.name}</span>
                <span className="muted small">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

interface CoverArtPanelProps {
  files: readonly ReleaseFile[];
  title: string;
  /** The release files after a choice was made the cover. */
  onChosen: (release: ReleaseResponse) => void;
}

/** The current cover, and Ode's choices to pick from when it made some. */
function CoverArtPanel({ files, title, onChosen }: CoverArtPanelProps) {
  const client = useClient();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  /** Changes each time a choice becomes the cover, so the new cover.png is loaded. */
  const [coverStamp, setCoverStamp] = useState(0);
  const cover = files.find((file) => file.name === COVER_FILE);
  const choices = coverChoices(files);

  const choose = async (name: string) => {
    setChoosing(name);
    try {
      onChosen(await client.api.chooseCover({ file: name }));
      setChosen(name);
      setCoverStamp((stamp) => stamp + 1);
    } catch (error) {
      client.store.setError(errorMessage(error));
    } finally {
      setChoosing(null);
    }
  };

  const coverImage = cover && (
    <img className="cover" src={`${client.api.releaseFileUrl(COVER_FILE)}?v=${cover.size}-${coverStamp}`} alt={`Cover art for ${title}`} />
  );

  if (choices.length === 0) {
    return <Panel title="Cover art">{coverImage ?? <p className="muted">No cover art yet.</p>}</Panel>;
  }

  return (
    <Panel title="Cover art">
      {coverImage ? (
        <figure className="cover-current">
          {coverImage}
          <figcaption className="muted small">Current cover</figcaption>
        </figure>
      ) : (
        <p className="muted">No cover chosen yet.</p>
      )}
      <p className="muted small">Tap one of Ode's choices to make it the cover.</p>
      <ul className="cover-choices" aria-label="Cover art choices">
        {choices.map((choice) => (
          <li key={choice.name}>
            <button
              type="button"
              className={cx("cover-choices__button", choice.name === chosen && "cover-choices__button--chosen")}
              aria-pressed={choice.name === chosen}
              aria-label={`Make choice ${choice.number} the cover`}
              title={`Make choice ${choice.number} the cover`}
              disabled={choosing !== null}
              onClick={() => void choose(choice.name)}
            >
              <img className="cover-choices__image" src={`${client.api.releaseFileUrl(choice.name)}?v=${choice.size}`} alt="" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function coverChoices(files: readonly ReleaseFile[]): CoverChoiceFile[] {
  const choices = files.flatMap((file) => {
    const match = COVER_CHOICE.exec(file.name);
    return match ? [{ ...file, number: Number(match[1]) }] : [];
  });
  return choices.sort((a, b) => a.number - b.number);
}

interface CreditListProps {
  credits: readonly Credit[];
}

function CreditList({ credits }: CreditListProps) {
  if (credits.length === 0) return <p className="muted">No credits yet. Tell Ode who wrote, produced and performed the song.</p>;
  return (
    <ul className="plain-list">
      {credits.map((credit, index) => (
        <li key={`${index}-${credit.role}`} className="list-row">
          <span className="list-row__main">{credit.name}</span>
          <span className="muted small">{credit.role}</span>
        </li>
      ))}
    </ul>
  );
}
