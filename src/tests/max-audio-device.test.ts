import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, Script } from "node:vm";
import test from "node:test";
import { nativeStrings } from "../shared/i18n";
import { MAX_AUDIO } from "../shared/max-audio";

async function fixture(withRouting = false, names = ["Synth"], types = [{ display_name: "Synth", identifier: "actual-synth-type" as string | number }], deferTransport = false) {
  const messages: any[] = [], controls: any[] = [], tasks: any[] = [];
  const transportWrites: (() => void)[] = [], transportCalls: string[] = [];
  let now = 0;
  let allocatedFrames = 0;
  const routing = { routing_type: { display_name: "No Input", identifier: "none" }, routing_channel: { display_name: "No Input", identifier: "none" } };
  const song: Record<string, any> = { is_playing: 0, record_mode: 0, session_record: 0, current_song_time: 12, start_time: 80, loop: 1, loop_start: 8, loop_length: 8, tracks: names.flatMap((_, index) => ["id", 20 + index]), return_tracks: [] };
  class LiveAPI {
    id = 1;
    path: string;
    constructor(_callback: unknown, path: string) { this.path = path; if (path === "this_device") this.id = 30; }
    get type() { return this.path === "id 20" ? "Track" : "MaxDevice"; }
    get(key: string): any {
      if (this.path === "live_set") return [song[key]];
      if (this.path === "this_device") return key === "audio_inputs" ? (withRouting ? ["id", 101, "id", 102] : []) : key === "canonical_parent" ? ["id", 20] : ["Ode"];
      if (this.path === "id 102") {
        if (key === "available_routing_types") return [JSON.stringify({ available_routing_types: types })];
        if (key === "available_routing_channels") return [JSON.stringify({ available_routing_channels: [{ display_name: "Post FX", identifier: "actual-fx-channel" }, { display_name: "Post Mixer", identifier: "actual-mixer-channel" }] })];
        return [JSON.stringify({ [key]: routing[key as keyof typeof routing] })];
      }
      if (key === "canonical_parent") return ["id", 20];
      if (key === "name") return [this.path.includes("master") ? "Main" : names[Number(this.path.slice(3)) - 20] ?? names[0]];
      return [0];
    }
    set(key: string, value: unknown) {
      if (this.path === "id 102") routing[key as keyof typeof routing] = JSON.parse(String(value));
      else if (deferTransport) transportWrites.push(() => { song[key] = value; });
      else song[key] = value;
    }
    call(name: string) {
      transportCalls.push(name);
      const apply = () => {
        if (name === "start_playing") { song.current_song_time = song.start_time; song.is_playing = 1; }
        else if (name === "continue_playing") song.is_playing = 1;
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
  return { context, messages, controls, tasks, song, routing, transportCalls,
    flushTransport: () => { transportWrites.splice(0).forEach((apply) => apply()); }, advance: (milliseconds: number) => { now += milliseconds; } };
}

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
  assert.ok(messages.filter((item) => item.message.kind === "chunk").every((item) => Buffer.byteLength(JSON.stringify(item)) < 32767), "Nonzero float32 PCM and its envelope must fit Max 9.1's observed string transport limit");
  assert.deepEqual(payloads.filter((item) => item.kind === "chunk").map((item) => [item.offset, item.channels[0].length]), [[0, 512], [512, 512], [1024, 512], [1536, 512], [2048, 512], [2560, 512], [3072, 512], [3584, 512]]);
  assert.equal(payloads.find((item) => item.kind === "chunk").channels[1][0], 2.5);
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
  assert.deepEqual(transportCalls, ["continue_playing"], "Continue once, after the requested stopped position is confirmed");
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
    assert.deepEqual(transportCalls, reason === "stop" ? ["continue_playing"] : ["continue_playing", "stop_playing"], reason);
    flushTransport();
    assert.equal(song.is_playing, 0, "A queued start must not escape after the capture ends");
    assert.equal(song.current_song_time, reason === "seek" ? 64 : reason === "stop" ? 17 : reason === "loop" ? 16 : 12, reason);
    assert.equal(song.loop, 1);
  }
});

test("Max range capture continues from its seek instead of the unrelated insert marker", async () => {
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
  assert.equal(song.start_time, 80, "The musician's insert marker is preserved.");
  context.ode_audio_command({ kind: "cancel", id: "take" });
});
