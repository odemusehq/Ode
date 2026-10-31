import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { MaxDawControl } from "../server/max-daw";
import { MaxWindowBridge } from "../server/max-window";
import { MAX_DAW } from "../shared/max-daw";
import { nativeStrings } from "../shared/i18n";

test("native DAW commands require a capable session and cancel queued work", async () => {
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask");
  const control = new MaxDawControl(bridge);
  bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability);
  await assert.rejects(control.run("plugin_read", null, {}, "request"), /updated/i);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, undefined, 1);
  const abort = new AbortController();
  const cancelled = assert.rejects(control.run("plugin_read", null, {}, "request", abort.signal), /cancel/i);
  abort.abort();
  await cancelled;
  assert.equal(bridge.poll(session).daw, null);
  const pending = control.run("plugin_read", null, {}, "request");
  const command = bridge.poll(session).daw!;
  assert.throws(() => control.receive("0".repeat(48), { id: command.id, ok: true, result: {} }), /connect/i);
  control.receive(session, { id: command.id, ok: true, result: { presets: [] } });
  assert.deepEqual(await pending, { presets: [] });
});

export async function nativeDawFixture() {
  const objects: Record<string, any> = {
    "live_set tracks 0": { id: "1", type: "Track", name: "Lead" },
    "live_set tracks 0 devices 0": { id: "2", type: "PluginDevice", name: "Singer", presets: ["Soft", "Bright"], selected_preset_index: 0, is_editor_open: 0 },
  };
  const sent: any[] = [], writes: any[] = [];
  class LiveAPI {
    constructor(_callback: unknown, readonly path: string) {}
    get id() { return objects[this.path]?.id ?? "0"; }
    get type() { return objects[this.path]?.type; }
    get(key: string) { if (!(key in objects[this.path])) throw new Error(`unsupported ${key}`); return objects[this.path][key]; }
    set(key: string, value: unknown) { writes.push([this.path, key, value]); objects[this.path][key] = value; }
    call(name: string, ...args: unknown[]) { writes.push([this.path, name, ...args]); }
  }
  const vm: any = { LiveAPI, running: true, session: "private", ODE_DAW: MAX_DAW, ODE_DAW_COPY: nativeStrings.maxDaw,
    http: (_path: string, body: any) => sent.push(body.message) };
  runInNewContext(await readFile(new URL("../live/max/daw.js", import.meta.url), "utf8"), vm);
  let sequence = 0;
  const address = { path: "live_set tracks 0 devices 0", guards: [{ path: "live_set tracks 0", name: "Lead" }, { path: "live_set tracks 0 devices 0", name: "Singer" }] };
  const run = (op: string, args: object = {}, target: any = address, id = String(++sequence)) => {
    vm.ode_daw_command({ id, op, args, address: target, scope: "request" });
    return sent.at(-1);
  };
  return { objects, writes, run, address, vm };
}

test("loaded plugin presets use native values, stale guards and replay protection", async () => {
  const { run, writes, objects, address } = await nativeDawFixture();
  const read = run("plugin_read");
  assert.deepEqual(Array.from(read.result.presets, (preset: any) => preset.name), ["Soft", "Bright"]);
  const args = { readToken: read.result.readToken, index: 1 };
  const chosen = run("plugin_preset", args, address, "change");
  assert.equal(chosen.ok, true, chosen.error);
  assert.equal(chosen.result.after.selectedPresetIndex, 1);
  run("plugin_preset", args, address, "change");
  assert.equal(writes.length, 1);
  const stale = run("plugin_read").result.readToken;
  objects[address.path].selected_preset_index = 0;
  assert.equal(run("plugin_preset", { readToken: stale, index: 1 }).ok, false);
  assert.equal(run("device_show", { editor: true }).ok, true);
  assert.equal(objects[address.path].is_editor_open, 1);
  objects[address.path].type = "Operator";
  assert.equal(run("plugin_read").ok, false);
});

