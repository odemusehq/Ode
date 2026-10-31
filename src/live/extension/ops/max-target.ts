import type { DeviceRef, TrackRef } from "../../../shared/live";
import type { MaxParameterAddress } from "../../../shared/max-parameters";
import { OperationGroup } from "./group";
import type { OperationTable } from "./operation";

/** Resolve SDK references freshly; SDK handles are not Max IDs. */
export class MaxTargetOperations extends OperationGroup<"max_target"> {
  table(): OperationTable<"max_target"> {
    return { max_target: { prepare: (args) => {
      if (Number(args.track !== undefined) + Number(args.device !== undefined) !== 1) throw new Error("Give exactly one native target.");
      const address = args.device ? this.device(args.device) : this.track(args.track!);
      return async () => address;
    } } };
  }
  private track(ref: TrackRef): MaxParameterAddress {
    const track = this.refs.track(ref), position = this.set.tracks().position(track);
    const path = position.kind === "main" ? "live_set master_track"
      : position.kind === "return" ? `live_set return_tracks ${position.index}` : `live_set tracks ${position.index}`;
    return { path, guards: [{ path, name: track.name }] };
  }
  private device(ref: DeviceRef): MaxParameterAddress {
    this.refs.device(ref);
    const track = this.track(ref.track), guards = [...track.guards];
    let path = track.path;
    const chain = ref.chain ?? [];
    for (let at = 0; at < chain.length; at += 2) {
      const rack = this.refs.rack({ track: ref.track, chain: chain.slice(0, at), index: chain[at]! });
      path += ` devices ${chain[at]}`;
      guards.push({ path, name: rack.name });
      path += ` chains ${chain[at + 1]}`;
      guards.push({ path });
    }
    path += ` devices ${ref.index}`;
    guards.push({ path, name: this.refs.device(ref).device.name });
    return { path, guards };
  }
}
