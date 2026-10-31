import assert from "node:assert/strict";
import { test } from "node:test";
import { Chain, Device, DeviceParameter, RackDevice } from "@ableton-extensions/sdk";
import { DeviceOperations } from "../live/extension/ops/devices";
import { MaxTargetOperations } from "../live/extension/ops/max-target";
import { ReferenceResolver } from "../live/extension/refs";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import type { MaxParameterAddress, MaxParameterReading } from "../shared/max-parameters";
import { FakeLive } from "./fake-live";

let nextId = 100n;
const native = (prototype: object, fields: object) => Object.create(prototype,
  Object.fromEntries(Object.entries({ ...fields, handle: { id: nextId++ } }).map(([key, value]) => [key, { value, writable: true }])));

test("SDK parameter reads supply checked Max addresses for nested devices and Main/return mixers", async () => {
  const fake = new FakeLive();
  const track = fake.midiTrack("Guitars");
  const parameter = native(DeviceParameter.prototype, { name: "Frequency", min: 0, max: 1, getValue: async () => 0.5 });
  const instrument = native(Device.prototype, { name: "Tension", parameters: [parameter] });
  const chain = native(Chain.prototype, { devices: [instrument] });
  Object.defineProperty(track, "devices", { value: [native(RackDevice.prototype, { name: "Guitar Rack", chains: [chain] })] });
  const set = fake.liveSet();
  const main = set.song.mainTrack;
  Object.assign(main, { mixer: { volume: parameter, panning: parameter, sends: [parameter] } });
  set.song.returnTracks.push(native(Device.prototype, { name: "Room", mixer: main.mixer }));
  const operations = new DeviceOperations({ set, refs: new ReferenceResolver(set), live: {} as never,
    describe: { parameter: async () => ({ name: parameter.name, value: 0.5 }) } as never }).table();
  const read = async (parameter: object) => operations.parameter_get.prepare({ parameter } as never, {} as never)() as Promise<{ maxAddress?: MaxParameterAddress }>;
  const nested = (await read({ device: { track: { index: 0 }, index: 0, chain: [0, 0] }, parameter: 0 })).maxAddress;
  assert.equal(nested?.path, "live_set tracks 0 devices 0 chains 0 devices 0 parameters 0");
  assert.deepEqual(nested?.guards.map(({ name }) => name), ["Guitars", "Guitar Rack", undefined, "Tension", "Frequency"]);
  assert.equal((await read({ device: { track: { main: true }, index: -1 }, parameter: 0 })).maxAddress?.path, "live_set master_track mixer_device volume");
  assert.equal((await read({ device: { track: { returnIndex: 0 }, index: -1 }, parameter: 2 })).maxAddress?.path, "live_set return_tracks 0 mixer_device sends 0");
});

test("native display tools forward exact addresses and values to Max without unit conversion", async () => {
  const calls: unknown[] = [];
  const address: MaxParameterAddress = { path: "live_set tracks 0 devices 0 parameters 0", guards: [] };
  const reading: MaxParameterReading = { token: "native-read", path: address.path, name: "Frequency", rawValue: 0.5,
    displayValue: 1000, formattedValue: "1.00 kHz", isEnabled: true, state: 0, automationState: 0 };
  const registry = new ToolRegistry({ exchangeId: "request", song: { read: async () => ({ locked: [] }) },
    live: { extension: { call: async (op: string) => { calls.push(op); return { maxAddress: address }; } } },
    maxParameters: { read: async (...args: unknown[]) => { calls.push(args); return reading; },
      set: async (...args: unknown[]) => { calls.push(args); return { before: reading, after: { ...reading, displayValue: 1200 } }; } },
  } as unknown as ToolContext);
  const parameter = { device: { track: { index: 0 }, index: 0 }, parameter: 0 };
  const read = await registry.run("parameter_read_display", { parameter }, undefined, { exchangeId: "request" });
  assert.equal(read.ok, true, read.text);
  assert.equal(JSON.parse(read.text).formattedValue, "1.00 kHz");
  const written = await registry.run("parameter_set_display", { parameter, readToken: "native-read", value: 1200 }, undefined, { exchangeId: "request" });
  assert.equal(written.ok, true, written.text);
  assert.equal(JSON.parse(written.text).after.displayValue, 1200);
  assert.deepEqual(calls, ["parameter_get", [address, "request", undefined], "parameter_get", [address, "request", "native-read", 1200, false, undefined]]);
});

test("native clip addresses are resolved from the current SDK list, not SDK handle IDs", async () => {
  const fake = new FakeLive();
  const clip = fake.midiClip("Hook", 16), track = fake.midiTrack("Lead", [clip]);
  const set = fake.liveSet();
  const operation = new MaxTargetOperations({ set, refs: new ReferenceResolver(set), live: {} as never, describe: {} as never }).table().max_target;
  const address = await operation.prepare({ clip: { track: { index: 0 }, start: 16 } }, {} as never)();
  assert.equal(address.path, "live_set tracks 0 arrangement_clips 0");
  assert.equal(address.clip?.startTime, 16);
  assert.equal(address.guards[0]?.name, track.name);
  assert.equal(address.guards.at(-1)?.name, clip.name);
});