test("track routing uses offered native identifiers and meters stay in native units", async () => {
  const { run, objects, writes } = await nativeDawFixture();
  const path = "live_set tracks 0";
  const address = { path, guards: [{ path, name: "Lead" }] };
  const first = { display_name: "Ext. In", identifier: "external" }, next = { display_name: "Resampling", identifier: "resample" };
  Object.assign(objects[path], { available_input_routing_types: JSON.stringify({ available_input_routing_types: [first, next] }), input_routing_type: JSON.stringify(first),
    input_meter_level: 0.25, output_meter_left: 0.6, output_meter_right: 0.5, output_meter_level: 0.65 });
  const read = run("track_routing_read", {}, address);
  assert.equal(read.ok, true, read.error);
  assert.equal(read.result.available_input_routing_types[1].identifier, "resample");
  assert.equal(run("track_routing_set", { readToken: read.result.readToken, field: "input_routing_type", identifier: "invented" }, address).ok, false);
  const token = run("track_routing_read", {}, address).result.readToken;
  assert.equal(run("track_routing_set", { readToken: token, field: "input_routing_type", identifier: "resample" }, address).ok, true);
  assert.deepEqual(JSON.parse(writes.at(-1)[2]), next);
  const meters = run("track_meters", {}, address).result;
  assert.equal(meters.output_meter_level, 0.65);
  assert.equal(meters.input_meter_right, null);
});

test("native clip edits preserve the source and refuse stale or recording clips", async () => {
  const { run, objects, writes } = await nativeDawFixture();
  const path = "live_set tracks 0 arrangement_clips 0";
  objects[path] = { id: "9", type: "Clip", name: "Vocal", is_audio_clip: 1, is_recording: 0, file_path: "/song/voice.wav", start_time: 16,
    gain: 0.5, gain_display_string: "0 dB", pitch_coarse: 0, pitch_fine: 0, start_marker: 0, end_marker: 8, loop_start: 0, loop_end: 8,
    warping: 1, warp_markers: { warp_markers: [{ beat_time: 0, sample_time: 0 }] } };
  const address = { path, guards: [{ path: "live_set tracks 0", name: "Lead" }, { path, name: "Vocal" }], clip: { startTime: 16, filePath: "/song/voice.wav" } };
  const read = run("clip_read", {}, address);
  assert.equal(read.ok, true, read.error);
  assert.equal(read.result.gain_display_string, "0 dB");
  assert.equal(run("clip_set", { readToken: read.result.readToken, field: "pitch_coarse", value: 2 }, address).ok, true);
  assert.deepEqual(writes.at(-1), [path, "pitch_coarse", 2]);
  assert.equal(objects[path].file_path, "/song/voice.wav");
  const stale = run("clip_read", {}, address).result.readToken;
  objects[path].gain = 0.4;
  assert.equal(run("clip_set", { readToken: stale, field: "gain", value: 0.6 }, address).ok, false);
  const recording = run("clip_read", {}, address).result.readToken;
  objects[path].is_recording = 1;
  assert.equal(run("clip_set", { readToken: recording, field: "gain", value: 0.6 }, address).ok, false);
  objects[path].is_recording = 0;
  const token = run("clip_read", {}, address).result.readToken;
  assert.equal(run("clip_warp", { readToken: token, action: "move", beatTime: 0, distance: 0.25 }, address).ok, true);
  assert.deepEqual(writes.at(-1), [path, "move_warp_marker", 0, 0.25]);
});

test("transport reads tolerate playback progress but recording prevents seeking", async () => {
  const { run, objects, writes } = await nativeDawFixture();
  objects.live_set = { id: "80", type: "Song", is_playing: 0, record_mode: 0, session_record: 0, current_song_time: 16, loop_start: 0, loop_length: 16, back_to_arranger: 0 };
  const first = run("transport_read", {}, null);
  assert.equal(first.ok, true, first.error);
  assert.equal(run("transport_set", { readToken: first.result.readToken, action: "record_mode", value: true }, null).ok, true);
  const recording = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: recording, action: "current_song_time", value: 0 }, null).ok, false);
  objects.live_set.record_mode = 0; objects.live_set.is_playing = 1;
  const moving = run("transport_read", {}, null).result.readToken;
  objects.live_set.current_song_time = 20;
  assert.equal(run("transport_set", { readToken: moving, action: "stop" }, null).ok, true);
  assert.deepEqual(writes.at(-1), ["live_set", "stop_playing"]);
});
