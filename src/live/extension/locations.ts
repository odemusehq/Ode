import {
  Chain,
  ClipSlot,
  RackDevice,
  TakeLane,
  Track,
  type Clip,
  type DataModelObject,
  type Device,
} from "@ableton-extensions/sdk";
import type { ClipRef, DeviceRef } from "../../shared/live";
import type { LiveSet } from "./live-set";
import { indexOfObject, type Version } from "./sdk";
import type { TrackDirectory } from "./track-directory";

export enum ClipPlace {
  Session = "session",
  Arrangement = "arrangement",
}

/** Where a clip sits: in a clip slot in Session View, or in the Arrangement on the track's main lane or a take lane. */
export type ClipLocation =
  | {
      readonly place: ClipPlace.Session;
      readonly track: Track<Version>;
      readonly slot: number;
      readonly clipSlot: ClipSlot<Version>;
    }
  | {
      readonly place: ClipPlace.Arrangement;
      readonly track: Track<Version>;
      /** Take lane index, or null for the track's main lane. */
      readonly lane: number | null;
    };

export interface DeviceLocation {
  readonly track: Track<Version>;
  /** The racks around the device, from the outermost inwards. */
  readonly racks: readonly RackDevice<Version>[];
  readonly ref: DeviceRef;
}

interface Position {
  readonly track: Track<Version>;
  readonly index: number;
}

/** The reference Ode reports for a clip: its clip slot, or its track and start beat in the Arrangement. */
export function clipReference(clip: Clip<Version>, location: ClipLocation, tracks: TrackDirectory): ClipRef {
  const track = tracks.position(location.track).ref;
  return location.place === ClipPlace.Session ? { track, slot: location.slot } : { track, start: clip.startTime };
}

/** Finds where an object that Live handed over sits in the Set, by walking up its parents. */
export class LocationFinder {
  constructor(private readonly set: LiveSet) {}

  clip(clip: Clip<Version>): ClipLocation {
    const parent = clip.parent;
    if (parent instanceof ClipSlot) {
      const { track, index } = this.clipSlot(parent);
      return { place: ClipPlace.Session, track, slot: index, clipSlot: parent };
    }
    if (parent instanceof TakeLane) {
      const { track, index } = this.takeLane(parent);
      return { place: ClipPlace.Arrangement, track, lane: index };
    }
    if (parent instanceof Track) return { place: ClipPlace.Arrangement, track: parent, lane: null };
    throw new Error("Ode could not tell where this clip is");
  }

  clipSlot(clipSlot: ClipSlot<Version>): Position {
    const track = LocationFinder.track(clipSlot.parent);
    return { track, index: indexOfObject(track.clipSlots, clipSlot) };
  }

  takeLane(lane: TakeLane<Version>): Position {
    const track = LocationFinder.track(lane.parent);
    return { track, index: indexOfObject(track.takeLanes, lane) };
  }

  /** Builds the device's reference, with the rack and chain indexes of every rack around it. */
  device(device: Device<Version>, tracks: TrackDirectory = this.set.tracks()): DeviceLocation {
    const path: number[] = [];
    const racks: RackDevice<Version>[] = [];
    let container = device.parent;
    const index = LocationFinder.indexInContainer(container, device);
    while (container instanceof Chain) {
      const rack = container.parent;
      if (!(rack instanceof RackDevice)) throw new Error("Ode could not tell which rack holds this chain");
      const outer = rack.parent;
      path.unshift(LocationFinder.indexInContainer(outer, rack), indexOfObject(rack.chains, container));
      racks.unshift(rack);
      container = outer;
    }
    const track = LocationFinder.track(container);
    const trackRef = tracks.position(track).ref;
    return { track, racks, ref: path.length > 0 ? { track: trackRef, chain: path, index } : { track: trackRef, index } };
  }

  private static track(parent: DataModelObject<Version> | null): Track<Version> {
    if (parent instanceof Track) return parent;
    throw new Error("Ode could not tell which track this belongs to");
  }

  private static indexInContainer(container: DataModelObject<Version> | null, device: Device<Version>): number {
    if (container instanceof Track || container instanceof Chain) return indexOfObject(container.devices, device);
    throw new Error("Ode could not tell where this device is");
  }
}
