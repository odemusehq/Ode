import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { MaxDawControl } from "../server/max-daw";
import { MaxWindowBridge } from "../server/max-window";
import { MAX_DAW } from "../shared/max-daw";
import { nativeStrings } from "../shared/i18n";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import { z } from "zod";

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
    live_set: { id: "80", type: "Song", record_mode: 0, session_record: 0 },
    "live_set view": { id: "81", type: "Song.View", selected_track: ["id", 99], detail_clip: ["id", 0] },
    "live_set tracks 0": { id: "1", type: "Track", name: "Lead" },
    "live_set tracks 0 devices 0": { id: "2", type: "PluginDevice", name: "Singer", presets: ["Soft", "Bright"], selected_preset_index: 0, is_editor_open: 0 },
  };
  const sent: any[] = [], writes: any[] = [];
  class LiveAPI {
    constructor(_callback: unknown, readonly path: string) {}
    get id() { return objects[this.path]?.id ?? "0"; }
    get type() { return objects[this.path]?.type; }
    get info() { return objects[this.path]?.info ?? ""; }
    get(key: string) { if (!(key in objects[this.path])) throw new Error(`unsupported ${key}`); return objects[this.path][key]; }
    set(key: string, value: unknown) { writes.push([this.path, key, value]); objects[this.path][key] = value; }
    call(name: string, ...args: unknown[]) { writes.push([this.path, name, ...args]); return objects[this.path]?.call?.(name, ...args); }
  }
  const vm: any = { LiveAPI, running: true, session: "private", ODE_DAW: MAX_DAW, ODE_DAW_COPY: nativeStrings.maxDaw,
    http: (_path: string, body: any) => sent.push(body.message) };
  runInNewContext(await readFile(new URL("../live/max/daw.js", import.meta.url), "utf8"), vm);
  let sequence = 0;
  const address = { path: "live_set tracks 0 devices 0", guards: [{ path: "live_set tracks 0", name: "Lead" }, { path: "live_set tracks 0 devices 0", name: "Singer" }] };
  const run = (op: string, args: object = {}, target: any = address, id = String(++sequence)) => {
    vm.ode_daw_command({ id, op, args, address: target, scope: "request", expiresAt: Date.now() + 30_000 });
    return sent.at(-1);
  };
  return { objects, writes, run, address, vm };
}

async function nativeNotesFixture() {
  const fixture = await nativeDawFixture();
  const path = "live_set tracks 0 arrangement_clips 0";
  let notes = [
    { note_id: 11, pitch: 60, start_time: 0, duration: 1, velocity: 90, mute: 0, probability: 1, velocity_deviation: 3, release_velocity: 20, future_field: "keep" },
    { note_id: 12, pitch: 64, start_time: 1, duration: 0.5, velocity: 70, mute: 0, probability: 0.8, velocity_deviation: 0, release_velocity: 30, future_field: "other" },
  ];
  fixture.objects[path] = { id: "9", type: "Clip", name: "Hook", is_audio_clip: 0, is_recording: 0,
    call(name: string, payload?: string) {
      if (name === "get_all_notes_extended") return JSON.stringify({ notes });
      if (name === "apply_note_modifications") {
        const changes = JSON.parse(payload!).notes;
        notes = notes.map(note => changes.find((change: any) => change.note_id === note.note_id) ?? note);
      }
    } };
  const address = { path, guards: [{ path: "live_set tracks 0", name: "Lead" }, { path, name: "Hook" }] };
  return { ...fixture, path, address, notes: () => notes };
}

