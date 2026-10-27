import { AudioTrack, MidiTrack } from "@ableton-extensions/sdk";
import { LiveError } from "../errors";
import { ClipPlace } from "../locations";
import { takeLaneText } from "../refs";
import { NewName } from "../tags";
import { OperationGroup } from "./group";
import { OperationKind, type FollowUps, type OpArgs, type OpRun, type OperationTable } from "./operation";

type TakeLaneOp = "take_lane_get" | "take_lane_rename" | "take_lane_create_midi_clip" | "take_lane_create_audio_clip";

/** Take lanes in the Arrangement and the clips on them. */
export class TakeLaneOperations extends OperationGroup<TakeLaneOp> {
  table(): OperationTable<TakeLaneOp> {
    return {
      take_lane_get: { kind: OperationKind.Read, prepare: (args) => this.get(args) },
      take_lane_rename: { kind: OperationKind.Change, prepare: (args) => this.rename(args) },
      take_lane_create_midi_clip: {
        kind: OperationKind.Structure,
        prepare: (args, followUps) => this.createMidiClip(args, followUps),
      },
      take_lane_create_audio_clip: {
        kind: OperationKind.Structure,
        prepare: (args, followUps) => this.createAudioClip(args, followUps),
      },
    };
  }

  private get({ lane }: OpArgs<"take_lane_get">): OpRun<"take_lane_get"> {
    const found = this.refs.takeLane(lane);
    return async () => this.describe.takeLane(found.track, found.lane, found.index);
  }

  private rename({ lane, name }: OpArgs<"take_lane_rename">): OpRun<"take_lane_rename"> {
    const found = this.refs.takeLane(lane);
    return async () => {
      found.lane.name = name;
      return this.describe.takeLane(found.track, found.lane, found.index);
    };
  }

  private createMidiClip(
    { lane, start, length, notes, name, tag }: OpArgs<"take_lane_create_midi_clip">,
    followUps: FollowUps,
  ): OpRun<"take_lane_create_midi_clip"> {
    const found = this.refs.takeLane(lane);
    if (!(found.track instanceof MidiTrack)) throw new Error(`${takeLaneText(lane)} is not on a MIDI track`);
    OperationGroup.checkStart(start);
    OperationGroup.checkLength(length);
    const setUp = this.midiClipSetup(name, tag, notes);
    return async () => {
      const clip = await followUps.after(LiveError.guard(found.lane.createMidiClip(start, length), "create the MIDI clip"), setUp);
      return this.createdClip(clip, { place: ClipPlace.Arrangement, track: found.track, lane: found.index });
    };
  }

  private createAudioClip(
    { lane, filePath, start, length, warped, loop, name, tag }: OpArgs<"take_lane_create_audio_clip">,
    followUps: FollowUps,
  ): OpRun<"take_lane_create_audio_clip"> {
    const found = this.refs.takeLane(lane);
    if (!(found.track instanceof AudioTrack)) throw new Error(`${takeLaneText(lane)} is not on an audio track`);
    OperationGroup.checkFile(filePath);
    OperationGroup.checkStart(start);
    if (length !== undefined) OperationGroup.checkLength(length);
    const settings = OperationGroup.audioClipSettings(warped, loop);
    const naming = new NewName(name, tag);
    return async () => {
      const created = found.lane.createAudioClip({ filePath, startTime: start, duration: length, ...settings });
      const clip = await followUps.after(LiveError.guard(created, "create the audio clip"), (clip) => naming.applyTo(clip));
      return this.createdClip(clip, { place: ClipPlace.Arrangement, track: found.track, lane: found.index });
    };
  }
}
