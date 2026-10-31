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
