import { useCallback, useMemo, useState } from "react";
import type { TrackRef } from "../../shared/live";
import type { SongInfo, TrackInfo, TrackKind } from "../../shared/live-ops";
import { Badge, EmptyState, IconButton, IconName, Notice, Panel, Select, Tone } from "../../ui-kit";
import { useClient, useRequest } from "../app/hooks";
import { DeviceItem } from "./DeviceItem";
import "./views.css";

interface TrackOption {
  value: string;
  label: string;
  track: TrackRef;
}

const TRACK_KIND_LABELS: Record<TrackKind, string> = {
  midi: "MIDI",
  audio: "Audio",
  group: "Group",
  return: "Return",
  main: "Main",
};

export function SoundsView() {
  const client = useClient();
  const loadSong = useCallback(() => client.api.liveRead("song_get", {}), [client]);
  const song = useRequest(loadSong);
  const options = useMemo(() => (song.data ? trackOptions(song.data) : []), [song.data]);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];

  const loadTrack = useCallback(
    (): Promise<TrackInfo | null> => (selected ? client.api.liveRead("track_get", { track: selected.track }) : Promise.resolve(null)),
    [client, selected],
  );
  const track = useRequest(loadTrack);

  return (
    <div className="view">
      <div className="view-toolbar">
        <p className="view-toolbar__text">Tracks, their instruments and effects, as they are in Live.</p>
        <IconButton icon={IconName.Refresh} label="Read the Set again" onClick={song.reload} disabled={song.loading} />
      </div>
      {song.error && <Notice tone={Tone.Danger}>The Set couldn't be read: {song.error}</Notice>}
      {song.loading && !song.data && <p className="muted">Reading the Set…</p>}
      {selected && (
        <Select
          label="Track"
          value={selected.value}
          options={options}
          onChange={setSelectedValue}
        />
      )}
      {song.data && options.length === 0 && <EmptyState title="No tracks">This Set has no tracks yet.</EmptyState>}
      {track.error && <Notice tone={Tone.Danger}>The track couldn't be read: {track.error}</Notice>}
      {selected && track.data && <TrackPanel track={track.data} trackRef={selected.track} />}
    </div>
  );
}

interface TrackPanelProps {
  track: TrackInfo;
  trackRef: TrackRef;
}

function TrackPanel({ track, trackRef }: TrackPanelProps) {
  const sessionClips = track.clipSlots.filter((slot) => slot.clip !== null).length;
  return (
    <Panel title={track.name} actions={<TrackBadges track={track} />}>
      <p className="muted small">
        {sessionClips} clips in Session View · {track.arrangementClips.length} in Arrangement View
      </p>
      {track.devices.length === 0 ? (
        <p className="muted">No devices on this track.</p>
      ) : (
        <ol className="plain-list" aria-label="Devices in signal order">
          {track.devices.map((device) => (
            <li key={`${device.index}-${device.name}`}>
              <DeviceItem trackRef={trackRef} device={device} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

interface TrackBadgesProps {
  track: TrackInfo;
}

function TrackBadges({ track }: TrackBadgesProps) {
  return (
    <>
      <Badge>{TRACK_KIND_LABELS[track.kind]}</Badge>
      {track.mute && <Badge tone={Tone.Warning}>Muted</Badge>}
      {track.solo && <Badge tone={Tone.Info}>Solo</Badge>}
      {track.arm && <Badge tone={Tone.Danger}>Armed</Badge>}
    </>
  );
}

function trackOptions(song: SongInfo): TrackOption[] {
  const tracks = song.tracks.map((track) => ({
    value: `track-${track.index}`,
    label: `${track.index + 1} ${track.name}`,
    track: { index: track.index },
  }));
  const returns = song.returnTracks.map((track) => ({
    value: `return-${track.index}`,
    label: `${track.name} (return)`,
    track: { returnIndex: track.index },
  }));
  return [...tracks, ...returns, { value: "main", label: "Main", track: { main: true } }];
}
