import {
  DrumChain,
  RackDevice,
  Simpler,
  type Chain,
  type Clip,
  type ClipSlot,
  type Device,
  type DeviceParameter,
  type TakeLane,
  type Track,
} from "@ableton-extensions/sdk";
import type { ClipInfo, ClipSlotInfo, ParameterInfo, TakeLaneInfo } from "../../../shared/live-ops";
import type { ChainSnapshot, DeviceSnapshot, TrackSnapshot } from "../../../shared/set-snapshot";
import { isMaxWindowParameter } from "../../../shared/max-window";
import { Describer } from "../describe";
import { UnreadableError } from "../errors";
import { Labels } from "../labels";
import { ClipPlace, type ClipLocation } from "../locations";
import type { Version } from "../sdk";
import type { TrackDirectory, TrackPosition } from "../track-directory";
import { OperationGroup } from "./group";
import { type OpRun, type OperationTable } from "./operation";

type SnapshotOp = "set_snapshot";

/** What the reads inside one track share. */
interface TrackContext {
  readonly track: Track<Version>;
  readonly tracks: TrackDirectory;
  /** The track in errors, as in 'track 3 "Bass"'. */
  readonly label: string;
  /** Only MIDI and audio tracks hold clips. */
  readonly holdsClips: boolean;
}

/**
 * The whole Set in one pass: the song, and every track with its mixer, its devices through racks and
 * its clips with their notes or audio. Every parameter value is asked for before any answer is awaited.
 * Every object is read, because a snapshot missing an object would be saved in the history as that object
 * removed, and restoring it would delete the real one: a track, clip, device or chain that Live refuses
 * to read stops the snapshot with an error naming it. Only a parameter whose value Live withholds
 * keeps its other details, without the value.
 */
export class SnapshotOperations extends OperationGroup<SnapshotOp> {
  table(): OperationTable<SnapshotOp> {
    return {
      set_snapshot: { prepare: () => this.snapshot() },
    };
  }

  private snapshot(): OpRun<"set_snapshot"> {
    return async () => {
      const tracks = this.set.tracks();
      const song = UnreadableError.guard("the song", () => this.describe.songWithoutTracks());
      const [regular, returnTracks, main] = await Promise.all([
        Promise.all(tracks.regular.map((track) => this.track(track, tracks))),
        Promise.all(tracks.returns.map((track) => this.track(track, tracks))),
        this.track(tracks.main, tracks),
      ]);
      return { song, signature: this.describe.signature(), tracks: regular, returnTracks, main };
    };
  }

  /** The track's settings and clips are read first; then its mixer and device values are asked for together. */
  private async track(track: Track<Version>, tracks: TrackDirectory): Promise<TrackSnapshot> {
    const position = tracks.position(track);
    const place = SnapshotOperations.trackPlace(position);
    const header = UnreadableError.guard(place, () => this.describe.trackHeader(track, tracks));
    const label = position.kind === "main" ? place : `${place}${Labels.quoted(header.name)}`;
    const context: TrackContext = { track, tracks, label, holdsClips: position.kind === "midi" || position.kind === "audio" };
    return UnreadableError.guardAsync(label, async () => {
      const contents = {
        ...header,
        mutedViaSolo: Describer.safely(() => track.mutedViaSolo, false),
        groupTrack: this.describe.groupTrackIndex(track, tracks),
        clipSlots: SnapshotOperations.clipList(context, () => track.clipSlots).map((clipSlot, slot) =>
          this.clipSlot(context, clipSlot, slot),
        ),
        arrangementClips: this.clips(
          context,
          SnapshotOperations.clipList(context, () => track.arrangementClips),
          null,
          `the Arrangement of ${label}`,
        ),
        takeLanes: SnapshotOperations.clipList(context, () => track.takeLanes).map((lane, index) =>
          this.takeLane(context, lane, index),
        ),
      };
      const { mixer, devices } = track;
      const [mixerInfo, deviceSnapshots] = await Promise.all([
        UnreadableError.guardAsync(`the mixer of ${label}`, () => this.describe.mixer(mixer)),
        this.devices(devices, `on ${label}`),
      ]);
      return { ...contents, mixer: mixerInfo, devices: deviceSnapshots };
    });
  }

  /** Only MIDI and audio tracks hold clips: when Live refuses to list a group, return or main track's clips, the list is empty. */
  private static clipList<T>(context: TrackContext, read: () => T[]): T[] {
    return context.holdsClips ? read() : Describer.safely(read, []);
  }

