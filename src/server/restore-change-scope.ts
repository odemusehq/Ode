import { BEAT_TOLERANCE, type ClipRef, type DeviceRef, type TrackRef } from "../shared/live";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import { ChangeKind, TrackList, type SetChange, type TrackKey } from "../shared/versions";
import type { PlannedCall } from "./restore-planner";
import { SetLookup } from "./set-lookup";

/** Match only effects of the step just issued. A later planned write cannot explain an earlier manual edit. */
export function restoreStepExplains(call: PlannedCall, change: SetChange, before: SetSnapshot, step: readonly PlannedCall[] = [call]): boolean {
  const args = call.args as Record<string, any>;
  const target = change.target;
  const lookup = new SetLookup(before);
  const trackKey = (track: TrackSnapshot): TrackKey => ({ list: track === before.main ? TrackList.Main : before.returnTracks.includes(track) ? TrackList.Returns : TrackList.Tracks,
    index: track.index, name: track.name, ...(track.tag ? { tag: track.tag } : {}) });
  const sameTrack = (ref: TrackRef | undefined, key: TrackKey): boolean => {
    const found = ref && lookup.track(ref);
    if (!found) return false;
    const place = trackKey(found);
    return place.list === key.list && place.index === key.index && place.tag === key.tag;
  };
  const sameClip = (ref: ClipRef): boolean => {
    if (target.scope !== "clip") return false;
    if ("tag" in ref) {
      const found = lookup.clip(ref);
      if (!found || !sameTrack(found.clip.ref && "track" in found.clip.ref ? found.clip.ref.track :
        found.track.tag ? { tag: found.track.tag } : found.track === before.main ? { main: true } :
          before.returnTracks.includes(found.track) ? { returnIndex: found.track.index } : { index: found.track.index }, target.track)) return false;
      if ("slot" in target.clip) return found.track.clipSlots[target.clip.slot]?.clip === found.clip;
      const clips = target.clip.lane === undefined ? found.track.arrangementClips : found.track.takeLanes[target.clip.lane]?.clips ?? [];
      return clips.includes(found.clip) && Math.abs(found.clip.startTime - target.clip.start) <= BEAT_TOLERANCE;
    }
    if (!sameTrack(ref.track, target.track)) return false;
    if ("slot" in ref) return "slot" in target.clip && target.clip.slot === ref.slot;
    return "start" in target.clip && target.clip.lane === ref.lane && Math.abs(target.clip.start - ref.start) <= BEAT_TOLERANCE;
  };
  const sameDevice = (ref: DeviceRef, index = ref.index, chain = ref.chain ?? []): boolean => target.scope === "device" &&
    sameTrack(ref.track, target.track) && target.index === index && JSON.stringify(target.chain) === JSON.stringify(chain);

  switch (call.op) {
    case "song_set_tempo": return target.scope === "song" && target.field === "tempo";
    case "song_create_locator": case "song_delete_locator": case "locator_rename": return target.scope === "song" && target.field === "locators";
    case "song_create_scene": case "scene_rename": return target.scope === "song" && target.field === "scenes";
    case "song_delete_scene": return target.scope === "song" && target.field === "scenes" || target.scope === "clip" && "slot" in target.clip &&
      typeof args.scene?.index === "number" && target.clip.slot >= args.scene.index;
    case "song_create_midi_track": case "song_create_audio_track":
      return target.scope === "track" && target.field === "present" && change.kind === ChangeKind.Added &&
        (args.tag ? target.track.tag === args.tag : target.track.name === args.name);
    case "song_delete_track": return target.scope === "track" && target.field === "present" && change.kind === ChangeKind.Removed && sameTrack(args.track, target.track);
    case "track_set": return target.scope === "track" && sameTrack(args.track, target.track) && target.field !== "present" && args[target.field] !== undefined;
    case "midi_clip_set_notes": return target.scope === "clip" && target.field === "notes" && sameClip(args.clip);
    case "clip_set": return target.scope === "clip" && sameClip(args.clip) &&
      (args[target.field] !== undefined || target.field === "loop" && args.looping !== undefined);
    case "audio_clip_set": return target.scope === "clip" && target.field === "audio" && sameClip(args.clip);
    case "track_delete_clip": return target.scope === "clip" && target.field === "present" && change.kind === ChangeKind.Removed && sameClip(args.clip);
    case "clip_slot_delete_clip": return target.scope === "clip" && target.field === "present" && change.kind === ChangeKind.Removed && sameClip(args.slot);
    case "track_create_midi_clip": case "track_create_audio_clip":
      return target.scope === "clip" && target.field === "present" && change.kind === ChangeKind.Added && sameClip({ track: args.track, start: args.start });
    case "take_lane_create_midi_clip": case "take_lane_create_audio_clip":
      return target.scope === "clip" && target.field === "present" && change.kind === ChangeKind.Added && sameClip({ track: args.lane.track, lane: args.lane.lane, start: args.start });
    case "clip_slot_create_midi_clip": case "clip_slot_create_audio_clip":
      return target.scope === "clip" && target.field === "present" && change.kind === ChangeKind.Added && sameClip(args.slot);
    case "parameter_set": return target.scope === "device" && target.field === "parameter" && sameDevice(args.parameter.device) && target.parameter === args.parameter.parameter;
    case "track_insert_device": return target.scope === "device" && target.field === "present" && change.kind === ChangeKind.Added &&
      sameDevice({ track: args.track, index: args.index ?? lookup.track(args.track)?.devices.length ?? -2 });
    case "chain_insert_device": return target.scope === "device" && target.field === "present" && change.kind === ChangeKind.Added &&
      sameDevice(args.device, args.index, [...(args.device.chain ?? []), args.device.index, args.chain]);
    case "track_delete_device": case "chain_delete_device": return target.scope === "device" && target.field === "present" && change.kind === ChangeKind.Removed && sameDevice(args.device);
    case "rack_insert_chain": case "drum_pad_set_note": case "simpler_replace_sample":
      return target.scope === "device" && target.field === "present" && sameDevice(args.device);
    case "track_create_take_lane": case "take_lane_rename":
      if (target.scope !== "track" || target.field !== "takeLanes" || !sameTrack(args.track ?? args.lane?.track, target.track) ||
        !Array.isArray(change.before) || !Array.isArray(change.after)) return false;
      const names: (string | undefined)[] = change.before.map((lane) => lane.name);
      for (const related of step) {
        const fields = related.args as Record<string, any>;
        if (related.op === "take_lane_rename" && sameTrack(fields.lane?.track, target.track)) names[fields.lane.lane] = fields.name;
        if (related.op === "track_create_take_lane" && sameTrack(fields.track, target.track)) names.push(fields.name);
      }
      return names.length === change.after.length && change.after.every((lane, index) =>
        lane.lane === index && (names[index] === undefined || lane.name === names[index]));
    default: return false;
  }
}
