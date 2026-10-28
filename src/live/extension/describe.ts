import {
  AudioClip,
  Device,
  DrumChain,
  MidiClip,
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
  AudioClipInfo,
  ChainInfo,
  ClipInfo,
  ClipSlotInfo,
  DeviceInfo,
  DeviceSummary,
  LocatorInfo,
  MixerInfo,
  ParameterInfo,
  SceneInfo,
  SongInfo,
  TakeLaneInfo,
  TrackInfo,
  TrackSummary,
} from "../../shared/live-ops";
import type { LiveSet } from "./live-set";
import { ClipPlace, clipReference, type ClipLocation } from "./locations";
import { fromLiveNotes } from "./notes";
import { parametersOf, type ParameterSource } from "./refs";
import type { Version } from "./sdk";
import { TaggedName } from "./tags";
import type { TrackDirectory } from "./track-directory";

/** The name Ode reports for the mixer of a track or chain. */
const MIXER_NAME = "Mixer";

/** The Extensions SDK can't read a track's colour, so tracks report this instead of an RGB number. */
const UNKNOWN_TRACK_COLOR = -1;

/** Turns Live objects into the plain data that Ode's server works with. */
export class Describer {
  constructor(private readonly set: LiveSet) {}

  song(): SongInfo {
    const tracks = this.set.tracks();
    return {
      ...this.songWithoutTracks(),
      tracks: tracks.regular.map((track) => this.trackSummary(track, tracks)),
      returnTracks: tracks.returns.map((track) => this.trackSummary(track, tracks)),
    };
  }

  /** Tempo, grid, key and scale, scenes and locators. */
  songWithoutTracks(): Omit<SongInfo, "tracks" | "returnTracks"> {
    const song = this.set.song;
    return {
      tempo: song.tempo,
      gridQuantization: song.gridQuantization,
      gridIsTriplet: song.gridIsTriplet,
      rootNote: song.rootNote,
      scaleName: song.scaleName,
      scaleMode: song.scaleMode,
      scaleIntervals: song.scaleIntervals,
      scenes: song.scenes.map((scene, index) => this.scene(scene, index)),
      locators: this.set.locators().map((locator, index) => this.locator(locator, index)),
    };
  }

  trackSummary(track: Track<Version>, tracks: TrackDirectory = this.set.tracks()): TrackSummary {
    return { ...this.trackHeader(track, tracks), devices: track.devices.map((device, index) => this.deviceSummary(device, index)) };
  }

  /** What a track's header shows: its name, kind, colour, mute, solo and arm. */
  trackHeader(track: Track<Version>, tracks: TrackDirectory = this.set.tracks()): Omit<TrackSummary, "devices"> {
    const position = tracks.position(track);
    const { name, tag } = TaggedName.parse(track.name);
    return {
      index: position.index,
      name,
      kind: position.kind,
      tag,
      color: UNKNOWN_TRACK_COLOR,
      mute: Describer.safely(() => track.mute, false),
      solo: Describer.safely(() => track.solo, false),
      arm: Describer.safely(() => track.arm, false),
    };
  }

  track(track: Track<Version>): TrackInfo {
    const tracks = this.set.tracks();
    return {
      ...this.trackSummary(track, tracks),
      mutedViaSolo: Describer.safely(() => track.mutedViaSolo, false),
      groupTrack: this.groupTrackIndex(track, tracks),
      clipSlots: Describer.safely(() => track.clipSlots, []).map((clipSlot, index) =>
        this.clipSlot(track, clipSlot, index, tracks),
      ),
      arrangementClips: Describer.safely(() => track.arrangementClips, []).map((clip) =>
        this.clip(clip, { place: ClipPlace.Arrangement, track, lane: null }, tracks),
      ),
      takeLanes: Describer.safely(() => track.takeLanes, []).map((lane, index) => this.takeLane(track, lane, index, tracks)),
    };
  }

  /** Index of the group track that holds `track`, or null when it isn't in a group. */
  groupTrackIndex(track: Track<Version>, tracks: TrackDirectory = this.set.tracks()): number | null {
    const group = Describer.safely(() => track.groupTrack, null);
    return group ? tracks.position(group).index : null;
  }

  clip(clip: Clip<Version>, location: ClipLocation, tracks: TrackDirectory = this.set.tracks()): ClipInfo {
    const { name, tag } = TaggedName.parse(clip.name);
    return {
      ref: clipReference(clip, location, tracks),
      kind: clip instanceof MidiClip ? "midi" : "audio",
      name,
      tag,
      color: clip.color,
      muted: clip.muted,
      startTime: clip.startTime,
      endTime: clip.endTime,
      duration: clip.duration,
      startMarker: clip.startMarker,
      endMarker: clip.endMarker,
      looping: clip.looping,
      loopStart: clip.loopStart,
      loopEnd: clip.loopEnd,
    };
  }

