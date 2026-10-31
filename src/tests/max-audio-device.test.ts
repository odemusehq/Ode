import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, Script } from "node:vm";
import test from "node:test";
import { nativeStrings } from "../shared/i18n";
import { MAX_AUDIO } from "../shared/max-audio";

async function fixture(withRouting = false, names = ["Synth"], types = [{ display_name: "Synth", identifier: "actual-synth-type" as string | number }], deferTransport = false, groups: Record<number, number> = {}) {
  const messages: any[] = [], controls: any[] = [], tasks: any[] = [];
  const transportWrites: (() => void)[] = [], transportCalls: string[] = [];
  let now = 0;
  let allocatedFrames = 0, apiConstructions = 0;
  const routing = { routing_type: { display_name: "No Input", identifier: "none" }, routing_channel: { display_name: "No Input", identifier: "none" } };
  const song: Record<string, any> = { is_playing: 0, record_mode: 0, session_record: 0, current_song_time: 12, start_time: 80, loop: 1, loop_start: 8, loop_length: 8, tracks: names.flatMap((_, index) => ["id", 20 + index]), return_tracks: [] };
  const tracks = Object.fromEntries(names.map((name, index) => [20 + index, { name, mute: 0, solo: 0, is_foldable: Object.values(groups).includes(20 + index) ? 1 : 0, group_track: ["id", groups[20 + index] ?? 0], mixer_device: ["id", 200 + index] }]));
  const sends = Object.fromEntries(names.map((_, index) => [300 + index, { min: 0, value: 0.4, automation_state: 0 }]));
  class LiveAPI {
    private identifier = 1;
    get id() { return this.identifier; }
    set id(value: number) { this.identifier = value; this.path = "id " + value; }
    path: string;
    constructor(_callback: unknown, path: string) { apiConstructions++; this.path = path; if (path === "this_device") this.identifier = 30; }
    get type() { return this.path === "id 20" ? "Track" : "MaxDevice"; }
    get(key: string): any {
      if (this.path === "live_set") return [song[key]];
      if (this.path === "this_device") return key === "audio_inputs" ? (withRouting ? ["id", 101, "id", 102] : []) : key === "canonical_parent" ? ["id", 20] : ["Ode"];
      if (this.path === "id 102") {
        if (key === "available_routing_types") return [JSON.stringify({ available_routing_types: types })];
        if (key === "available_routing_channels") return [JSON.stringify({ available_routing_channels: [{ display_name: "Post FX", identifier: "actual-fx-channel" }, { display_name: "Post Mixer", identifier: "actual-mixer-channel" }] })];
        return [JSON.stringify({ [key]: routing[key as keyof typeof routing] })];
      }
      const id = Number(this.path.slice(3));
      if (key in (tracks[id] ?? {})) return [tracks[id]![key as keyof typeof tracks[number]]];
      if (key in (sends[id] ?? {})) return [sends[id]![key as keyof typeof sends[number]]];
      if (id >= 200 && id < 200 + names.length && key === "sends") return ["id", id + 100];
      if (key === "canonical_parent") return ["id", 20];
      if (key === "name") return [this.path.includes("master") ? "Main" : names[Number(this.path.slice(3)) - 20] ?? names[0]];
      return [0];
    }
    set(key: string, value: unknown) {
      if (this.path === "id 102") routing[key as keyof typeof routing] = JSON.parse(String(value));
      else if (tracks[Number(this.path.slice(3))]) {
        const apply = () => { (tracks[Number(this.path.slice(3))] as any)[key] = value; };
        if (deferTransport) transportWrites.push(apply); else apply();
      }
      else if (sends[Number(this.path.slice(3))]) {
        const apply = () => { (sends[Number(this.path.slice(3))] as any)[key] = value; };
        if (deferTransport) transportWrites.push(apply); else apply();
      }
      else if (deferTransport) transportWrites.push(() => { song[key] = value; });
      else song[key] = value;
    }
    call(name: string) {
      transportCalls.push(name);
      const apply = () => {
        if (name === "start_playing") { song.current_song_time = song.start_time; song.is_playing = 1; }
        // Live 12.4 beta resumed its earlier stop position despite a confirmed stopped seek.
        else if (name === "continue_playing") { song.current_song_time = 0; song.is_playing = 1; }
        else if (name === "stop_playing") song.is_playing = 0;
        else throw new Error(`Unexpected transport command: ${name}`);
      };
      if (deferTransport) transportWrites.push(apply); else apply();
    }
  }
  class Task {
    cancelled = false;
    constructor(readonly callback: () => void) { tasks.push(this); }
    schedule() {} repeat() {} cancel() { this.cancelled = true; } freepeer() {}
  }
  class Buffer {
    channelcount() { return 2; }
    framecount() { return allocatedFrames; }
    peek(channel: number, offset: number, count: number) { return Array.from({ length: count }, (_, index) => offset + index === 0 ? channel * 1.25 : Math.fround(Math.sin((offset + index) * 0.07) * channel * 0.25)); }
    freepeer() {}
  }
  const context = createContext({ LiveAPI, Task, Buffer, Date: deferTransport ? class extends Date { static now() { return now; } } : Date,
    ODE_AUDIO: MAX_AUDIO, ODE_AUDIO_COPY: nativeStrings.maxAudio,
    odePatcher: { getnamed: (name: string) => ({ getattr: () => "unique-buffer", message: (...args: unknown[]) => { controls.push([name, ...args]); if (name === "odeCaptureBuffer" && args[0] === "sizeinsamps") allocatedFrames = Number(args[1]); } }) },
    releaseTask: (task: Task) => task?.cancel(),
    running: true, session: "paired",
    http: (_path: string, body: any, callback: Function) => { messages.push(JSON.parse(JSON.stringify(body))); callback({ ok: true }, 200); },
  });
  new Script(await readFile(new URL("../live/max/audio.js", import.meta.url), "utf8").catch(() => "")).runInContext(context);
  assert.equal(typeof context.ode_audio_command, "function", "The embedded Max audio command handler is missing");
  context.ode_audio_rate(8000);
  context.ode_audio_dsp(1);
  context.ode_audio_buffer("unique-buffer");
  return { context, messages, controls, tasks, song, routing, tracks, sends, transportCalls, constructions: () => apiConstructions,
    flushTransport: () => { transportWrites.splice(0).forEach((apply) => apply()); }, advance: (milliseconds: number) => { now += milliseconds; } };
}

