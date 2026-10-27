import { useCallback, useMemo, useState } from "react";
import type { ClipRef, Note } from "../../shared/live";
import type { ClipInfo } from "../../shared/live-ops";
import type { LyricsAnalysis } from "../../shared/lyrics";
import type { Section } from "../../shared/song";
import { EmptyState, IconButton, IconName, Notice, PianoRoll, Select, Tone } from "../../ui-kit";
import type { SelectOption } from "../../ui-kit";
import type { OdeApi } from "../app/api";
import { beatsPerBar } from "../app/format";
import { useAppState, useClient, useRequest } from "../app/hooks";
import { pointedClip } from "../app/live-refs";
import { alignSyllables } from "./align-lyrics";
import "./views.css";

interface LoadedClip {
  notes: Note[];
  info: ClipInfo | null;
}

const NO_LYRICS = "none";

export function PianoRollView() {
  const client = useClient();
  const pointer = useAppState((state) => state.pointer);
  const song = useAppState((state) => state.song);
  const pointed = useMemo(() => pointedClip(pointer), [pointer]);
  const [lyricsSectionId, setLyricsSectionId] = useState(NO_LYRICS);

  const loadNotes = useCallback(
    (): Promise<LoadedClip | null> => (pointed && !pointed.audio ? loadClip(client.api, pointed.clip) : Promise.resolve(null)),
    [client, pointed],
  );
  const clip = useRequest(loadNotes);

  const section = song?.sections.find((candidate) => candidate.id === lyricsSectionId);
  const loadLyrics = useCallback(
    (): Promise<LyricsAnalysis | null> =>
      section ? client.api.analyzeLyrics({ lines: section.lines.map((line) => line.text) }) : Promise.resolve(null),
    [client, section],
  );
  const lyrics = useRequest(loadLyrics);
  const notes = clip.data?.notes;
  const analysis = lyrics.data;
  const marks = useMemo(() => (notes && analysis ? alignSyllables(notes, analysis) : undefined), [notes, analysis]);

  if (!pointed) {
    return (
      <div className="view">
        <EmptyState title="No clip yet">Right-click a MIDI clip in Live and choose Ask Ode to see its notes here.</EmptyState>
      </div>
    );
  }

  if (pointed.audio) {
    return (
      <div className="view">
        <Notice>{pointed.description} is an audio clip. The piano roll shows MIDI clips.</Notice>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-toolbar">
        <h2 className="view-title view-toolbar__grow">{clip.data?.info?.name || pointed.description}</h2>
        <IconButton icon={IconName.Refresh} label="Reload notes" onClick={clip.reload} disabled={clip.loading} />
      </div>
      <Select
        label="Lyrics under the notes"
        value={lyricsSectionId}
        options={lyricsOptions(song?.sections ?? [])}
        onChange={setLyricsSectionId}
        hint="Syllables are placed on the notes in order, one per note."
      />
      {clip.error && <Notice tone={Tone.Danger}>The notes couldn't be read: {clip.error}</Notice>}
      {lyrics.error && <Notice tone={Tone.Warning}>The lyrics couldn't be checked: {lyrics.error}</Notice>}
      {clip.loading && !notes && <p className="muted">Reading the clip…</p>}
      {notes && (
        <PianoRoll
          label={`Notes of ${clip.data?.info?.name || pointed.description}`}
          notes={notes}
          lyrics={marks}
          beatsPerBar={beatsPerBar(song)}
          lengthBeats={clip.data?.info?.duration ?? 0}
        />
      )}
    </div>
  );
}

async function loadClip(api: OdeApi, clip: ClipRef): Promise<LoadedClip> {
  const [notes, info] = await Promise.all([
    api.liveRead("midi_clip_get_notes", { clip }),
    api.liveRead("clip_get", { clip }).catch(() => null),
  ]);
  return { notes: notes.notes, info };
}

function lyricsOptions(sections: readonly Section[]): SelectOption<string>[] {
  return [{ value: NO_LYRICS, label: "None" }, ...sections.map((section) => ({ value: section.id, label: section.name }))];
}