test("native note IDs apply absolute fields to only selected returned notes and read back", async () => {
  const { run, writes, address, notes } = await nativeNotesFixture();
  const read = run("midi_notes_read", { limit: 1 }, address);
  assert.equal(read.ok, true, read.error);
  assert.equal(read.result.notes[0].note_id, 11);
  assert.equal(read.result.nextOffset, 1);
  assert.equal(read.result.total, 2);
  const input = { readToken: read.result.readToken, notes: [{ note_id: 11, pitch: 48, velocity: 80 }] };
  const written = run("midi_notes_modify", input, address, "native-edit");
  assert.equal(written.ok, true, written.error);
  assert.equal(written.result.confirmed, true);
  assert.equal(written.result.before[0].pitch, 60);
  assert.equal(written.result.after[0].pitch, 48);
  const changes = writes.filter(([, name]) => name === "apply_note_modifications");
  assert.equal(changes.length, 1);
  const payload = JSON.parse(changes[0]![2]);
  assert.deepEqual(payload.notes, [{ note_id: 11, pitch: 48, start_time: 0, duration: 1, velocity: 80, mute: 0, probability: 1, velocity_deviation: 3, release_velocity: 20, future_field: "keep" }]);
  assert.equal(notes()[1]!.pitch, 64);
  run("midi_notes_modify", input, address, "native-edit");
  assert.equal(writes.filter(([, name]) => name === "apply_note_modifications").length, 1);
});

test("native note guards refuse stale, unseen or missing IDs, recording and relative operations", async () => {
  const { run, writes, address, notes, objects, path } = await nativeNotesFixture();
  const read = () => run("midi_notes_read", { limit: 1 }, address).result.readToken;
  const edit = (readToken: string, changes: object[]) => run("midi_notes_modify", { readToken, notes: changes }, address);
  assert.equal(edit(read(), [{ note_id: 12, pitch: 52 }]).ok, false, "An ID outside the returned page is not authorised.");
  assert.equal(edit(read(), [{ note_id: 999, pitch: 48 }]).ok, false);
  assert.equal(edit(read(), [{ note_id: 11, transpose: -12 }]).ok, false);
  const stale = read(); notes()[1]!.velocity = 71;
  assert.equal(edit(stale, [{ note_id: 11, pitch: 48 }]).ok, false);
  const replaced = read(); objects[path].id = "10";
  assert.equal(edit(replaced, [{ note_id: 11, pitch: 48 }]).ok, false);
  const recording = read(); objects.live_set.record_mode = 1;
  assert.equal(edit(recording, [{ note_id: 11, pitch: 48 }]).ok, false);
  objects.live_set.record_mode = 0; objects[path].is_recording = 1;
  assert.equal(edit(read(), [{ note_id: 11, pitch: 48 }]).ok, false);
  assert.equal(writes.filter(([, name]) => name === "apply_note_modifications").length, 0);
});

test("native beat windows authorise only queried IDs while retaining the complete clip guard", async () => {
  const { run, writes, address, notes, objects, path } = await nativeNotesFixture();
  const nativeCall = objects[path].call;
  objects[path].call = (name: string, ...args: unknown[]) => name === "get_notes_extended"
    ? JSON.stringify({ notes: [notes()[1]] }) : nativeCall(name, ...args);
  const window = { start: 0.75, length: 0.5 };
  const read = () => run("midi_notes_read", { window, limit: 1 }, address);
  const first = read();
  assert.equal(first.ok, true, first.error);
  assert.equal(first.result.total, 1);
  assert.equal(first.result.notes[0].note_id, 12);
  assert.deepEqual(writes.find(([, name]) => name === "get_notes_extended"), [path, "get_notes_extended", 0, 128, 0.75, 0.5]);
  assert.equal(run("midi_notes_modify", { readToken: first.result.readToken, notes: [{ note_id: 11, pitch: 48 }] }, address).ok, false);
  const stale = read().result.readToken; notes()[0]!.velocity = 89;
  assert.equal(run("midi_notes_modify", { readToken: stale, notes: [{ note_id: 12, pitch: 52 }] }, address).ok, false);
  const edited = run("midi_notes_modify", { readToken: read().result.readToken, notes: [{ note_id: 12, pitch: 52 }] }, address);
  assert.equal(edited.ok, true, edited.error);
  assert.equal(edited.result.confirmed, true);
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask");
  const control = new MaxDawControl(bridge);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, undefined, 2);
  const pending = control.run("midi_notes_read", null, {}, "request");
  const command = bridge.poll(session).daw!;
  control.receive(session, { id: command.id, ok: true, result: { notes: [] } });
  assert.deepEqual(await pending, { notes: [] });
  await assert.rejects(control.run("midi_notes_read", null, { window }, "request"), /updated/i);
});