test("selected-track Main capture restores audibility and sends after completion, cancellation and conflict", async () => {
  for (const end of ["complete", "cancel", "conflict"]) {
    const names = ["Keys", "Bass", "Drums", "Band"];
    const f = await fixture(true, names, [...names, "Main"].map((display_name, index) => ({ display_name, identifier: "route-" + index })), false, { 20: 23, 21: 23 });
    f.tracks[20]!.mute = 1; f.tracks[22]!.solo = 1;
    f.context.ode_audio_command({ kind: "sources", id: "list" });
    const catalogue = f.messages.at(-1).message;
    const source = (name: string) => catalogue.sources.find((s: any) => s.trackName === name && s.stage === "post-mixer").id;
    f.context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: source("Main"), includeSourceIds: [source("Keys"), source("Bass")], durationSeconds: 1, startBeat: 0 });
    assert.equal(f.tracks[20]!.mute, 0);
    assert.equal(f.tracks[22]!.mute, 1);
    assert.equal(f.tracks[23]!.mute, 0, "The selected children's parent group must remain audible.");
    assert.equal(f.tracks[22]!.solo, 0);
    assert.equal(f.sends[302]!.value, 0, "Excluded pre-fader sends must not feed the returns.");
    assert.equal(f.sends[300]!.value, 0.4);
    f.context.ode_audio_monitor();
    if (end === "complete") f.context.ode_audio_recorded();
    else if (end === "cancel") f.context.ode_audio_command({ kind: "cancel", id: "take" });
    else { f.sends[302]!.value = 0.25; f.context.ode_audio_recorded(); }
    assert.equal(f.tracks[20]!.mute, 1);
    assert.equal(f.tracks[22]!.mute, 0);
    assert.equal(f.tracks[22]!.solo, 1);
    assert.equal(f.sends[302]!.value, end === "conflict" ? 0.25 : 0.4, "Restoration must preserve a musician's conflicting edit.");
    assert.equal(f.messages.some((m: any) => m.message.kind === "begin"), end === "complete");
  }
});

