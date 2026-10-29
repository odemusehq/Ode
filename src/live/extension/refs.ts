import {
  AudioClip,
  AudioTrack,
  Device,
  DrumRack,
  MidiClip,
  MidiTrack,
  RackDevice,
  Simpler,
  type Chain,
  type ChainMixer,
  type Clip,
  type ClipSlot,
  type CuePoint,
  type DeviceParameter,
  type Scene,
  type TakeLane,
  type Track,
  type TrackMixer,
} from "@ableton-extensions/sdk";
import type {
  ArrangementClipRef,
  ClipRef,
  ClipSlotRef,
  DeviceRef,
  LocatorRef,
  ParameterRef,
  SceneRef,
  TakeLaneRef,
  TrackRef,
} from "../../shared/live";
import { BEAT_TOLERANCE, MIXER_INDEX } from "../../shared/live";
import { NotFoundError } from "./errors";
import type { LiveSet } from "./live-set";
import { ClipPlace, type ClipLocation } from "./locations";
import type { Version } from "./sdk";
import { TaggedName } from "./tags";
import type { TrackDirectory } from "./track-directory";

const CHAIN_PATH_HELP =
  "a device's chain path lists pairs from the outer rack inwards: the rack's index, then the chain's index " +
  "(for example [1, 0] for chain 0 of the rack at index 1)";

export type DeviceContainer = Track<Version> | Chain<Version>;
export type ParameterSource = Device<Version> | TrackMixer<Version> | ChainMixer<Version>;

export interface FoundClipSlot {
  readonly track: Track<Version>;
  readonly clipSlot: ClipSlot<Version>;
  readonly index: number;
}

export interface FoundClip<C extends Clip<Version> = Clip<Version>> {
  readonly clip: C;
  readonly location: ClipLocation;
}

export interface FoundTakeLane {
  readonly track: Track<Version>;
  readonly lane: TakeLane<Version>;
  readonly index: number;
}

export interface FoundDevice {
  readonly device: Device<Version>;
  readonly container: DeviceContainer;
  readonly index: number;
}

export interface FoundParameter {
  readonly parameter: DeviceParameter<Version>;
  readonly index: number;
}

export interface FoundScene {
  readonly scene: Scene<Version>;
  readonly index: number;
}

export interface FoundLocator {
  readonly locator: CuePoint<Version>;
  readonly index: number;
}

interface ChainStep {
  readonly rack: number;
  readonly chain: number;
}

/** A device's parameters; a mixer's are volume (0), pan (1), then its sends. */
export function parametersOf(source: ParameterSource): DeviceParameter<Version>[] {
  return source instanceof Device ? source.parameters : [source.volume, source.panning, ...source.sends];
}

/** Finds the objects that Ode's references point at, at the moment of asking. */
export class ReferenceResolver {
  constructor(private readonly set: LiveSet) {}

  track(ref: TrackRef): Track<Version> {
    ReferenceResolver.expect(ref, "track");
    const track = ReferenceResolver.findTrack(this.set.tracks(), ref);
    if (!track) throw new NotFoundError(trackText(ref));
    return track;
  }

  midiTrack(ref: TrackRef): MidiTrack<Version> {
    const track = this.track(ref);
    if (!(track instanceof MidiTrack)) throw new Error(`${trackText(ref)} is not a MIDI track`);
    return track;
  }

  audioTrack(ref: TrackRef): AudioTrack<Version> {
    const track = this.track(ref);
    if (!(track instanceof AudioTrack)) throw new Error(`${trackText(ref)} is not an audio track`);
    return track;
  }

  clipSlot(ref: ClipSlotRef): FoundClipSlot {
    ReferenceResolver.expect(ref, "clip slot");
    const track = this.track(ref.track);
    const clipSlot = track.clipSlots[ref.slot];
    if (!clipSlot) throw new NotFoundError(clipSlotText(ref));
    return { track, clipSlot, index: ref.slot };
  }

  clip(ref: ClipRef): FoundClip {
    ReferenceResolver.expect(ref, "clip");
    if ("tag" in ref) return this.taggedClip(ref.tag);
    if ("slot" in ref) return this.sessionClip(ref);
    if ("start" in ref) return this.arrangementClip(ref);
    throw new Error(`not a clip reference: ${JSON.stringify(ref)}`);
  }

  midiClip(ref: ClipRef): FoundClip<MidiClip<Version>> {
    const { clip, location } = this.clip(ref);
    if (!(clip instanceof MidiClip)) throw new Error(`${clipText(ref)} is not a MIDI clip`);
    return { clip, location };
  }

  audioClip(ref: ClipRef): FoundClip<AudioClip<Version>> {
    const { clip, location } = this.clip(ref);
    if (!(clip instanceof AudioClip)) throw new Error(`${clipText(ref)} is not an audio clip`);
    return { clip, location };
  }

  takeLane(ref: TakeLaneRef): FoundTakeLane {
    ReferenceResolver.expect(ref, "take lane");
    const track = this.track(ref.track);
    const lane = track.takeLanes[ref.lane];
    if (!lane) throw new NotFoundError(takeLaneText(ref));
    return { track, lane, index: ref.lane };
  }

