import { AudioTrack, MidiTrack } from "@ableton-extensions/sdk";
import type { ClipSlotRef } from "../../../shared/live";
import { LiveError, NotFoundError } from "../errors";
import { ClipPlace, type ClipLocation } from "../locations";
import { clipSlotText, clipText, type FoundClipSlot } from "../refs";
import { NewName } from "../tags";
import { OperationGroup } from "./group";
import { type FollowUps, type OpArgs, type OpRun, type OperationTable } from "./operation";

type ClipSlotOp = "clip_slot_get" | "clip_slot_create_midi_clip" | "clip_slot_create_audio_clip" | "clip_slot_delete_clip";

/** Clip slots in Session View. */
export class ClipSlotOperations extends OperationGroup<ClipSlotOp> {
  table(): OperationTable<ClipSlotOp> {
    return {
      clip_slot_get: { prepare: (args) => this.get(args) },
      clip_slot_create_midi_clip: {
        prepare: (args, followUps) => this.createMidiClip(args, followUps),
      },
      clip_slot_create_audio_clip: {
        prepare: (args, followUps) => this.createAudioClip(args, followUps),
      },
      clip_slot_delete_clip: { prepare: (args) => this.deleteClip(args) },
    };
  }

  private get({ slot }: OpArgs<"clip_slot_get">): OpRun<"clip_slot_get"> {
    const found = this.refs.clipSlot(slot);
    return async () => this.describe.clipSlot(found.track, found.clipSlot, found.index);
  }

  private createMidiClip(
    { slot, length, notes, name, tag }: OpArgs<"clip_slot_create_midi_clip">,
    followUps: FollowUps,
  ): OpRun<"clip_slot_create_midi_clip"> {
    const found = this.emptySlot(slot);
    if (!(found.track instanceof MidiTrack)) throw new Error(`a MIDI clip needs a slot on a MIDI track; ${clipSlotText(slot)} is on a different kind of track`);
    OperationGroup.checkLength(length);
    const setUp = this.midiClipSetup(name, tag, notes);
    return async () => {
      const clip = await followUps.after(LiveError.guard(found.clipSlot.createMidiClip(length), "create the MIDI clip"), setUp);
      return this.createdClip(clip, ClipSlotOperations.location(found));
    };
  }

  private createAudioClip(
    { slot, filePath, warped, loop, name, tag }: OpArgs<"clip_slot_create_audio_clip">,
    followUps: FollowUps,
  ): OpRun<"clip_slot_create_audio_clip"> {
    const found = this.emptySlot(slot);
    if (!(found.track instanceof AudioTrack)) throw new Error(`an audio clip needs a slot on an audio track; ${clipSlotText(slot)} is on a different kind of track`);
    OperationGroup.checkFile(filePath);
    const settings = OperationGroup.audioClipSettings(warped, loop);
    const naming = new NewName(name, tag);
    return async () => {
      const created = found.clipSlot.createAudioClip({ filePath, ...settings });
      const clip = await followUps.after(LiveError.guard(created, "create the audio clip"), (clip) => naming.applyTo(clip));
      return this.createdClip(clip, ClipSlotOperations.location(found));
    };
  }

  private deleteClip({ slot }: OpArgs<"clip_slot_delete_clip">): OpRun<"clip_slot_delete_clip"> {
    const found = this.refs.clipSlot(slot);
    if (!found.clipSlot.clip) throw new NotFoundError(clipText(slot));
    return async () => {
      await LiveError.guard(found.clipSlot.deleteClip(), "delete the clip");
      return { deleted: true };
    };
  }

  private emptySlot(ref: ClipSlotRef): FoundClipSlot {
    const found = this.refs.clipSlot(ref);
    if (found.clipSlot.clip) throw new Error(`${clipSlotText(ref)} already holds a clip`);
    return found;
  }

  private static location({ track, clipSlot, index }: FoundClipSlot): ClipLocation {
    return { place: ClipPlace.Session, track, slot: index, clipSlot };
  }
}
