import type { LocatorRef, TrackRef } from "../../../shared/live";
import type { CreatedTrack, DeviceOpArgs, MeterReading, SelectionInfo, SetInfo } from "../../../shared/live-ops";
import { LiveObject } from "./live-object";

type Handler = (args: never) => unknown;

/** The Max for Live API operations the Extensions SDK lacks, run inside the Ode device. */
export class DeviceOperations {
  private readonly setId: string;
  private readonly handlers: Record<string, Handler>;

  constructor() {
    this.setId = `unsaved-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.handlers = {
      set_info: () => this.setInfo(),
      transport_play: (args: DeviceOpArgs["transport_play"]) => this.play(args),
      transport_stop: () => this.transport("stop_playing", false),
      transport_continue: () => this.transport("continue_playing", true),
      transport_set_position: ({ time }: DeviceOpArgs["transport_set_position"]) => this.setPosition(time),
      transport_record: ({ on }: DeviceOpArgs["transport_record"]) => this.toggle("record_mode", on),
      session_record: ({ on }: DeviceOpArgs["session_record"]) => this.toggle("session_record", on),
      loop_set: (args: DeviceOpArgs["loop_set"]) => this.loop(args),
      locator_jump: ({ locator }: DeviceOpArgs["locator_jump"]) => this.jump(locator),
      song_set_key: (args: DeviceOpArgs["song_set_key"]) => this.setKey(args),
      song_set_time_signature: (args: DeviceOpArgs["song_set_time_signature"]) => this.setTimeSignature(args),
      song_create_return_track: () => this.createReturnTrack(),
      song_delete_return_track: ({ index }: DeviceOpArgs["song_delete_return_track"]) => this.deleteReturnTrack(index),
      song_capture_midi: () => this.captureMidi(),
      song_undo: () => this.history("can_undo", "undo"),
      song_redo: () => this.history("can_redo", "redo"),
      selection_get: () => this.selection(),
      track_meters_get: () => this.meters(),
    };
  }

  has(op: string): boolean {
    return op in this.handlers;
  }

  run(op: string, args: unknown): unknown {
    const handler = this.handlers[op];
    if (!handler) throw new Error(`unknown operation: ${op}`);
    return handler(args as never);
  }

  setInfo(): SetInfo {
    const filePath = this.song().text("file_path");
    return { filePath: filePath || null, setId: filePath || this.setId };
  }

  meters(): MeterReading {
    const song = this.song();
    const tracks = song.ids("tracks").map((_, index) => {
      const track = song.child("tracks", index);
      return { index, name: track.text("name"), left: track.number("output_meter_left"), right: track.number("output_meter_right") };
    });
    const main = new LiveObject("live_set master_track");
    return { tracks, master: { left: main.number("output_meter_left"), right: main.number("output_meter_right") } };
  }

  isPlaying(): boolean {
    return this.song().bool("is_playing");
  }

  private song(): LiveObject {
    return new LiveObject("live_set");
  }

  private play({ from }: DeviceOpArgs["transport_play"]) {
    if (from !== undefined) this.song().set("current_song_time", from);
    this.song().call("start_playing");
    return { playing: true as const };
  }

  private transport(call: string, playing: boolean) {
    this.song().call(call);
    return { playing };
  }

  private setPosition(time: number) {
    this.song().set("current_song_time", time);
    return { time };
  }

  private toggle(property: string, on: boolean) {
    this.song().set(property, on ? 1 : 0);
    return { on };
  }

  private loop({ on, start, length }: DeviceOpArgs["loop_set"]) {
    const song = this.song();
    if (start !== undefined) song.set("loop_start", start);
    if (length !== undefined) song.set("loop_length", length);
    if (on !== undefined) song.set("loop", on ? 1 : 0);
    return { on: song.bool("loop"), start: song.number("loop_start"), length: song.number("loop_length") };
  }

  private jump(locator: LocatorRef) {
    const song = this.song();
    const points = Array.from({ length: song.count("cue_points") }, (_, index) => song.child("cue_points", index));
    const match =
      "index" in locator
        ? points[locator.index]
        : "name" in locator
          ? points.find((point) => point.text("name").toLowerCase() === locator.name.toLowerCase())
          : points.find((point) => Math.abs(point.number("time") - locator.time) < 0.001);
    if (!match) throw new Error(`not found: locator ${JSON.stringify(locator)}`);
    match.call("jump");
    return { time: match.number("time") };
  }

  private setKey({ root, scale, scaleMode }: DeviceOpArgs["song_set_key"]) {
    const song = this.song();
    song.set("root_note", root);
    song.set("scale_name", scale);
    if (scaleMode !== undefined) song.set("scale_mode", scaleMode ? 1 : 0);
    return { root: song.number("root_note"), scale: song.text("scale_name"), scaleMode: song.bool("scale_mode") };
  }

  private setTimeSignature({ numerator, denominator }: DeviceOpArgs["song_set_time_signature"]) {
    const song = this.song();
    song.set("signature_numerator", numerator);
    song.set("signature_denominator", denominator);
    return { numerator: song.number("signature_numerator"), denominator: song.number("signature_denominator") };
  }

  private createReturnTrack(): CreatedTrack {
    const song = this.song();
    song.call("create_return_track");
    const index = song.count("return_tracks") - 1;
    const track: TrackRef = { returnIndex: index };
    return { track, index, name: song.child("return_tracks", index).text("name") };
  }

  private deleteReturnTrack(index: number) {
    this.song().call("delete_return_track", index);
    return { deleted: true as const };
  }

  private captureMidi() {
    const song = this.song();
    if (!song.bool("can_capture_midi")) return { captured: false };
    song.call("capture_midi");
    return { captured: true };
  }

  private history(check: string, action: string) {
    const song = this.song();
    if (!song.bool(check)) return { done: false };
    song.call(action);
    return { done: true };
  }

  private selection(): SelectionInfo {
    const song = this.song();
    const view = new LiveObject("live_set view");
    const trackIds = song.ids("tracks");
    const selectedTrack = view.ids("selected_track")[0];
    const trackIndex = selectedTrack === undefined ? -1 : trackIds.indexOf(selectedTrack);
    const sceneIds = song.ids("scenes");
    const selectedScene = view.ids("selected_scene")[0];
    const sceneIndex = selectedScene === undefined ? -1 : sceneIds.indexOf(selectedScene);
    return {
      track: trackIndex >= 0 ? { index: trackIndex } : null,
      clip: null,
      scene: sceneIndex >= 0 ? sceneIndex : null,
      time: song.number("current_song_time"),
      isPlaying: song.bool("is_playing"),
    };
  }
}