  /** The track or chain whose devices `ref.index` counts. */
  container(ref: DeviceRef): DeviceContainer {
    ReferenceResolver.expect(ref, "device");
    let container: DeviceContainer = this.track(ref.track);
    for (const step of ReferenceResolver.chainSteps(ref.chain)) {
      const rack = container.devices[step.rack];
      if (!(rack instanceof RackDevice)) throw new NotFoundError(`${deviceText(ref)} (there is no rack at index ${step.rack} on that path)`);
      const chain = rack.chains[step.chain];
      if (!chain) throw new NotFoundError(`${deviceText(ref)} (there is no chain at index ${step.chain} on that path)`);
      container = chain;
    }
    return container;
  }

  device(ref: DeviceRef): FoundDevice {
    const container = this.container(ref);
    if (ref.index === MIXER_INDEX) throw new Error(`${deviceText(ref)} is not a device; set its volume, pan and sends as parameters`);
    const device = container.devices[ref.index];
    if (!device) throw new NotFoundError(deviceText(ref));
    return { device, container, index: ref.index };
  }

  rack(ref: DeviceRef): RackDevice<Version> {
    const { device } = this.device(ref);
    if (!(device instanceof RackDevice)) throw new Error(`${deviceText(ref)} is not a rack`);
    return device;
  }

  drumRack(ref: DeviceRef): DrumRack<Version> {
    const { device } = this.device(ref);
    if (!(device instanceof DrumRack)) throw new Error(`${deviceText(ref)} is not a Drum Rack`);
    return device;
  }

  simpler(ref: DeviceRef): Simpler<Version> {
    const { device } = this.device(ref);
    if (!(device instanceof Simpler)) throw new Error(`${deviceText(ref)} is not a Simpler`);
    return device;
  }

  /** A device, or the mixer of a track or chain when the index is MIXER_INDEX. */
  parameterSource(ref: DeviceRef): ParameterSource {
    ReferenceResolver.expect(ref, "device");
    return ref.index === MIXER_INDEX ? this.container(ref).mixer : this.device(ref).device;
  }

  parameter(ref: ParameterRef): FoundParameter {
    ReferenceResolver.expect(ref, "parameter");
    const parameters = parametersOf(this.parameterSource(ref.device));
    const index =
      typeof ref.parameter === "number" ? ref.parameter : parameters.findIndex((parameter) => parameter.name === ref.parameter);
    const parameter = parameters[index];
    if (!parameter) throw new NotFoundError(parameterText(ref));
    return { parameter, index };
  }

  scene(ref: SceneRef): FoundScene {
    ReferenceResolver.expect(ref, "scene");
    const scenes = this.set.song.scenes;
    const index = "index" in ref ? ref.index : ReferenceResolver.indexByName(scenes, ref.name);
    const scene = scenes[index];
    if (!scene) throw new NotFoundError(sceneText(ref));
    return { scene, index };
  }

  locator(ref: LocatorRef): FoundLocator {
    ReferenceResolver.expect(ref, "locator");
    const locators = this.set.locators();
    let index: number;
    if ("index" in ref) index = ref.index;
    else if ("time" in ref) index = locators.findIndex((locator) => Math.abs(locator.time - ref.time) <= BEAT_TOLERANCE);
    else index = ReferenceResolver.indexByName(locators, ref.name);
    const locator = locators[index];
    if (!locator) throw new NotFoundError(locatorText(ref));
    return { locator, index };
  }

  private sessionClip(ref: ClipSlotRef): FoundClip {
    const { track, clipSlot, index } = this.clipSlot(ref);
    const clip = clipSlot.clip;
    if (!clip) throw new NotFoundError(clipText(ref));
    return { clip, location: { place: ClipPlace.Session, track, slot: index, clipSlot } };
  }

  /** The take lane the reference names; with no lane, the track's main lane first, then its take lanes. */
  private arrangementClip(ref: ArrangementClipRef): FoundClip {
    const track = this.track(ref.track);
    const startsThere = (clip: Clip<Version>) => Math.abs(clip.startTime - ref.start) <= BEAT_TOLERANCE;
    if (ref.lane !== undefined) {
      const take = track.takeLanes[ref.lane]?.clips.find(startsThere);
      if (take) return { clip: take, location: { place: ClipPlace.Arrangement, track, lane: ref.lane } };
      throw new NotFoundError(clipText(ref));
    }
    const clip = track.arrangementClips.find(startsThere);
    if (clip) return { clip, location: { place: ClipPlace.Arrangement, track, lane: null } };
    for (const [lane, takeLane] of track.takeLanes.entries()) {
      const take = takeLane.clips.find(startsThere);
      if (take) return { clip: take, location: { place: ClipPlace.Arrangement, track, lane } };
    }
    throw new NotFoundError(clipText(ref));
  }