test("native note tools negotiate updated devices and reject malformed patches before dispatch", async () => {
  const registry = new ToolRegistry({} as ToolContext);
  assert.equal(registry.group("midi_clip_get_notes_native"), "daw_read");
  assert.equal(registry.group("midi_clip_modify_notes_native"), "daw_write");
  const schema = z.object(registry.find("midi_clip_modify_notes_native")!.input);
  const base = { clip: { track: { index: 0 }, start: 0 }, readToken: "read" };
  assert.equal(schema.safeParse({ ...base, notes: [{ note_id: 11, pitch: 48 }] }).success, true);
  for (const notes of [[{ note_id: 11 }], [{ note_id: 11, transpose: -12 }], [{ note_id: 11, pitch: 128 }], [{ note_id: 11, pitch: 48 }, { note_id: 11, velocity: 80 }]]) {
    assert.equal(schema.safeParse({ ...base, notes }).success, false);
  }
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask");
  const control = new MaxDawControl(bridge);
  bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, undefined, 1);
  await assert.rejects(control.run("midi_notes_read" as never, null, {}, "request"), /updated/i);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, undefined, MAX_DAW.version);
  const pending = control.run("midi_notes_read" as never, null, {}, "request");
  const command = bridge.poll(session).daw!;
  assert.equal(command.op, "midi_notes_read");
  control.receive(session, { id: command.id, ok: true, result: { notes: [] } });
  assert.deepEqual(await pending, { notes: [] });
  const fixture = await nativeNotesFixture();
  const tools = new ToolRegistry({ song: { read: async () => ({ locked: [] }) },
    live: { extension: { call: async () => fixture.address } },
    maxDaw: { run: async (op: string, address: unknown, args: object) => {
      const reply = fixture.run(op, args, address);
      if (!reply.ok) throw new Error(reply.error);
      return reply.result;
    } },
  } as unknown as ToolContext);
  assert.equal(tools.functions(["midi_clip_get_notes_native", "midi_clip_modify_notes_native"]).length, 2);
  const read = await tools.run("midi_clip_get_notes_native", { clip: base.clip }, undefined, { exchangeId: "request" });
  assert.equal(read.ok, true, read.text);
  const changed = await tools.run("midi_clip_modify_notes_native", { ...base, readToken: JSON.parse(read.text).readToken, notes: [{ note_id: 11, pitch: 48 }] }, undefined, { exchangeId: "request" });
  assert.equal(changed.ok, true, changed.text);
  assert.equal(JSON.parse(changed.text).confirmed, true);
  assert.equal(changed.receipts?.[0]?.kind, "unverified", "History must not infer an inverse that would replace IDs/MPE.");
  assert.match(changed.receipts?.[0]?.reason ?? "", /MPE/);
});

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

test("existing native grooves can be discovered and assigned with current clip and groove identities", async () => {
  const { run, objects, writes } = await nativeDawFixture();
  objects['live_set groove_pool'] = { id: '90', type: 'GroovePool', grooves: ['id', 91] };
  objects['live_set groove_pool grooves 0'] = { id: '91', type: 'Groove', name: 'Swing', base: 3, timing_amount: 0.6 };
  const path = 'live_set tracks 0 arrangement_clips 0';
  objects[path] = { id: '3', type: 'Clip', name: 'Beat', is_audio_clip: 0, is_recording: 0, groove: ['id', 0], start_marker: 0, end_marker: 8, loop_start: 0, loop_end: 8 };
  const address = { path, guards: [{ path: 'live_set tracks 0', name: 'Lead' }, { path, name: 'Beat' }] };
  const pool = run('groove_pool_read', {}, null);
  assert.equal(pool.ok, true, pool.error);
  assert.equal(pool.result.grooves[0].id, '91');
  const read = () => run('clip_read', {}, address).result.readToken;
  const selected = run('clip_groove_set', { readToken: read(), groove: { id: '91', name: 'Swing' } }, address);
  assert.equal(selected.ok, true, selected.error);
  assert.deepEqual(JSON.parse(JSON.stringify(writes.at(-1))), [path, 'groove', ['id', 91]]);
  assert.equal(selected.result.after.groove.id, '91');
  const stale = read(); objects[path].loop_end = 4;
  assert.equal(run('clip_groove_set', { readToken: stale, groove: null }, address).ok, false);
  objects['live_set groove_pool grooves 0'].name = 'Renamed';
  assert.equal(run('clip_groove_set', { readToken: read(), groove: { id: '91', name: 'Swing' } }, address).ok, false);
  assert.equal(run('clip_groove_set', { readToken: read(), groove: { id: '999', name: 'Missing' } }, address).ok, false);
  objects[path].is_recording = 1;
  assert.equal(run('clip_groove_set', { readToken: read(), groove: null }, address).ok, false);
  objects[path].is_recording = 0;
  assert.equal(run('clip_groove_set', { readToken: read(), groove: null }, address).ok, true);
});