  /** A clip with what it holds: a MIDI clip's notes, or an audio clip's file and warping. */
  clipWithContents(clip: Clip<Version>, location: ClipLocation, tracks: TrackDirectory = this.set.tracks()): ClipInfo {
    if (clip instanceof MidiClip) return { ...this.clip(clip, location, tracks), notes: fromLiveNotes(clip.notes) };
    if (clip instanceof AudioClip) return this.audioClip(clip, location, tracks);
    return this.clip(clip, location, tracks);
  }

  audioClip(clip: AudioClip<Version>, location: ClipLocation, tracks: TrackDirectory = this.set.tracks()): AudioClipInfo {
    return {
      ...this.clip(clip, location, tracks),
      filePath: clip.filePath,
      warping: clip.warping,
      warpMode: clip.warpMode,
      warpMarkers: clip.warpMarkers.map(({ sampleTime, beatTime }) => ({ sampleTime, beatTime })),
    };
  }

  clipSlot(
    track: Track<Version>,
    clipSlot: ClipSlot<Version>,
    index: number,
    tracks: TrackDirectory = this.set.tracks(),
  ): ClipSlotInfo {
    const clip = clipSlot.clip;
    const location: ClipLocation = { place: ClipPlace.Session, track, slot: index, clipSlot };
    return { slot: index, clip: clip ? this.clip(clip, location, tracks) : null };
  }

  takeLane(
    track: Track<Version>,
    lane: TakeLane<Version>,
    index: number,
    tracks: TrackDirectory = this.set.tracks(),
  ): TakeLaneInfo {
    return {
      lane: index,
      name: lane.name,
      clips: lane.clips.map((clip) => this.clip(clip, { place: ClipPlace.Arrangement, track, lane: index }, tracks)),
    };
  }

  deviceSummary(device: Device<Version>, index: number): DeviceSummary {
    return { index, name: device.name, className: Describer.className(device), isRack: device instanceof RackDevice };
  }

  /** Parameter values are read only when `withValues` is true. */
  async device(source: ParameterSource, index: number, withValues: boolean): Promise<DeviceInfo> {
    const parameters = await Promise.all(
      parametersOf(source).map((parameter, at) => this.parameter(parameter, at, withValues)),
    );
    if (!(source instanceof Device)) {
      return { index, name: MIXER_NAME, className: Describer.className(source), isRack: false, parameters };
    }
    const info: DeviceInfo = { ...this.deviceSummary(source, index), parameters };
    if (source instanceof RackDevice) info.chains = source.chains.map((chain, at) => this.chain(chain, at));
    if (source instanceof Simpler) info.sample = source.sample?.filePath ?? null;
    return info;
  }

  async parameter(parameter: DeviceParameter<Version>, index: number, withValue: boolean): Promise<ParameterInfo> {
    const info = this.parameterDetails(parameter, index);
    if (withValue) info.value = await parameter.getValue();
    return info;
  }

  /** A parameter's name, range, default and value items, without its value. */
  parameterDetails(parameter: DeviceParameter<Version>, index: number): ParameterInfo {
    return {
      index,
      name: parameter.name,
      min: parameter.min,
      max: parameter.max,
      isQuantized: parameter.isQuantized,
      defaultValue: parameter.defaultValue,
      valueItems: parameter.valueItems.map((item) => item.name),
    };
  }

  /** Numbered like parametersOf: volume 0, pan 1, then the sends. Every parameter is found before any value is read. */
  async mixer(mixer: TrackMixer<Version> | ChainMixer<Version>): Promise<MixerInfo> {
    const { volume, panning, sends } = mixer;
    const [volumeInfo, panningInfo, sendInfos] = await Promise.all([
      this.parameter(volume, 0, true),
      this.parameter(panning, 1, true),
      Promise.all(sends.map((send, at) => this.parameter(send, at + 2, true))),
    ]);
    return { volume: volumeInfo, panning: panningInfo, sends: sendInfos };
  }

  chain(chain: Chain<Version>, index: number): ChainInfo {
    const info: ChainInfo = { index, devices: chain.devices.map((device, at) => this.deviceSummary(device, at)) };
    if (chain instanceof DrumChain) info.receivingNote = chain.receivingNote;
    return info;
  }

  scene(scene: Scene<Version>, index: number = this.set.sceneIndex(scene)): SceneInfo {
    return {
      index,
      name: scene.name,
      tempo: scene.tempo,
      signatureNumerator: scene.signatureNumerator,
      signatureDenominator: scene.signatureDenominator,
    };
  }

  locator(locator: CuePoint<Version>, index: number = this.set.locatorIndex(locator)): LocatorInfo {
    return { index, name: locator.name, time: locator.time };
  }

  /** Live refuses some reads on some tracks, such as arming the main track; those get `fallback`. */
  static safely<T>(read: () => T, fallback: T): T {
    try {
      return read();
    } catch {
      return fallback;
    }
  }

  /** The class name the SDK uses for the object, such as "Simpler" or "DrumRackDevice". */
  private static className(source: ParameterSource): string {
    const type = source.constructor as typeof Device | typeof TrackMixer | typeof ChainMixer;
    return type.className;
  }
}