  /** Session clips, Arrangement clips and take-lane clips of every MIDI and audio track. */
  private taggedClip(tag: string): FoundClip {
    for (const track of this.set.song.tracks) {
      if (!(track instanceof MidiTrack || track instanceof AudioTrack)) continue;
      const found = ReferenceResolver.taggedClipOn(track, tag);
      if (found) return found;
    }
    throw new NotFoundError(clipText({ tag }));
  }

  private static taggedClipOn(track: Track<Version>, tag: string): FoundClip | undefined {
    const tagged = (clip: Clip<Version>) => TaggedName.carries(clip.name, tag);
    for (const [slot, clipSlot] of track.clipSlots.entries()) {
      const clip = clipSlot.clip;
      if (clip && tagged(clip)) return { clip, location: { place: ClipPlace.Session, track, slot, clipSlot } };
    }
    const clip = track.arrangementClips.find(tagged);
    if (clip) return { clip, location: { place: ClipPlace.Arrangement, track, lane: null } };
    for (const [lane, takeLane] of track.takeLanes.entries()) {
      const take = takeLane.clips.find(tagged);
      if (take) return { clip: take, location: { place: ClipPlace.Arrangement, track, lane } };
    }
    return undefined;
  }

  private static findTrack(tracks: TrackDirectory, ref: TrackRef): Track<Version> | undefined {
    if ("index" in ref) return tracks.regular[ref.index];
    if ("returnIndex" in ref) return tracks.returns[ref.returnIndex];
    if ("main" in ref) return tracks.main;
    if ("tag" in ref) return tracks.all.find((track) => TaggedName.carries(track.name, ref.tag));
    if ("name" in ref) {
      const all = tracks.all;
      return all[ReferenceResolver.indexByName(all, ref.name)];
    }
    throw new Error(`not a track reference: ${JSON.stringify(ref)}`);
  }

  /** The item whose name, with or without Ode's tag, is `name`: an exact match first, then one ignoring case. */
  private static indexByName(items: readonly { name: string }[], name: string): number {
    const names = items.map((item) => {
      const fullName = item.name;
      return { fullName, plain: TaggedName.parse(fullName).name };
    });
    const exact = names.findIndex(({ fullName, plain }) => fullName === name || plain === name);
    if (exact >= 0) return exact;
    const lower = name.toLowerCase();
    return names.findIndex(({ fullName, plain }) => fullName.toLowerCase() === lower || plain.toLowerCase() === lower);
  }

  private static chainSteps(path: readonly number[] | undefined): ChainStep[] {
    if (path === undefined || path === null) return [];
    if (!Array.isArray(path) || path.length % 2 !== 0) throw new Error(CHAIN_PATH_HELP);
    const steps: ChainStep[] = [];
    for (let at = 0; at < path.length; at += 2) steps.push({ rack: path[at]!, chain: path[at + 1]! });
    return steps;
  }

  private static expect(ref: unknown, kind: string): void {
    if (typeof ref !== "object" || ref === null) throw new TypeError(`expected a ${kind} reference, got ${JSON.stringify(ref)}`);
  }
}

export function trackText(ref: TrackRef): string {
  if ("index" in ref) return `track at index ${ref.index}`;
  if ("returnIndex" in ref) return `return track at index ${ref.returnIndex}`;
  if ("main" in ref) return "the main track";
  if ("tag" in ref) return `track tagged "${ref.tag}"`;
  return `track named "${ref.name}"`;
}

export function clipSlotText(ref: ClipSlotRef): string {
  return `clip slot at index ${ref.slot} on ${trackText(ref.track)}`;
}

export function clipText(ref: ClipRef): string {
  if ("tag" in ref) return `clip tagged "${ref.tag}"`;
  if ("slot" in ref) return `clip in ${clipSlotText(ref)}`;
  return `Arrangement clip at beat ${ref.start} on ${trackText(ref.track)}`;
}

export function takeLaneText(ref: TakeLaneRef): string {
  return `take lane at index ${ref.lane} on ${trackText(ref.track)}`;
}

export function deviceText(ref: DeviceRef): string {
  const path = ref.chain ?? [];
  let where = trackText(ref.track);
  for (let at = 0; at + 1 < path.length; at += 2) {
    where = `chain at index ${path[at + 1]} of device at index ${path[at]} ${at === 0 ? "on" : "in"} ${where}`;
  }
  if (ref.index === MIXER_INDEX) return `the mixer of ${where}`;
  return `device at index ${ref.index} ${path.length > 1 ? "in" : "on"} ${where}`;
}

export function parameterText(ref: ParameterRef): string {
  const which = typeof ref.parameter === "number" ? `parameter at index ${ref.parameter}` : `parameter "${ref.parameter}"`;
  return `${which} of ${deviceText(ref.device)}`;
}

export function sceneText(ref: SceneRef): string {
  return "index" in ref ? `scene at index ${ref.index}` : `scene named "${ref.name}"`;
}

export function locatorText(ref: LocatorRef): string {
  if ("index" in ref) return `locator at index ${ref.index}`;
  if ("time" in ref) return `locator at beat ${ref.time}`;
  return `locator named "${ref.name}"`;
}
