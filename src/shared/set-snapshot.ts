// The whole project at one moment, built from the Set types the tools already use.
import type { ChainInfo, DeviceInfo, MixerInfo, SongInfo, TimeSignature, TrackInfo } from "./live-ops";
import type { LeadSheet } from "./song";

/** A device with its parameter values; a rack's chains hold full devices too. */
export interface DeviceSnapshot extends Omit<DeviceInfo, "chains"> {
  chains?: ChainSnapshot[];
}

export interface ChainSnapshot extends Omit<ChainInfo, "devices"> {
  devices: DeviceSnapshot[];
}

/** A track with its mixer and full devices. Its clips carry their notes (MIDI) or are AudioClipInfo (audio). */
export interface TrackSnapshot extends Omit<TrackInfo, "devices"> {
  mixer: MixerInfo;
  devices: DeviceSnapshot[];
}

/** What the extension reads in one pass. */
export interface SetContents {
  song: Omit<SongInfo, "tracks" | "returnTracks">;
  signature: TimeSignature;
  tracks: TrackSnapshot[];
  returnTracks: TrackSnapshot[];
  main: TrackSnapshot;
}

/**
 * The whole project at one moment, as the extension reads it, with the song's lead sheet (lyrics, chords, sections)
 * when it has one, so lyric edits are versioned too.
 */
export interface SetSnapshot extends SetContents {
  takenAt: string;
  sheet?: LeadSheet;
}
