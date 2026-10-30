import assert from "node:assert/strict";
import test from "node:test";
import { Device, RackDevice, type DeviceParameter } from "@ableton-extensions/sdk";
import { Describer } from "../live/extension/describe";
import { DeviceOperations } from "../live/extension/ops/devices";
import { SnapshotOperations } from "../live/extension/ops/snapshot";
import type { Live, Version } from "../live/extension/sdk";
import { FakeLive } from "./fake-live";
import { MaxWindow, MaxWindowMissingError } from "../live/extension/max-window";
import { MaxWindowBridge } from "../server/max-window";
import { MAX_WINDOW } from "../shared/max-window";

function hostFixture() {
  const names = MAX_WINDOW.parameterNames;
  const values = new Map<string, number>();
  const written: string[] = [];
  const controls = [names.signature, names.port, ...names.words, names.latch].map((name) => {
    values.set(name, name === names.signature ? 1 : 0);
    return { name, min: 0, max: name === names.signature ? 1 : 65535, defaultValue: name === names.signature ? 1 : 0,
      isQuantized: false, valueItems: [], getValue: async () => values.get(name)!,
      setValue: async (value: number) => { values.set(name, value); written.push(name); },
    };
  });
  const device = Object.create(Device.prototype, Object.fromEntries(Object.entries({
    handle: { id: 23n }, name: "Renamed by musician", parameters: controls,
  }).map(([key, value]) => [key, { value, writable: true }])));
  const track = { handle: { id: 4n }, devices: [device] };
  const song = { handle: { id: 7n }, tracks: [track], returnTracks: [], mainTrack: { handle: { id: 5n }, devices: [] } };
  const application = { song };
  const live = { application } as unknown as Live;
  const bridge = new MaxWindowBridge((view) => `http://localhost:12345/?view=${view}&token=private`);
  const host = new MaxWindow(live, bridge, 12345);
  return { host, bridge, application, song, track, device, controls, values, written };
}

test("the current Set receives a complete bootstrap and secrets clear after connecting", async () => {
  const fixture = hostFixture();
  try {
    await fixture.host.scan();
    const names = MAX_WINDOW.parameterNames;
    assert.equal(fixture.values.get(names.port), 12345);
    assert.equal(fixture.written.at(-1), names.latch);
    const capability = names.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join("");
    assert.equal(capability.length, 32);
    assert.equal(fixture.bridge.connect(capability).url, "http://localhost:12345/?view=ask&token=private");
    await fixture.host.scan();
    for (const name of [names.port, ...names.words, names.latch]) assert.equal(fixture.values.get(name), 0);
    assert.equal(fixture.values.get(names.signature), 1);
  } finally { await fixture.host.stop(); }
});

test("consumed bootstrap clearing waits for the latch before touching its capability words", async () => {
  const fixture = hostFixture();
  let release!: () => void;
  let requested!: () => void;
  const latchRequested = new Promise<void>((resolve) => { requested = resolve; });
  const latch = fixture.controls.find((control) => control.name === MAX_WINDOW.parameterNames.latch)!;
  const original = latch.setValue;
  try {
    await fixture.host.scan();
    const capability = MAX_WINDOW.parameterNames.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join("");
    fixture.bridge.connect(capability);
    latch.setValue = () => {
      requested();
      return new Promise<void>((resolve) => { release = () => { void original(0).then(resolve); }; });
    };
    const clearing = fixture.host.scan();
    await latchRequested;
    assert.equal(fixture.values.get(MAX_WINDOW.parameterNames.port), 12345);
    assert.equal(MAX_WINDOW.parameterNames.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join(""), capability);
    release();
    await clearing;
    assert.equal(fixture.values.get(MAX_WINDOW.parameterNames.port), 0);
  } finally { latch.setValue = original; await fixture.host.stop(); }
});

test("a removed device immediately revokes its session before the next scan", async () => {
  const fixture = hostFixture();
  try {
    await fixture.host.scan();
    const capability = MAX_WINDOW.parameterNames.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join("");
    const connection = fixture.bridge.connect(capability);
    fixture.track.devices.length = 0;
    assert.throws(() => fixture.bridge.poll(connection.session));
    await assert.rejects(fixture.host.open("ask" as never), (error) => error instanceof MaxWindowMissingError && error.reason === "missing");
  } finally { await fixture.host.stop(); }
});

test("a different Set invalidates an old connection even when a device handle is reused", async () => {
  const fixture = hostFixture();
  try {
    await fixture.host.scan();
    const capability = MAX_WINDOW.parameterNames.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join("");
    const connection = fixture.bridge.connect(capability);
    fixture.application.song = { ...fixture.song, handle: { id: 8n } };
    assert.throws(() => fixture.bridge.poll(connection.session));
    await fixture.host.scan();
    const nextCapability = MAX_WINDOW.parameterNames.words.map((name) => fixture.values.get(name)!.toString(16).padStart(4, "0")).join("");
    assert.notEqual(nextCapability, capability);
    assert.ok(fixture.bridge.connect(nextCapability).session);
  } finally { await fixture.host.stop(); }
});

