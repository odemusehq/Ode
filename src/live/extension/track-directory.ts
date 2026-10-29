import { AudioTrack, MidiTrack, type Song, type Track } from "@ableton-extensions/sdk";
import type { TrackRef } from "../../shared/live";
import type { TrackKind } from "../../shared/live-ops";
import type { Version } from "./sdk";

/** The lists Live keeps tracks in. */
enum TrackList {
  Regular = "regular",
  Return = "return",
  Main = "main",
}

/** Where a track is in the Set, and the reference Ode reports for it. */
export interface TrackPosition {
  readonly kind: TrackKind;
  /** Index among the regular tracks or among the return tracks; 0 for the main track. */
  readonly index: number;
  readonly ref: TrackRef;
}

interface Place {
  readonly list: TrackList;
  readonly index: number;
}

/** The tracks of the Set at one moment: regular tracks, return tracks and the main track. */
export class TrackDirectory {
  readonly regular: readonly Track<Version>[];
  readonly returns: readonly Track<Version>[];
  readonly main: Track<Version>;
  private readonly places = new Map<bigint, Place>();
  private groups: ReadonlySet<bigint> | undefined;

  constructor(song: Song<Version>) {
    this.regular = song.tracks;
    this.returns = song.returnTracks;
    this.main = song.mainTrack;
    this.regular.forEach((track, index) => this.places.set(track.handle.id, { list: TrackList.Regular, index }));
    this.returns.forEach((track, index) => this.places.set(track.handle.id, { list: TrackList.Return, index }));
    this.places.set(this.main.handle.id, { list: TrackList.Main, index: 0 });
  }

  /** Every track: regular tracks, then return tracks, then the main track. */
  get all(): Track<Version>[] {
    return [...this.regular, ...this.returns, this.main];
  }

  position(track: Track<Version>): TrackPosition {
    const place = this.places.get(track.handle.id);
    if (!place) throw new Error("this track was removed from the Set");
    switch (place.list) {
      case TrackList.Regular:
        return { kind: this.regularKind(track), index: place.index, ref: { index: place.index } };
      case TrackList.Return:
        return { kind: "return", index: place.index, ref: { returnIndex: place.index } };
      case TrackList.Main:
        return { kind: "main", index: 0, ref: { main: true } };
    }
  }

  /** Group tracks are the tracks that other tracks name as their group. */
  private regularKind(track: Track<Version>): TrackKind {
    this.groups ??= new Set(
      this.regular.flatMap((member) => {
        const group = member.groupTrack;
        return group ? [group.handle.id] : [];
      }),
    );
    if (this.groups.has(track.handle.id)) return "group";
    if (track instanceof MidiTrack) return "midi";
    if (track instanceof AudioTrack) return "audio";
    return "group";
  }
}
