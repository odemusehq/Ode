import { useCallback } from "react";
import type { Credit } from "../../shared/song";
import { Button, ButtonVariant, IconButton, IconName, Notice, Panel, Tone } from "../../ui-kit";
import { formatBytes } from "../app/format";
import { useAppState, useClient, useRequest } from "../app/hooks";
import "./views.css";

const PREPARE_REQUEST = "Prepare the release files: cover art, lyric sheet and credits.";
const COVER_FILE = "cover.png";
const LYRIC_SHEET_FILE = "lyrics.txt";

export function ReleaseView() {
  const client = useClient();
  const song = useAppState((state) => state.song);
  const loadFiles = useCallback(() => client.api.getRelease(), [client]);
  const release = useRequest(loadFiles);
  const files = release.data?.files ?? [];
  const cover = files.find((file) => file.name === COVER_FILE);
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
        <Button variant={ButtonVariant.Primary} onClick={() => void client.ask(PREPARE_REQUEST)}>
          Prepare release files
        </Button>
      </div>
      {release.error && <Notice tone={Tone.Danger}>The release files couldn't be read: {release.error}</Notice>}
      <Panel title="Cover art">
        {cover ? (
          <img className="cover" src={`${client.api.releaseFileUrl(COVER_FILE)}?v=${cover.size}`} alt={`Cover art for ${title}`} />
        ) : (
          <p className="muted">No cover art yet.</p>
        )}
      </Panel>
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
