// The whole project at one moment, built from the Set types the tools already use.
import type { ChainInfo, DeviceInfo, MixerInfo, SongInfo, TimeSignature, TrackInfo } from "./live-ops";
import type { LeadSheet } from "./song";

/** A device with its parameter values; a rack's chains hold full devices too. */
export interface DeviceSnapshot extends Omit<DeviceInfo, "chains"> {
  chains?: ChainSnapshot[];
}

/** Numeric parameter addresses are compatible only while the controls and their ranges still match. */
export function sameDeviceParameters(before: DeviceSnapshot, after: DeviceSnapshot): boolean {
  return before.className === after.className && before.parameters.length === after.parameters.length &&
    before.parameters.every((parameter, index) => {
      const next = after.parameters[index];
      return next !== undefined && parameter.index === next.index && parameter.name === next.name &&
        parameter.min === next.min && parameter.max === next.max && parameter.isQuantized === next.isQuantized &&
        JSON.stringify(parameter.valueItems) === JSON.stringify(next.valueItems);
    });
}

export interface ChainSnapshot extends Omit<ChainInfo, "devices"> {
  devices: DeviceSnapshot[];
  /** Absent in histories recorded before chain mixers were captured. */
  mixer?: MixerInfo;
}

/** A track with its mixer and full devices. Its clips carry their notes (MIDI) or are AudioClipInfo (audio). */
export interface TrackSnapshot extends Omit<TrackInfo, "devices"> {
  mixer: MixerInfo;
  devices: DeviceSnapshot[];
}

/** What the extension reads in one pass. */
export interface SetContents {
  song: Omit<SongInfo, "tracks" | "returnTracks">;
  /** null: the installed SDK cannot read the current global meter. Scene overrides are separate. */
  signature: TimeSignature | null;
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
