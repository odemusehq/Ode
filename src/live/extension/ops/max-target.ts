import { t } from "../../../shared/i18n";
import type { ClipRef, DeviceRef, TrackRef } from "../../../shared/live";
import type { MaxDawAddress } from "../../../shared/max-daw";
import type { MaxParameterAddress } from "../../../shared/max-parameters";
import { ClipPlace } from "../locations";
import { indexOfObject } from "../sdk";
import { OperationGroup } from "./group";
import type { OperationTable } from "./operation";

/** Resolve SDK references freshly; SDK handles are not Max IDs. */
export class MaxTargetOperations extends OperationGroup<"max_target"> {
  table(): OperationTable<"max_target"> {
    return { max_target: { prepare: (args) => {
      if (Number(args.track !== undefined) + Number(args.device !== undefined) + Number(args.clip !== undefined) !== 1) throw new Error(t("maxDaw.invalid"));
      const address = args.device ? this.device(args.device) : args.clip ? this.clip(args.clip) : this.track(args.track!);
      return async () => address;
    } } };
  }
  private clip(ref: ClipRef): MaxDawAddress {
    const { clip, location } = this.refs.clip(ref);
    const track = this.track(this.set.tracks().position(location.track).ref), guards = [...track.guards];
    let path = track.path;
    if (location.place === ClipPlace.Session) path += ` clip_slots ${location.slot} clip`;
    else {
      const lane = location.lane === null ? null : location.track.takeLanes[location.lane]!;
      if (lane) { path += ` take_lanes ${location.lane}`; guards.push({ path, name: lane.name }); }
      path += ` arrangement_clips ${indexOfObject(lane ? lane.clips : location.track.arrangementClips, clip)}`;
    }
    guards.push({ path, name: clip.name });
    const filePath = "filePath" in clip && typeof clip.filePath === "string" ? clip.filePath : undefined;
    return { path, guards, clip: { ...(location.place === ClipPlace.Arrangement ? { startTime: clip.startTime } : {}), ...(filePath ? { filePath } : {}) } };
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