test("selected capture waits for deferred mixer writes and refuses invalid selections before changing the mix", async () => {
  const names = ["Keys", "Bass"];
  const f = await fixture(true, names, [...names, "Main"].map((display_name, index) => ({ display_name, identifier: "route-" + index })), true);
  f.context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = f.messages.at(-1).message;
  const selected = catalogue.sources.find((s: any) => s.trackName === "Keys" && s.stage === "post-mixer").id;
  const main = catalogue.sources.find((s: any) => s.kind === "main" && s.stage === "post-mixer").id;
  const request = { kind: "capture", id: "bad", catalogueId: catalogue.catalogueId, sourceId: selected, includeSourceIds: [main], durationSeconds: 1, startBeat: 0 };
  f.context.ode_audio_command(request);
  assert.equal(f.messages.at(-1).message.kind, "error");
  assert.equal(f.tracks[21]!.mute, 0);
  f.sends[301]!.automation_state = 1;
  f.context.ode_audio_command({ ...request, id: "automated", sourceId: main, includeSourceIds: [selected] });
  assert.match(f.messages.at(-1).message.error, /automated send/);
  assert.equal(f.sends[301]!.value, 0.4);
  f.sends[301]!.automation_state = 0;
  f.context.ode_audio_command({ ...request, id: "take", sourceId: main, includeSourceIds: [selected] });
  assert.equal(f.song.is_playing, 0);
  f.flushTransport(); f.context.ode_audio_monitor(); f.flushTransport(); f.context.ode_audio_monitor();
  assert.equal(f.song.is_playing, 1);
  assert.equal(f.tracks[21]!.mute, 1);
  f.context.ode_audio_command({ kind: "cancel", id: "take" }); f.flushTransport();
  assert.equal(f.tracks[21]!.mute, 0);
  assert.equal(f.sends[301]!.value, 0.4);
});

test("capture monitoring reuses native handles while still observing host changes", async () => {
  const { context, messages, constructions } = await fixture();
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1 });
  const count = constructions();
  for (let tick = 0; tick < 2000; tick++) context.ode_audio_monitor();
  assert.equal(constructions(), count, "A monitor tick must not construct more native LiveAPI objects.");
  context.odeAudio.job.deviceApi.identifier = 999;
  context.ode_audio_monitor();
  assert.equal(messages.at(-1).message.kind, "error", "Reused handles must still detect a changed device identity.");
});

test("Max acknowledges cancellation after deferred mixer restoration", async () => {
  const names = ["Keys", "Bass"];
  const f = await fixture(true, names, [...names, "Main"].map((display_name, index) => ({ display_name, identifier: "route-" + index })), true);
  f.context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = f.messages.at(-1).message;
  const id = (name: string) => catalogue.sources.find((s: any) => s.trackName === name && s.stage === "post-mixer").id;
  f.context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: id("Main"), includeSourceIds: [id("Keys")], durationSeconds: 1, startBeat: 0 });
  f.flushTransport(); f.context.ode_audio_monitor(); f.flushTransport(); f.context.ode_audio_monitor();
  f.context.ode_audio_command({ kind: "cancel", id: "take" });
  f.context.ode_audio_cancel_ready();
  assert.equal(f.messages.some((m: any) => m.message.kind === "cancelled"), false);
  f.flushTransport(); f.context.ode_audio_cancel_ready();
  assert.equal(f.messages.at(-1).message.kind, "cancelled");
  assert.equal(f.messages.at(-1).message.restored, true);
  assert.equal(f.tracks[21]!.mute, 0);
  assert.equal(f.sends[301]!.value, 0.4);
});

test("Max capture uploads ordered bounded PCM with headroom and never a file path", async () => {
  const { context, messages, controls, tasks } = await fixture();
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.find((item) => item.message.kind === "sources").message;
  const source = catalogue.sources.find((item: any) => item.stage === "device-input");
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: source.id, durationSeconds: 0.512 });
  tasks.find((task) => !task.cancelled && task.callback.name === "ode_audio_recorded").callback();
  while (tasks.some((task) => !task.cancelled && task.callback.name === "ode_audio_upload_next")) {
    const task = tasks.find((item) => !item.cancelled && item.callback.name === "ode_audio_upload_next"); task.cancelled = true; task.callback();
  }
  const payloads = messages.map((item) => item.message);
  const pcm = payloads.filter((item) => item.kind === "pcm");
  assert.ok(pcm.length > 0);
  assert.ok(messages.filter((item) => item.message.kind === "pcm").every((item) => Buffer.byteLength(JSON.stringify(item)) < 32767), "Nonzero float32 PCM and its envelope must fit Max 9.1's observed string transport limit");
  assert.deepEqual(pcm.map((item) => [item.offset, Buffer.from(item.data, "base64").length / 8]), [[0, 2048], [2048, 2048]]);
  const bytes = Buffer.concat(pcm.map((item) => Buffer.from(item.data, "base64")));
  assert.equal(bytes.readFloatLE(0), 1.25);
  assert.equal(bytes.readFloatLE(4), 2.5);
  assert.equal(bytes.readFloatLE(4095 * 8 + 4), Math.fround(Math.sin(4095 * 0.07) * 0.5));
  assert.equal(payloads.at(-1).kind, "complete");
  assert.equal(payloads.at(-1).frames, 4096);
  assert.ok(controls.some((item) => item[0] === "odeCaptureRecorder" && item[1] === 0));
  assert.equal(JSON.stringify(messages).includes("path"), false);
});