test("track routing uses offered native identifiers and meters stay in native units", async () => {
  const { run, objects, writes } = await nativeDawFixture();
  const path = "live_set tracks 0";
  const address = { path, guards: [{ path, name: "Lead" }] };
  const first = { display_name: "Ext. In", identifier: "external" }, next = { display_name: "Resampling", identifier: 13 };
  Object.assign(objects[path], { available_input_routing_types: JSON.stringify({ available_input_routing_types: [first, next] }), input_routing_type: JSON.stringify(first),
    input_meter_level: 0.25, output_meter_left: 0.6, output_meter_right: 0.5, output_meter_level: 0.65 });
  const read = run("track_routing_read", {}, address);
  assert.equal(read.ok, true, read.error);
  assert.equal(read.result.available_input_routing_types[1].identifier, 13);
  assert.equal(run("track_routing_set", { readToken: read.result.readToken, field: "input_routing_type", identifier: "invented" }, address).ok, false);
  const token = run("track_routing_read", {}, address).result.readToken;
  assert.equal(run("track_routing_set", { readToken: token, field: "input_routing_type", identifier: 13 }, address).ok, true);
  assert.deepEqual(JSON.parse(writes.at(-1)[2][0]), { input_routing_type: next });
  const unknown = run("track_routing_read", {}, address).result.readToken;
  objects.live_set.record_mode = null;
  assert.equal(run("track_routing_set", { readToken: unknown, field: "input_routing_type", identifier: "external" }, address).ok, false);
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
  objects.live_set = { id: "80", type: "Song", is_playing: 0, record_mode: 0, session_record: 0, current_song_time: 16, start_time: 0, loop_start: 0, loop_length: 16, back_to_arranger: 0 };
  const first = run("transport_read", {}, null);
  assert.equal(first.ok, true, first.error);
  assert.equal(run("transport_set", { readToken: first.result.readToken, action: "record_mode", value: true }, null).ok, false);
  assert.equal(writes.length, 0);
  const unprepared = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: unprepared, action: "play" }, null).ok, false);
  const seek = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: seek, action: "current_song_time", value: 48 }, null).ok, true);
  assert.deepEqual(writes.slice(-2), [["live_set", "start_time", 48], ["live_set", "current_song_time", 48]]);
  const rehearsal = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: rehearsal, action: "play" }, null).ok, true);
  assert.deepEqual(writes.at(-1), ["live_set", "start_playing"], "Rehearsal starts from the confirmed insert marker.");
  objects.live_set.record_mode = 1; // The musician operates Live's Record control.
  const recording = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: recording, action: "current_song_time", value: 0 }, null).ok, false);
  const armed = run("transport_read", {}, null).result.readToken;
  assert.equal(run("transport_set", { readToken: armed, action: "play" }, null).ok, false);
  objects.live_set.record_mode = 0; objects.live_set.is_playing = 1;
  const moving = run("transport_read", {}, null).result.readToken;
  objects.live_set.current_song_time = 20;
  assert.equal(run("transport_set", { readToken: moving, action: "stop" }, null).ok, true);
  assert.deepEqual(writes.at(-1), ["live_set", "stop_playing"]);
});

