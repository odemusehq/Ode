import { z } from "zod";
import type { DeviceRef } from "../shared/live";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { DeletionCheck } from "../harness/session";
import type { SetReader } from "../tools/define";
import { DeviceRefSchema, TrackRefSchema } from "../tools/daw/schemas";
import { RestorePlanner } from "./restore-planner";
import { SetLookup } from "./set-lookup";

const DeviceDeletionSchema = z.object({ device: DeviceRefSchema });
const TrackDeletionSchema = z.object({ track: TrackRefSchema });
const GroupSchema = z.object({ calls: z.array(z.object({ op: z.string(), args: z.unknown() })) });

/** One deletion inside a call: what it removes, found in the Set as it is when the call runs. */
type Deletion = (snapshot: SetSnapshot) => boolean;

/**
 * Finds the deletions a restore would leave out, so they wait for Apply in every mode: a device only the musician can add
 * back (a plug-in, a preset, a rack holding one) or a track holding one, or a group track. What is deleted is looked
 * up in a fresh reading of the Set, since Ode's own earlier changes move what each index points at; when the Set
 * lacks it, the deletion waits too.
 */
export class DeletionChecker implements DeletionCheck {
  constructor(private readonly reader: SetReader) {}

  async cantBeUndone(tool: string, input: unknown): Promise<boolean> {
    const deletions = DeletionChecker.deletions(tool, input);
    if (deletions.length === 0) return false;
    // A Set that stays unreadable makes the deletion wait for Apply, like one whose target is missing.
    const snapshot = await this.reader.read().catch(() => null);
    return snapshot === null || deletions.some((stays) => !stays(snapshot));
  }

  /** For each deletion in the call, a check that a restore brings back what it removes. */
  private static deletions(tool: string, input: unknown): Deletion[] {
    switch (tool) {
      case "track_delete_device":
      case "chain_delete_device": {
        const parsed = DeviceDeletionSchema.safeParse(input);
        return parsed.success ? [(snapshot) => DeletionChecker.deviceComesBack(snapshot, parsed.data.device)] : [];
      }
      case "song_delete_track": {
        const parsed = TrackDeletionSchema.safeParse(input);
        return parsed.success ? [(snapshot) => DeletionChecker.trackComesBack(new SetLookup(snapshot).track(parsed.data.track))] : [];
      }
      case "apply_as_one_undo_step": {
        const parsed = GroupSchema.safeParse(input);
        return parsed.success ? parsed.data.calls.flatMap((call) => DeletionChecker.deletions(call.op, call.args)) : [];
      }
      default:
        return [];
    }
  }

  private static deviceComesBack(snapshot: SetSnapshot, ref: DeviceRef): boolean {
    const track = new SetLookup(snapshot).track(ref.track);
    const device = track ? SetLookup.deviceAt(track, ref.chain ?? [], ref.index) : undefined;
    return device !== undefined && RestorePlanner.canAddBack(device);
  }

  private static trackComesBack(track: TrackSnapshot | undefined): boolean {
    return track !== undefined && RestorePlanner.canAddBackTrack(track);
  }
}