  private clipSlot(context: TrackContext, clipSlot: ClipSlot<Version>, slot: number): ClipSlotInfo {
    return UnreadableError.guard(`the clip in clip slot ${slot + 1} on ${context.label}`, () => {
      const clip = context.holdsClips ? clipSlot.clip : Describer.safely(() => clipSlot.clip, null);
      const location: ClipLocation = { place: ClipPlace.Session, track: context.track, slot, clipSlot };
      return { slot, clip: clip ? this.describe.clipWithContents(clip, location, context.tracks) : null };
    });
  }

  private takeLane(context: TrackContext, lane: TakeLane<Version>, index: number): TakeLaneInfo {
    const where = `take lane ${index + 1} of ${context.label}`;
    return UnreadableError.guard(where, () => ({ lane: index, name: lane.name, clips: this.clips(context, lane.clips, index, where) }));
  }

  /** Arrangement clips on the track's main lane (lane null) or on a take lane; `where` names the lane. */
  private clips(context: TrackContext, clips: readonly Clip<Version>[], lane: number | null, where: string): ClipInfo[] {
    const location: ClipLocation = { place: ClipPlace.Arrangement, track: context.track, lane };
    return clips.map((clip, at) =>
      UnreadableError.guard(`clip ${at + 1} in ${where}`, () => this.describe.clipWithContents(clip, location, context.tracks)),
    );
  }

  /** `where` places the devices in errors, as in 'on track 3 "Bass"'. */
  private devices(devices: readonly Device<Version>[], where: string): Promise<DeviceSnapshot[]> {
    return Promise.all(devices.map((device, index) => this.device(device, index, where)));
  }

  /** A device with every parameter value; a rack's chains hold full devices too. */
  private async device(device: Device<Version>, index: number, where: string): Promise<DeviceSnapshot> {
    const summary = UnreadableError.guard(`device ${index + 1} ${where}`, () => this.describe.deviceSummary(device, index));
    const label = `device ${index + 1}${Labels.quoted(summary.name)} ${where}`;
    return UnreadableError.guardAsync(label, async () => {
      const parameters = device.parameters;
      const chains = device instanceof RackDevice ? device.chains : undefined;
      const sample = device instanceof Simpler ? (device.sample?.filePath ?? null) : undefined;
      const [parameterInfos, chainSnapshots] = await Promise.all([
        Promise.all(parameters.map((parameter, at) => this.parameter(parameter, at, label))),
        chains ? Promise.all(chains.map((chain, at) => this.chain(chain, at, label))) : undefined,
      ]);
      const info: DeviceSnapshot = { ...summary, parameters: parameterInfos };
      if (chainSnapshots) info.chains = chainSnapshots;
      if (sample !== undefined) info.sample = sample;
      return info;
    });
  }

  /** Drum Rack pads also say which note plays them. */
  private async chain(chain: Chain<Version>, index: number, rack: string): Promise<ChainSnapshot> {
    const label = `chain ${index + 1} of ${rack}`;
    return UnreadableError.guardAsync(label, async () => {
      const receivingNote = chain instanceof DrumChain ? chain.receivingNote : undefined;
      const [devices, mixer] = await Promise.all([
        this.devices(chain.devices, `in ${label}`),
        UnreadableError.guardAsync(`the mixer of ${label}`, () => this.describe.mixer(chain.mixer)),
      ]);
      const info: ChainSnapshot = { index, devices, mixer };
      if (receivingNote !== undefined) info.receivingNote = receivingNote;
      return info;
    });
  }

  /** A parameter whose value Live withholds keeps its other details. */
  private async parameter(parameter: DeviceParameter<Version>, index: number, device: string): Promise<ParameterInfo> {
    const info = UnreadableError.guard(`parameter ${index + 1} of ${device}`, () => this.describe.parameterDetails(parameter, index));
    if (isMaxWindowParameter(parameter.name)) return info;
    const value = await parameter.getValue().catch(() => undefined);
    if (value !== undefined) info.value = value;
    return info;
  }

  /** 'track 3', 'return track 1' or 'the main track', counted the way musicians count. */
  private static trackPlace({ kind, index }: TrackPosition): string {
    if (kind === "main") return "the main track";
    return `${kind === "return" ? "return track" : "track"} ${index + 1}`;
  }
}
