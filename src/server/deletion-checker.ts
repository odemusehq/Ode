import { z } from "zod";
import type { DeviceRef } from "../shared/live";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { DeletionCheck } from "../harness/session";
import type { SetReader } from "../tools/define";
import { DeviceRefSchema, TrackRefSchema } from "../tools/live/schemas";
import { RestorePlanner } from "./restore-planner";
import { SetLookup } from "./set-lookup";

const DeviceDeletionSchema = z.object({ device: DeviceRefSchema });
const TrackDeletionSchema = z.object({ track: TrackRefSchema });
const ReturnTrackDeletionSchema = z.object({ index: z.number().int() });
const GroupSchema = z.object({ calls: z.array(z.object({ op: z.string(), args: z.unknown() })) });

/**
 * Finds the deletions Undo couldn't bring back, so they wait for Apply in every mode: a device a restore can't add
 * back (a plug-in, a preset, the Ode device, a rack holding one) or a track holding one, or a group track. What is
 * deleted is looked up in the latest snapshot; when it isn't there, the deletion waits too.
 */
export class DeletionChecker implements DeletionCheck {
  constructor(private readonly reader: Pick<SetReader, "latest">) {}

  cantBeUndone(tool: string, input: unknown): boolean {
    switch (tool) {
      case "track_delete_device":
      case "chain_delete_device": {
        const parsed = DeviceDeletionSchema.safeParse(input);
        return parsed.success && !this.deviceComesBack(parsed.data.device);
      }
      case "song_delete_track": {
        const parsed = TrackDeletionSchema.safeParse(input);
        return parsed.success && !this.trackComesBack((snapshot) => new SetLookup(snapshot).track(parsed.data.track));
      }
      case "song_delete_return_track": {
        const parsed = ReturnTrackDeletionSchema.safeParse(input);
        return parsed.success && !this.trackComesBack((snapshot) => snapshot.returnTracks[parsed.data.index]);
      }
      case "apply_as_one_undo_step": {
        const parsed = GroupSchema.safeParse(input);
        return parsed.success && parsed.data.calls.some((call) => this.cantBeUndone(call.op, call.args));
      }
      default:
        return false;
    }
  }

  private deviceComesBack(ref: DeviceRef): boolean {
    const snapshot = this.reader.latest;
    const track = snapshot ? new SetLookup(snapshot).track(ref.track) : undefined;
    const device = track ? SetLookup.deviceAt(track, ref.chain ?? [], ref.index) : undefined;
    return device !== undefined && RestorePlanner.canAddBack(device);
  }

  private trackComesBack(find: (snapshot: SetSnapshot) => TrackSnapshot | undefined): boolean {
    const snapshot = this.reader.latest;
    const track = snapshot ? find(snapshot) : undefined;
    return track !== undefined && RestorePlanner.canAddBackTrack(track);
  }
}