test("Max routes the auxiliary bus with returned identifiers and restores it on cancellation", async () => {
  const { context, messages, routing } = await fixture(true);
  assert.equal(context.ode_audio_routing({ get: () => ['{"identifier":65,"display_name":"Synth"}'] }, "routing_type").identifier, 65, "Flat current-routing responses remain supported");
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  assert.deepEqual(catalogue.sources.map((source: any) => source.stage), ["device-input", "post-fx", "post-mixer"]);
  assert.equal(routing.routing_type.identifier, "none", "Listing sources must restore the capture bus");
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[2].id, durationSeconds: 1 });
  assert.equal(routing.routing_type.identifier, "actual-synth-type");
  assert.equal(routing.routing_channel.identifier, "actual-mixer-channel");
  context.ode_audio_command({ kind: "cancel", id: "take" });
  assert.equal(routing.routing_type.identifier, "none");
  assert.equal(routing.routing_channel.identifier, "none");
});

test("Max matches the observed escaped Ode separator without changing the native track name", async () => {
  const { context, messages, routing, controls } = await fixture(true, ["Ode Capture Test ·capturetest"], [{ display_name: "Ode Capture Test u00b7capturetest", identifier: 65 }]);
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  assert.equal(catalogue.sources[1]?.trackName, "Ode Capture Test ·capturetest");
  assert.equal(catalogue.sources[1]?.stage, "post-fx");
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[1].id, durationSeconds: 1 });
  assert.equal(routing.routing_type.identifier, 65, "Use the actual opaque DeviceIO identifier");
  assert.ok(controls.some((item) => item[0] === "odeCaptureRecorder" && item[1] === 1), "The selected source must reach the recorder");
  context.ode_audio_command({ kind: "cancel", id: "take" });
});

test("Max refuses literal ASCII names colliding with the escaped Ode separator", async () => {
  const { context, messages } = await fixture(true, ["Test ·tag", "Test u00b7tag"], [{ display_name: "Test u00b7tag", identifier: 65 }, { display_name: "Test u00b7tag", identifier: 66 }]);
  context.ode_audio_command({ kind: "sources", id: "list" });
  assert.deepEqual(messages.at(-1).message.sources.map((source: any) => source.stage), ["device-input"], "An exact ASCII match must not override another native track's projected match");
});

test("Max refuses multiple routing entries that match the same native track", async () => {
  const { context, messages } = await fixture(true, ["Test ·tag"], [{ display_name: "Test ·tag", identifier: 65 }, { display_name: "Test u00b7tag", identifier: 66 }]);
  context.ode_audio_command({ kind: "sources", id: "list" });
  assert.deepEqual(messages.at(-1).message.sources.map((source: any) => source.stage), ["device-input"]);
});

test("Max refuses excessive allocation and discards a take if its sample rate changes", async () => {
  const { context, messages, controls, tasks } = await fixture();
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_rate(192000);
  context.ode_audio_command({ kind: "capture", id: "large", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 300 });
  assert.equal(messages.at(-1).message.kind, "error");
  assert.equal(controls.some((item) => item[1] === "sizeinsamps"), false);
  context.ode_audio_rate(8000);
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1 });
  context.ode_audio_rate(48000);
  tasks.find((task) => !task.cancelled && task.callback.name === "ode_audio_recorded").callback();
  assert.equal(messages.at(-1).message.kind, "error");
  assert.equal(messages.some((item) => item.message.kind === "begin"), false);
});

test("Max discards a take after manual rerouting and preserves the musician's new route", async () => {
  const { context, messages, routing, tasks } = await fixture(true);
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[1].id, durationSeconds: 1 });
  routing.routing_channel = { display_name: "Different stage", identifier: "manual-choice" };
  tasks.find((task) => !task.cancelled && task.callback.name === "ode_audio_recorded").callback();
  assert.equal(messages.at(-1).message.kind, "error");
  assert.equal(messages.some((item) => item.message.kind === "begin"), false);
  assert.equal(routing.routing_channel.identifier, "manual-choice");
});

