import { t } from "../shared/i18n";
import { BEAT_TOLERANCE, TAG_SEPARATOR, type ClipRef, type TrackRef } from "../shared/live";
import type { ClipInfo } from "../shared/live-ops";
import type { DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";

/** Live counts beats in quarter notes; a whole note is four of them. */
export const QUARTER_NOTES_PER_WHOLE_NOTE = 4;

export interface FoundClip {
  track: TrackSnapshot;
  clip: ClipInfo;
  /** True for an Arrangement clip (main lane or take lane), false for a Session clip. */
  arranged: boolean;
}

/** Finds tracks and clips in a snapshot by the references the tools use. */
export class SetLookup {
  constructor(readonly snapshot: SetSnapshot) {}

  /** Beats (quarter notes) in one bar of the Set's time signature. */
  get beatsPerBar(): number {
    if (!this.snapshot.signature) throw new Error(t("server.setLookup.theCurrentMeterIsUnavailableFromLive"));
    const { numerator, denominator } = this.snapshot.signature;
    return (numerator * QUARTER_NOTES_PER_WHOLE_NOTE) / denominator;
  }

  /** Regular tracks, then return tracks, then the Main track. */
  get allTracks(): TrackSnapshot[] {
    return [...this.snapshot.tracks, ...this.snapshot.returnTracks, this.snapshot.main];
  }

  /** True when the Set holds zero clips. */
  get isEmpty(): boolean {
    return this.allTracks.every((track) => SetLookup.clipsOf(track).length === 0);
  }

  track(ref: TrackRef): TrackSnapshot | undefined {
    if ("index" in ref) return this.snapshot.tracks[ref.index];
    if ("returnIndex" in ref) return this.snapshot.returnTracks[ref.returnIndex];
    if ("main" in ref) return this.snapshot.main;
    if ("tag" in ref) {
      const matches = this.allTracks.filter((track) => track.tag === ref.tag);
      if (matches.length > 1) throw new Error(t("server.setLookup.ambiguousTrackTaggedUseATrack", { tag: (ref.tag) }));
      return matches[0];
    }
    const names = this.allTracks.map((track) => {
      const suffix = track.tag === undefined ? "" : `${TAG_SEPARATOR}${track.tag}`;
      const plain = suffix && track.name.endsWith(suffix) ? track.name.slice(0, -suffix.length) : track.name;
      return { track, plain, full: `${plain}${suffix}` };
    });
    const full = names.filter(({ track, full }) => track.tag !== undefined && full === ref.name);
    const exact = full.length > 0 ? full : names.filter(({ plain, full }) => plain === ref.name || full === ref.name);
    const lower = ref.name.toLowerCase();
    const matches = exact.length > 0 ? exact : names.filter(({ plain, full }) => plain.toLowerCase() === lower || full.toLowerCase() === lower);
    if (matches.length > 1) throw new Error(t("server.setLookup.ambiguousTrackNamedUseATrack", { name: (ref.name) }));
    return matches[0]?.track;
  }


  clip(ref: ClipRef): FoundClip | undefined {
    if ("tag" in ref) {
      const matches = this.allTracks.flatMap((track) => [
        ...track.clipSlots.flatMap((slot) => slot.clip?.tag === ref.tag ? [{ track, clip: slot.clip, arranged: false }] : []),
        ...SetLookup.arrangedClips(track).filter((clip) => clip.tag === ref.tag).map((clip) => ({ track, clip, arranged: true })),
      ]);
      if (matches.length > 1) throw new Error(t("server.setLookup.ambiguousClipTaggedUseItsTrack", { tag: (ref.tag) }));
      return matches[0];
    }
    const track = this.track(ref.track);
    if (!track) return undefined;
    if ("slot" in ref) {
      const clip = track.clipSlots[ref.slot]?.clip;
      return clip ? { track, clip, arranged: false } : undefined;
    }
    const candidates = ref.lane === undefined ? track.arrangementClips : (track.takeLanes[ref.lane]?.clips ?? []);
    const clip = candidates.find((candidate) => Math.abs(candidate.startTime - ref.start) <= BEAT_TOLERANCE);
    return clip ? { track, clip, arranged: true } : undefined;
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
    if (!this.snapshot.signature) return t("server.setLookup.beats", { start: (start), end: (end) });
    const first = Math.floor(start / this.beatsPerBar + BEAT_TOLERANCE) + 1;
    const last = Math.max(first, Math.ceil(end / this.beatsPerBar - BEAT_TOLERANCE));
    return first === last ? t("server.setLookup.bar", { first: (first) }) : t("server.setLookup.bars", { first: (first), last: (last) });
  }

  /** "4 bars" for a length of whole bars, "6 beats" for any other length. */
  lengthLabel(beats: number): string {
    const bars = this.snapshot.signature ? beats / this.beatsPerBar : Number.NaN;
    if (Math.abs(bars - Math.round(bars)) <= BEAT_TOLERANCE && Math.round(bars) > 0) {
      const whole = Math.round(bars);
      return t("server.setLookup.barLength", { count: whole });
    }
    const rounded = Math.round(beats * 100) / 100;
    return t("server.setLookup.beatLength", { count: rounded });
  }
}