test("Simpler and Drum Rack edits use their native sample and chain controls", async () => {
  const { run, objects, writes, address } = await nativeDawFixture();
  Object.assign(objects[address.path], { type: "Device", class_name: "OriginalSimpler", playback_mode: 0, voices: 8, retrigger: 1, multi_sample_mode: 0 });
  const samplePath = address.path + " sample";
  objects[samplePath] = { id: "10", type: "Sample", file_path: "/song/kick.wav", start_marker: 0, end_marker: 48000, length: 48000, sample_rate: 48000, slices: [0, 24000] };
  const read = run("simpler_read");
  assert.equal(read.ok, true, read.error);
  assert.equal(read.result.sample.length, 48000);
  assert.equal(run("simpler_set", { readToken: read.result.readToken, field: "sample.start_marker", value: 256 }).ok, true);
  assert.deepEqual(writes.at(-1), [samplePath, "start_marker", 256]);
  const stale = run("simpler_read").result.readToken;
  objects[samplePath].id = "11";
  assert.equal(run("simpler_set", { readToken: stale, field: "sample.start_marker", value: 512 }).ok, false);
  Object.assign(objects[address.path], { type: "Device", class_name: "DrumGroupDevice" });
  const chainPath = address.path + " chains 0";
  objects[chainPath] = { id: "12", type: "DrumChain", name: "Hat", in_note: 42, out_note: 60, choke_group: 0 };
  const chain = run("drum_chain_read", { chain: 0 });
  assert.equal(chain.ok, true, chain.error);
  assert.equal(run("drum_chain_set", { chain: 0, readToken: chain.result.readToken, field: "choke_group", value: 1 }).ok, true);
  assert.deepEqual(writes.at(-1), [chainPath, "choke_group", 1]);
});

test("large plugin catalogues do not turn a completed preset change into an oversized error", async () => {
  const { run, objects, address } = await nativeDawFixture();
  objects[address.path].presets = Array.from({ length: 5000 }, (_, index) => `Preset ${index} with a long descriptive name`);
  const read = run("plugin_read", { offset: 4998, limit: 2 });
  assert.equal(read.result.presets.length, 2);
  const changed = run("plugin_preset", { readToken: read.result.readToken, index: 4999 });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(changed.result.after.selectedPresetIndex, 4999);
  assert.ok(JSON.stringify(changed).length < 2048);
});

test("a delayed native command expires before touching the host", async () => {
  const { vm, writes, address } = await nativeDawFixture();
  vm.ode_daw_command({ id: "expired", op: "device_show", args: { editor: true }, address, scope: "request", expiresAt: Date.now() - 1 });
  assert.equal(writes.length, 0);
});

test("revealing a device selects its containing track and clip IDs use one list value", async () => {
  const { run, writes, objects } = await nativeDawFixture();
  assert.equal(run("device_show").ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(writes.slice(0, 2))), [
    ["live_set view", "selected_track", ["id", 1]], ["live_set view", "select_device", "id", 2],
  ]);
  const path = "live_set tracks 0 arrangement_clips 0";
  objects[path] = { id: "10", type: "Clip", name: "Humming" };
  assert.equal(run("clip_show", {}, { path, guards: [{ path: "live_set tracks 0", name: "Lead" }, { path, name: "Humming" }] }).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(objects["live_set view"].detail_clip)), ["id", 10]);
});

test("device introspection returns actual bounded Live metadata without executing it", async () => {
  const { run, objects, address, writes } = await nativeDawFixture();
  objects[address.path].info = "type PluginDevice\nproperty selected_preset_index int\nproperty is_editor_open bool";
  objects[address.path].class_name = "PluginDevice";
  const info = run("device_info", { offset: 5, limit: 12 });
  assert.equal(info.ok, true, info.error);
  assert.equal(info.result.className, "PluginDevice");
  assert.equal(info.result.nativeApi.text, objects[address.path].info.slice(5, 17));
  assert.equal(info.result.nativeApi.nextOffset, 17);
  assert.equal(writes.length, 0);
});
