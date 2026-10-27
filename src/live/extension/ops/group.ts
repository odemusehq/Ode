import type { Clip, MidiClip } from "@ableton-extensions/sdk";
import type { DeviceRef, ExtensionOp, LoopSettings, Note } from "../../../shared/live";
import type { CreatedClip, CreatedDevice } from "../../../shared/live-ops";
import type { Describer } from "../describe";
import { LiveError } from "../errors";
import type { LiveSet } from "../live-set";
import { clipReference, type ClipLocation } from "../locations";
import { toLiveNotes } from "../notes";
import type { ReferenceResolver } from "../refs";
import { indexOfObject, type Live, type Version } from "../sdk";
import { NewName, TaggedName } from "../tags";
import type { OperationTable, Run } from "./operation";

/** What every group of operations works with. */
export interface LiveServices {
  readonly live: Live;
  readonly set: LiveSet;
  readonly refs: ReferenceResolver;
  readonly describe: Describer;
}

/** Warping and loop settings for a new audio clip, in the form the SDK takes. */
export interface AudioClipSettings {
  readonly isWarped: boolean | undefined;
  readonly loopSettings: LoopSettings | undefined;
}

/** A group of related operations, such as everything on scenes. */
export abstract class OperationGroup<K extends ExtensionOp> {
  protected readonly live: Live;
  protected readonly set: LiveSet;
  protected readonly refs: ReferenceResolver;
  protected readonly describe: Describer;

  constructor(services: LiveServices) {
    this.live = services.live;
    this.set = services.set;
    this.refs = services.refs;
    this.describe = services.describe;
  }

  /** The group's operations, by name. */
  abstract table(): OperationTable<K>;

  /** How Ode reports a clip it created: by its tag when it has one, otherwise by where it is. */
  protected createdClip(clip: Clip<Version>, location: ClipLocation): CreatedClip {
    const { name, tag } = TaggedName.parse(clip.name);
    return { clip: tag === undefined ? clipReference(clip, location, this.set.tracks()) : { tag }, name, tag };
  }

  /** Checks the name, tag and notes of a new MIDI clip now, and returns what sets them once the clip exists. */
  protected midiClipSetup(
    name: string | undefined,
    tag: string | undefined,
    notes: readonly Note[] | undefined,
  ): (clip: MidiClip<Version>) => MidiClip<Version> {
    const naming = new NewName(name, tag);
    const liveNotes = notes === undefined ? undefined : toLiveNotes(notes);
    return (clip) => {
      naming.applyTo(clip);
      if (liveNotes !== undefined) clip.notes = liveNotes;
      return clip;
    };
  }

  /** A loop needs warping, so loop settings without a warping choice turn warping on. */
  protected static audioClipSettings(warped: boolean | undefined, loop: LoopSettings | undefined): AudioClipSettings {
    const isWarped = warped ?? (loop === undefined ? undefined : true);
    if (loop?.looping && isWarped === false) throw new RangeError("a looping audio clip has to be warped");
    return { isWarped, loopSettings: loop };
  }

  /** Deletes a device from the track or chain that holds it. */
  protected deleteDevice(ref: DeviceRef): Run<{ deleted: true }> {
    const { device, container } = this.refs.device(ref);
    return async () => {
      await LiveError.guard(container.deleteDevice(device), "delete the device");
      return { deleted: true };
    };
  }

  /** Duplicates a device; the copy goes right after it. */
  protected duplicateDevice(ref: DeviceRef): Run<CreatedDevice> {
    const { device, container } = this.refs.device(ref);
    return async () => {
      const copy = await LiveError.guard(container.duplicateDevice(device), "duplicate the device");
      return { device: { ...ref, index: indexOfObject(container.devices, copy) }, name: copy.name };
    };
  }

  /** Where to insert: `index` when given, otherwise after the last of `count` items. */
  protected static insertPosition(index: number | undefined, count: number): number {
    const position = index ?? count;
    if (!(Number.isInteger(position) && position >= 0 && position <= count)) {
      throw new RangeError(`index must be a whole number from 0 to ${count}`);
    }
    return position;
  }

  protected static checkStart(start: number): void {
    if (!(start >= 0)) throw new RangeError("start must be 0 or later, in beats");
  }

  protected static checkLength(length: number): void {
    if (!(length > 0)) throw new RangeError("length must be more than 0 beats");
  }

  protected static checkRange(start: number, end: number): void {
    OperationGroup.checkStart(start);
    if (!(end > start)) throw new RangeError("end must be after start");
  }

  protected static checkFile(filePath: string): void {
    if (typeof filePath !== "string" || filePath.trim() === "") throw new TypeError("filePath must be the full path of a file");
  }
}