test("multiple matching devices remain unpaired and report a clear loading error", async () => {
  const fixture = hostFixture();
  try {
    fixture.track.devices.push(Object.create(Device.prototype, Object.fromEntries(Object.entries({
      handle: { id: 24n }, name: "Ode", parameters: fixture.controls,
    }).map(([key, value]) => [key, { value }]))));
    await assert.rejects(fixture.host.open("ask" as never), (error) => error instanceof MaxWindowMissingError && error.reason === "multiple");
    assert.equal(fixture.written.length, 0);
  } finally { await fixture.host.stop(); }
});

test("the discovery finds a renamed device inside a rack on the main track", async () => {
  const fixture = hostFixture();
  try {
    fixture.track.devices.length = 0;
    const rack = Object.create(RackDevice.prototype, Object.fromEntries(Object.entries({
      handle: { id: 40n }, name: "Rack", parameters: [], chains: [{ devices: [fixture.device] }],
    }).map(([key, value]) => [key, { value }])));
    fixture.song.mainTrack.devices.push(rack as never);
    await fixture.host.scan();
    assert.equal(fixture.values.get(MAX_WINDOW.parameterNames.port), 12345);
  } finally { await fixture.host.stop(); }
});

test("simultaneous scans share one native read and do not interleave bootstrap writes", async () => {
  const fixture = hostFixture();
  let release!: (version: number) => void;
  let reads = 0;
  fixture.controls[0]!.getValue = () => { reads++; return new Promise<number>((resolve) => { release = resolve; }); };
  try {
    const first = fixture.host.scan();
    const second = fixture.host.scan();
    assert.equal(first, second);
    await Promise.resolve();
    assert.equal(reads, 1);
    assert.equal(fixture.written.length, 0);
    release(1);
    await Promise.all([first, second]);
    assert.equal(fixture.written.filter((name) => name === MAX_WINDOW.parameterNames.port).length, 1);
  } finally { await fixture.host.stop(); }
});

test("synchronous native failures revoke and clear a partially delivered bootstrap", async () => {
  const fixture = hostFixture();
  const control = fixture.controls[3]!;
  const setValue = control.setValue;
  control.setValue = (value) => { if (value) throw new Error("Native failure"); return setValue(value); };
  try {
    await fixture.host.scan();
    for (const name of [MAX_WINDOW.parameterNames.port, ...MAX_WINDOW.parameterNames.words, MAX_WINDOW.parameterNames.latch]) assert.equal(fixture.values.get(name), 0);
    assert.equal(fixture.bridge.connected, false);
    await assert.rejects(fixture.host.open("ask" as never), (error) => error instanceof MaxWindowMissingError && error.reason === "unresponsive");
  } finally { await fixture.host.stop(); }
});

test("an unloaded device refusing native writes cannot break cleanup or the scan loop", async () => {
  const fixture = hostFixture();
  try {
    await fixture.host.scan();
    for (const control of fixture.controls) control.setValue = () => { throw new Error("Removed handle"); };
    fixture.track.devices.length = 0;
    await assert.doesNotReject(fixture.host.scan());
    assert.equal(fixture.bridge.connected, false);
  } finally { await fixture.host.stop(); }
});

function privateParameter() {
  let reads = 0;
  let writes = 0;
  const parameter = {
    name: "Ode Window Key 1", min: 0, max: 65535, defaultValue: 43210,
    isQuantized: false, valueItems: [],
    getValue: async () => { reads++; return 43210; },
    setValue: async () => { writes++; },
  } as unknown as DeviceParameter<Version>;
  return { parameter, get reads() { return reads; }, get writes() { return writes; } };
}

test("device descriptions and snapshots never read private Max connection values", async () => {
  const fake = privateParameter();
  const set = new FakeLive().liveSet();
  const describe = new Describer(set);
  assert.equal((await describe.parameter(fake.parameter, 2, true)).value, undefined);
  assert.equal(describe.parameterDetails(fake.parameter, 2).defaultValue, 0);
  const operations = new SnapshotOperations({ live: {} as Live, set, describe, refs: {} as never });
  const snapshot = await (operations as unknown as {
    parameter(parameter: DeviceParameter<Version>, index: number, device: string): Promise<{ value?: number }>;
  }).parameter(fake.parameter, 2, "Ode");
  assert.equal(snapshot.value, undefined);
  assert.equal(fake.reads, 0);
});

test("model-facing parameter operations cannot read or overwrite the Max connection", () => {
  const fake = privateParameter();
  const operations = new DeviceOperations({
    live: {} as Live, set: new FakeLive().liveSet(), describe: {} as never,
    refs: { parameter: () => ({ parameter: fake.parameter, index: 2 }) } as never,
  }).table();
  const parameter = { device: { track: { index: 0 }, index: 0 }, parameter: 2 };
  assert.throws(() => operations.parameter_get.prepare({ parameter }, {} as never), /connection/i);
  assert.throws(() => operations.parameter_set.prepare({ parameter, value: 1 }, {} as never), /connection/i);
  assert.equal(fake.reads, 0);
  assert.equal(fake.writes, 0);
});
