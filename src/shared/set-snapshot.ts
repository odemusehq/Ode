// The whole project at one moment, built from the Set types the tools already use.
import type { ChainInfo, DeviceInfo, MixerInfo, SelectionInfo, SongInfo, TrackInfo, TransportState } from "./live-ops";
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
  tracks: TrackSnapshot[];
  returnTracks: TrackSnapshot[];
  main: TrackSnapshot;
}

/**
 * The whole project at one moment: the extension's reading plus the Ode device's transport and selection,
 * and the song's lead sheet (lyrics, chords, sections) when it has one, so lyric edits are versioned too.
 */
export interface SetSnapshot extends SetContents {
  takenAt: string;
  transport: TransportState;
  selection: SelectionInfo;
  sheet?: LeadSheet;
}

/** The Ode device's name in Live, as the Max for Live preset installs it. */
export const ODE_DEVICE_NAME = "Ode";
/** Live's class name for a Max for Live audio effect. */
export const MAX_AUDIO_EFFECT_CLASS = "MxDeviceAudioEffect";

/** True for the Ode device itself, which a restore must never remove, move or replace. */
export function isOdeDevice(device: Pick<DeviceSnapshot, "name" | "className">): boolean {
  return device.className === MAX_AUDIO_EFFECT_CLASS && device.name === ODE_DEVICE_NAME;
}
