import type { ClipRef, TrackRef } from "../shared/live";
import type { ClipInfo } from "../shared/live-ops";
import type { DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import { TrackList, type ClipKey, type TrackKey } from "../shared/versions";

/** Live counts beats in quarter notes; a whole note is four of them. */
export const QUARTER_NOTES_PER_WHOLE_NOTE = 4;

/** How far apart two positions in beats can be and still count as the same (as the extension compares them). */
export const BEAT_TOLERANCE = 0.001;

export interface FoundClip {
  track: TrackSnapshot;
  clip: ClipInfo;
  /** True for an Arrangement clip (main lane or take lane), false for a Session clip. */
  arranged: boolean;
}

/** Finds tracks and clips in a snapshot by the references the tools and the device use. */
export class SetLookup {
  constructor(readonly snapshot: SetSnapshot) {}

  /** Beats (quarter notes) in one bar of the Set's time signature. */
  get beatsPerBar(): number {
    const { numerator, denominator } = this.snapshot.signature;
    return (numerator * QUARTER_NOTES_PER_WHOLE_NOTE) / denominator;
  }

  /** Regular tracks, then return tracks, then the Main track. */
  get allTracks(): TrackSnapshot[] {
    return [...this.snapshot.tracks, ...this.snapshot.returnTracks, this.snapshot.main];
  }

  /** True when the Set holds no clips at all. */
  get isEmpty(): boolean {
    return this.allTracks.every((track) => SetLookup.clipsOf(track).length === 0);
  }

  track(ref: TrackRef): TrackSnapshot | undefined {
    if ("index" in ref) return this.snapshot.tracks[ref.index];
    if ("returnIndex" in ref) return this.snapshot.returnTracks[ref.returnIndex];
    if ("main" in ref) return this.snapshot.main;
    if ("tag" in ref) return this.allTracks.find((track) => track.tag === ref.tag);
    const lower = ref.name.toLowerCase();
    return this.allTracks.find((track) => track.name === ref.name) ?? this.allTracks.find((track) => track.name.toLowerCase() === lower);
  }

  /** A track from a version's change: by its tag, then by its place when the name still matches, then by name. */
  trackByKey(key: TrackKey): TrackSnapshot | undefined {
    if (key.tag) {
      const tagged = this.allTracks.find((track) => track.tag === key.tag);
      if (tagged) return tagged;
    }
    const list = key.list === TrackList.Main ? [this.snapshot.main] : key.list === TrackList.Returns ? this.snapshot.returnTracks : this.snapshot.tracks;
    const placed = key.list === TrackList.Main ? this.snapshot.main : list[key.index];
    if (placed && placed.name === key.name) return placed;
    return list.find((track) => track.name === key.name);
  }

  clip(ref: ClipRef): FoundClip | undefined {
    if ("tag" in ref) {
      for (const track of this.allTracks) {
        const session = track.clipSlots.find((slot) => slot.clip?.tag === ref.tag)?.clip;
        if (session) return { track, clip: session, arranged: false };
        const arranged = SetLookup.arrangedClips(track).find((clip) => clip.tag === ref.tag);
        if (arranged) return { track, clip: arranged, arranged: true };
      }
      return undefined;
    }
    const track = this.track(ref.track);
    if (!track) return undefined;
    if ("slot" in ref) {
      const clip = track.clipSlots[ref.slot]?.clip;
      return clip ? { track, clip, arranged: false } : undefined;
    }
    const clip = SetLookup.arrangedClips(track).find((candidate) => Math.abs(candidate.startTime - ref.start) <= BEAT_TOLERANCE);
    return clip ? { track, clip, arranged: true } : undefined;
  }

  /** A track by its place in this snapshot, as a version's change addresses what was removed or changed. */
  trackAt(key: TrackKey): TrackSnapshot | undefined {
    if (key.list === TrackList.Main) return this.snapshot.main;
    return key.list === TrackList.Returns ? this.snapshot.returnTracks[key.index] : this.snapshot.tracks[key.index];
  }

  /** A device on a track, or inside racks along `chain` (pairs of rack device index and chain index, from the track inwards). */
  static deviceAt(track: TrackSnapshot, chain: readonly number[], index: number): DeviceSnapshot | undefined {
    let devices: DeviceSnapshot[] = track.devices;
    for (let step = 0; step + 1 < chain.length; step += 2) {
      const rack = chain[step];
      const inner = chain[step + 1];
      const next = rack === undefined || inner === undefined ? undefined : devices[rack]?.chains?.[inner];
      if (!next) return undefined;
      devices = next.devices;
    }
    return devices[index];
  }

  /** Every device on a track, with the devices inside its racks. */
  static devicesOf(track: TrackSnapshot): DeviceSnapshot[] {
    return SetLookup.withInnerDevices(track.devices);
  }

  private static withInnerDevices(devices: DeviceSnapshot[]): DeviceSnapshot[] {
    return devices.flatMap((device) => [device, ...(device.chains ?? []).flatMap((chain) => SetLookup.withInnerDevices(chain.devices))]);
  }

  /** The clip a version's change points at on a track. */
  static clipAt(track: TrackSnapshot, key: ClipKey): ClipInfo | undefined {
    if ("slot" in key) return track.clipSlots[key.slot]?.clip ?? undefined;
    const clips = key.lane === undefined ? track.arrangementClips : track.takeLanes[key.lane]?.clips ?? [];
    return clips.find((clip) => Math.abs(clip.startTime - key.start) <= BEAT_TOLERANCE);
  }

  /** Clips on the Arrangement's main lane, then on the take lanes. */
  static arrangedClips(track: TrackSnapshot): ClipInfo[] {
    return [...track.arrangementClips, ...track.takeLanes.flatMap((lane) => lane.clips)];
  }

  /** Every clip on a track: Session clips, then Arrangement clips. */
  static clipsOf(track: TrackSnapshot): ClipInfo[] {
    const session = track.clipSlots.flatMap((slot) => (slot.clip ? [slot.clip] : []));
    return [...session, ...SetLookup.arrangedClips(track)];
  }

  /** "bars 9–16" for an Arrangement span in beats ("bar 9" when it fits in one). */
  barsLabel(start: number, end: number): string {
    const first = Math.floor(start / this.beatsPerBar + BEAT_TOLERANCE) + 1;
    const last = Math.max(first, Math.ceil(end / this.beatsPerBar - BEAT_TOLERANCE));
    return first === last ? `bar ${first}` : `bars ${first}–${last}`;
  }

  /** "4 bars" for a length in beats, or "6 beats" when it isn't a whole number of bars. */
  lengthLabel(beats: number): string {
    const bars = beats / this.beatsPerBar;
    if (Math.abs(bars - Math.round(bars)) <= BEAT_TOLERANCE && Math.round(bars) > 0) {
      const whole = Math.round(bars);
      return `${whole} ${whole === 1 ? "bar" : "bars"}`;
    }
    const rounded = Math.round(beats * 100) / 100;
    return `${rounded} ${rounded === 1 ? "beat" : "beats"}`;
  }
}
