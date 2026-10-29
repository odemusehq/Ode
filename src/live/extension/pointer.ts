import { basename } from "node:path";
import {
  Clip,
  ClipSlot,
  DataModelObject,
  Device,
  Sample,
  Scene,
  Simpler,
  TakeLane,
  Track,
  type ArrangementSelection,
  type ClipSlotSelection,
  type ContextMenuScope,
  type Handle,
} from "@ableton-extensions/sdk";
import type { ClipSlotRef, LivePointer, TakeLaneRef } from "../../shared/live";
import { Labels } from "./labels";
import type { LiveSet } from "./live-set";
import { ClipPlace, clipReference, type ClipLocation, type DeviceLocation, type LocationFinder } from "./locations";
import type { Live, Version } from "./sdk";
import type { TrackDirectory } from "./track-directory";

type Scope = ContextMenuScope<Version>;

/** What a pointer says: plain words for the musician, and a target in the shape Ode's tools take. */
interface PointerParts {
  readonly description: string;
  readonly target: unknown;
}

/** Turns what the musician right-clicked into a pointer for Ode. */
export class PointerBuilder {
  constructor(
    private readonly live: Live,
    private readonly set: LiveSet,
    private readonly locations: LocationFinder,
  ) {}

  fromObject(scope: Scope, handle: Handle): LivePointer {
    const tracks = this.set.tracks();
    const object = this.live.getObjectFromHandle(handle, DataModelObject);
    return PointerBuilder.pointer(scope, this.describeObject(object, tracks, new Labels(tracks)));
  }

  fromClipSlots(scope: Scope, selection: ClipSlotSelection): LivePointer {
    const tracks = this.set.tracks();
    const labels = new Labels(tracks);
    const slots = selection.selected_clip_slots.map((handle) =>
      this.locations.clipSlot(this.live.getObjectFromHandle(handle, ClipSlot)),
    );
    const byTrack = new Map<bigint, { track: Track<Version>; numbers: number[] }>();
    for (const { track, index } of slots) {
      const entry = byTrack.get(track.handle.id) ?? { track, numbers: [] };
      entry.numbers.push(index + 1);
      byTrack.set(track.handle.id, entry);
    }
    const description = Labels.list(
      [...byTrack.values()].map(
        ({ track, numbers }) => `${numbers.length === 1 ? "clip slot" : "clip slots"} ${numbers.join(", ")} on ${labels.track(track)}`,
      ),
    );
    const refs: ClipSlotRef[] = slots.map(({ track, index }) => ({ track: tracks.position(track).ref, slot: index }));
    return PointerBuilder.pointer(scope, { description, target: { slots: refs } });
  }

  fromArrangement(scope: Scope, selection: ArrangementSelection): LivePointer {
    const tracks = this.set.tracks();
    const labels = new Labels(tracks);
    const { time_selection_start: start, time_selection_end: end } = selection;
    const selected = selection.selected_lanes.map((handle) => this.live.getObjectFromHandle(handle, DataModelObject));
    const selectedTracks = selected.filter((object): object is Track<Version> => object instanceof Track);
    const selectedLanes = selected
      .filter((object): object is TakeLane<Version> => object instanceof TakeLane)
      .map((lane) => ({ lane, ...this.locations.takeLane(lane) }));
    const where = [
      ...selectedTracks.map((track) => labels.track(track)),
      ...selectedLanes.map(({ lane, index, track }) => labels.takeLane(lane, index, track)),
    ];
    const lanes: TakeLaneRef[] = selectedLanes.map(({ track, index }) => ({ track: tracks.position(track).ref, lane: index }));
    return PointerBuilder.pointer(scope, {
      description: where.length > 0 ? `${Labels.beats(start, end)} on ${Labels.list(where)}` : Labels.beats(start, end),
      target: { tracks: selectedTracks.map((track) => tracks.position(track).ref), lanes, start, end },
    });
  }

  private describeObject(object: DataModelObject<Version>, tracks: TrackDirectory, labels: Labels): PointerParts {
    if (object instanceof Clip) return this.clip(object, tracks, labels);
    if (object instanceof Track) return { description: labels.track(object, true), target: { track: tracks.position(object).ref } };
    if (object instanceof ClipSlot) return this.clipSlot(object, tracks, labels);
    if (object instanceof Scene) return this.scene(object);
    if (object instanceof Sample) return this.sample(object, tracks, labels);
    if (object instanceof Device) return this.device(object, tracks, labels);
    throw new Error("Ode points only at tracks, clips, clip slots, scenes, devices and samples");
  }

  /** 'MIDI clip "Verse melody" on track 3 "Keys", beats 32–64'. */
  private clip(clip: Clip<Version>, tracks: TrackDirectory, labels: Labels): PointerParts {
    const location = this.locations.clip(clip);
    return {
      description: `${labels.clip(clip)} on ${labels.track(location.track)}, ${PointerBuilder.clipPlace(clip, location)}`,
      target: { clip: clipReference(clip, location, tracks) },
    };
  }

  private clipSlot(clipSlot: ClipSlot<Version>, tracks: TrackDirectory, labels: Labels): PointerParts {
    const { track, index } = this.locations.clipSlot(clipSlot);
    const clip = clipSlot.clip;
    const slot = `clip slot ${index + 1} on ${labels.track(track)}`;
    return {
      description: clip ? `${slot} (${labels.clip(clip)})` : `empty ${slot}`,
      target: { slot: { track: tracks.position(track).ref, slot: index } },
    };
  }

  private scene(scene: Scene<Version>): PointerParts {
    const index = this.set.sceneIndex(scene);
    return { description: `scene ${index + 1}${Labels.quoted(scene.name)}`, target: { scene: { index } } };
  }

  private sample(sample: Sample<Version>, tracks: TrackDirectory, labels: Labels): PointerParts {
    const simpler = sample.parent;
    if (!(simpler instanceof Simpler)) throw new Error("Ode is unsure which Simpler holds this sample");
    const location = this.locations.device(simpler, tracks);
    return {
      description: `sample "${basename(sample.filePath)}" in ${PointerBuilder.deviceWords(simpler, location, labels)}`,
      target: { device: location.ref, filePath: sample.filePath },
    };
  }

  private device(device: Device<Version>, tracks: TrackDirectory, labels: Labels): PointerParts {
    const location = this.locations.device(device, tracks);
    return { description: PointerBuilder.deviceWords(device, location, labels), target: { device: location.ref } };
  }

  /** 'Simpler "Kick" inside Drum Rack "808 Kit" on track 1 "Drums"'. */
  private static deviceWords(device: Device<Version>, location: DeviceLocation, labels: Labels): string {
    const rack = location.racks[location.racks.length - 1];
    return `${labels.device(device)}${rack ? ` inside ${labels.device(rack)}` : ""} on ${labels.track(location.track)}`;
  }

  private static clipPlace(clip: Clip<Version>, location: ClipLocation): string {
    if (location.place === ClipPlace.Session) return `clip slot ${location.slot + 1}`;
    const beats = Labels.beats(clip.startTime, clip.endTime);
    return location.lane === null ? beats : `take lane ${location.lane + 1}, ${beats}`;
  }

  private static pointer(scope: Scope, parts: PointerParts): LivePointer {
    return { scope, description: parts.description, target: parts.target, time: new Date().toISOString() };
  }
}
