import { LiveError } from "../errors";
import { ClipPlace } from "../locations";
import { indexOfObject } from "../sdk";
import { NewName, TaggedName } from "../tags";
import { OperationGroup } from "./group";
import { type FollowUps, type OpArgs, type OpRun, type OperationTable } from "./operation";

type TrackOp =
  | "track_get"
  | "track_set"
  | "track_create_midi_clip"
  | "track_create_audio_clip"
  | "track_delete_clip"
  | "track_clear_range"
  | "track_create_take_lane"
  | "track_insert_device"
  | "track_delete_device"
  | "track_duplicate_device";

/** Tracks: their settings, their Arrangement clips, take lanes and devices. */
export class TrackOperations extends OperationGroup<TrackOp> {
  table(): OperationTable<TrackOp> {
    return {
      track_get: { prepare: (args) => this.get(args) },
      track_set: { prepare: (args) => this.setTrack(args) },
      track_create_midi_clip: { prepare: (args, followUps) => this.createMidiClip(args, followUps) },
      track_create_audio_clip: { prepare: (args, followUps) => this.createAudioClip(args, followUps) },
      track_delete_clip: { prepare: (args) => this.deleteClip(args) },
      track_clear_range: { prepare: (args) => this.clearRange(args) },
      track_create_take_lane: { prepare: (args, followUps) => this.createTakeLane(args, followUps) },
      track_insert_device: { prepare: (args) => this.insertDevice(args) },
      track_delete_device: { prepare: ({ device }) => this.deleteDevice(device) },
      track_duplicate_device: { prepare: ({ device }) => this.duplicateDevice(device) },
    };
  }

  private get({ track }: OpArgs<"track_get">): OpRun<"track_get"> {
    const target = this.refs.track(track);
    return async () => this.describe.track(target);
  }

  private setTrack({ track, name, mute, solo, arm }: OpArgs<"track_set">): OpRun<"track_set"> {
    const target = this.refs.track(track);
    return async () => {
      this.live.withinTransaction(() => {
        if (name !== undefined) TaggedName.rename(target, name);
        if (mute !== undefined) target.mute = mute;
        if (solo !== undefined) target.solo = solo;
        if (arm !== undefined) target.arm = arm;
      });
      return this.describe.trackSummary(target);
    };
  }

  private createMidiClip(
    { track, start, length, notes, name, tag }: OpArgs<"track_create_midi_clip">,
    followUps: FollowUps,
  ): OpRun<"track_create_midi_clip"> {
    const target = this.refs.midiTrack(track);
    OperationGroup.checkStart(start);
    OperationGroup.checkLength(length);
    const setUp = this.midiClipSetup(name, tag, notes);
    return async () => {
      const clip = await followUps.after(LiveError.guard(target.createMidiClip(start, length), "create the MIDI clip"), setUp);
      return this.createdClip(clip, { place: ClipPlace.Arrangement, track: target, lane: null });
    };
  }

  private createAudioClip(
    { track, filePath, start, length, warped, loop, name, tag }: OpArgs<"track_create_audio_clip">,
    followUps: FollowUps,
  ): OpRun<"track_create_audio_clip"> {
    const target = this.refs.audioTrack(track);
    OperationGroup.checkFile(filePath);
    OperationGroup.checkStart(start);
    if (length !== undefined) OperationGroup.checkLength(length);
    const settings = OperationGroup.audioClipSettings(warped, loop);
    const naming = new NewName(name, tag);
    return async () => {
      const created = target.createAudioClip({ filePath, startTime: start, duration: length, ...settings });
      const clip = await followUps.after(LiveError.guard(created, "create the audio clip"), (clip) => naming.applyTo(clip));
      return this.createdClip(clip, { place: ClipPlace.Arrangement, track: target, lane: null });
    };
  }

  /** Arrangement clips by start or tag; a tag that leads to a Session clip deletes that one. */
  private deleteClip({ clip }: OpArgs<"track_delete_clip">): OpRun<"track_delete_clip"> {
    const { clip: target, location } = this.refs.clip(clip);
    return async () => {
      const deleted = location.place === ClipPlace.Session ? location.clipSlot.deleteClip() : location.track.deleteClip(target);
      await LiveError.guard(deleted, "delete the clip");
      return { deleted: true };
    };
  }

  /** Clips that cross the edges of the range are cut at the edges. */
  private clearRange({ track, start, end }: OpArgs<"track_clear_range">): OpRun<"track_clear_range"> {
    const target = this.refs.track(track);
    OperationGroup.checkRange(start, end);
    return async () => {
      await LiveError.guard(target.clearClipsInRange(start, end), "clear the range");
      return { cleared: true };
    };
  }

  private createTakeLane({ track, name }: OpArgs<"track_create_take_lane">, followUps: FollowUps): OpRun<"track_create_take_lane"> {
    const target = this.refs.track(track);
    return async () => {
      const lane = await followUps.after(LiveError.guard(target.createTakeLane(), "create the take lane"), (lane) => {
        if (name !== undefined) lane.name = name;
        return lane;
      });
      return this.describe.takeLane(target, lane, indexOfObject(target.takeLanes, lane));
    };
  }

  /** Only Live's own devices can be inserted by name. */
  private insertDevice({ track, device, index }: OpArgs<"track_insert_device">): OpRun<"track_insert_device"> {
    const target = this.refs.track(track);
    const at = OperationGroup.insertPosition(index, target.devices.length);
    return async () => {
      const inserted = await LiveError.guard(
        target.insertDevice(device, at),
        `insert "${device}" (only Live's own devices can be inserted by name)`,
      );
      return { device: { track, index: indexOfObject(target.devices, inserted) }, name: inserted.name };
    };
  }
}