test("Max capture refuses stale sources and restores only transport it started", async () => {
  const { context, messages, song } = await fixture();
  context.ode_audio_command({ kind: "capture", id: "stale", catalogueId: "old", sourceId: "old", durationSeconds: 1 });
  assert.equal(messages.at(-1).message.kind, "error");
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1, startBeat: 16, prerollBeats: 4 });
  assert.equal(song.is_playing, 1);
  assert.equal(song.loop, 0);
  context.ode_audio_command({ kind: "cancel", id: "take" });
  assert.equal(song.is_playing, 0);
  assert.equal(song.current_song_time, 12);
  assert.equal(song.loop, 1);
});

test("Max waits for its deferred seek and start before recording", async () => {
  const { context, messages, controls, song, transportCalls, flushTransport } = await fixture(false, undefined, undefined, true);
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1, startBeat: 16 });
  context.ode_audio_monitor();
  assert.equal(messages.some((item) => item.message.kind === "error"), false, "Its own pending seek is not a manual change");
  assert.deepEqual(transportCalls, []);
  flushTransport(); context.ode_audio_monitor(); context.ode_audio_monitor();
  assert.deepEqual(transportCalls, ["start_playing"], "Start once, after the requested stopped position and marker are confirmed");
  assert.equal(controls.some((item) => item[0] === "odeCaptureRecorder" && item[1] === 1), false);
  flushTransport(); context.ode_audio_monitor();
  assert.ok(controls.some((item) => item[0] === "odeCaptureRecorder" && item[1] === 1));
  context.ode_audio_command({ kind: "cancel", id: "take" }); flushTransport();
  assert.equal(song.is_playing, 0);
  assert.equal(song.current_song_time, 12);
  assert.equal(song.loop, 1);
});

test("Max startup cleanup cancels queued starts and preserves subsequent manual changes", async () => {
  for (const reason of ["cancel", "timeout", "loop", "seek", "stop"]) {
    const { context, messages, song, transportCalls, flushTransport, advance } = await fixture(false, undefined, undefined, true);
    context.ode_audio_command({ kind: "sources", id: "list" });
    const catalogue = messages.at(-1).message;
    context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1, startBeat: 16 });
    flushTransport(); context.ode_audio_monitor();
    assert.equal(song.is_playing, 0);
    if (reason === "cancel") context.ode_audio_command({ kind: "cancel", id: "take" });
    else if (reason === "stop") {
      flushTransport(); context.ode_audio_monitor();
      song.is_playing = 0; song.current_song_time = 17;
      context.ode_audio_command({ kind: "cancel", id: "take" });
    } else {
      if (reason === "timeout") advance(2100);
      if (reason === "loop") song.loop = 1;
      if (reason === "seek") { flushTransport(); song.current_song_time = 64; }
      context.ode_audio_monitor(); assert.equal(messages.at(-1).message.kind, "error");
    }
    assert.deepEqual(transportCalls, reason === "stop" ? ["start_playing"] : ["start_playing", "stop_playing"], reason);
    flushTransport();
    assert.equal(song.is_playing, 0, "A queued start must not escape after the capture ends");
    assert.equal(song.current_song_time, reason === "seek" ? 64 : reason === "stop" ? 17 : reason === "loop" ? 16 : 12, reason);
    assert.equal(song.loop, 1);
  }
});

test("Max range capture sets its playback marker and restores the musician's marker", async () => {
  const { context, messages, controls, song, flushTransport, advance } = await fixture(false, undefined, undefined, true);
  context.ode_audio_command({ kind: "sources", id: "list" });
  const catalogue = messages.at(-1).message;
  context.ode_audio_command({ kind: "capture", id: "take", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1, startBeat: 16, prerollBeats: 4 });
  flushTransport(); context.ode_audio_monitor();
  flushTransport(); context.ode_audio_monitor();
  assert.equal(song.current_song_time, 12);
  assert.equal(messages.some((item) => item.message.kind === "error"), false);
  advance(2500); song.current_song_time = 16; context.ode_audio_monitor();
  assert.ok(controls.some((item) => item[0] === "odeCaptureRecorder" && item[1] === 1));
  assert.equal(song.start_time, 12);
  context.ode_audio_command({ kind: "cancel", id: "take" }); flushTransport();
  assert.equal(song.start_time, 80);
  context.ode_audio_command({ kind: "capture", id: "another", catalogueId: catalogue.catalogueId, sourceId: catalogue.sources[0].id, durationSeconds: 1, startBeat: 16 });
  flushTransport(); context.ode_audio_monitor(); flushTransport();
  song.start_time = 32;
  context.ode_audio_command({ kind: "cancel", id: "another" }); flushTransport();
  assert.equal(song.start_time, 32, "A later manual marker change is preserved.");
});
