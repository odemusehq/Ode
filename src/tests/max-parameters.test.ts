import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { Hono } from "hono";
import { OdeServer, type ServerDeps } from "../server/http";
import { MaxParameterControl } from "../server/max-parameters";
import { MaxWindowBridge } from "../server/max-window";
import { MAX_PARAMETERS } from "../shared/max-parameters";
import { nativeStrings } from "../shared/i18n";

const path = "live_set tracks 0 devices 0 parameters 1";
const address = { path, guards: [{ path: "live_set tracks 0", name: "Guitar" }, { path: "live_set tracks 0 devices 0", name: "Amp" }, { path, name: "Gain" }] };

test("Max parameter jobs negotiate separately, queue reads and remove cancellation", async () => {
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask&token=private");
  const control = new MaxParameterControl(bridge);
  bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, 1);
  await assert.rejects(control.read(address, "request"), /updated/i);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, 1, 1);
  const abort = new AbortController();
  const cancelled = assert.rejects(control.read(address, "request", abort.signal), /cancel/i);
  const second = control.read(address, "request");
  abort.abort();
  await cancelled;
  const command = bridge.poll(session).parameters!;
  assert.equal(command.kind, "read");
  const result = { token: command.id, path, name: "Gain", rawValue: 0.5, displayValue: 6, formattedValue: "6.0 dB", isEnabled: true, state: 0, automationState: 0 };
  control.receive(session, { kind: "read", id: command.id, result });
  assert.deepEqual(await second, result);
  control.receive(session, { kind: "read", id: command.id, result });
  assert.equal(bridge.poll(session).parameters, null);
  const pending = assert.rejects(control.read(address, "request"), /disconnect/i);
  bridge.invalidate();
  await pending;
});

test("the paired parameter transport refuses foreign, malformed and mismatched replies", async () => {
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask&token=private");
  const control = new MaxParameterControl(bridge);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, 1);
  const failed = assert.rejects(control.read(address, "request"), /invalid/i);
  const command = bridge.poll(session).parameters!;
  const result = { token: command.id, path: "live_set tracks 1 devices 0 parameters 1", name: "Gain", rawValue: 0.5, displayValue: 6, formattedValue: "6 dB", isEnabled: true, state: 0, automationState: 0 };
  assert.throws(() => control.receive("0".repeat(48), { kind: "read", id: command.id, result }), /connect/i);
  assert.throws(() => control.receive(session, { kind: "read", id: command.id, result }), /invalid/i);
  await failed;
  assert.equal(bridge.poll(session).parameters, null);
  const malformed = assert.rejects(control.read(address, "request"), /invalid/i);
  const next = bridge.poll(session).parameters!;
  assert.throws(() => control.receive(session, { kind: "read", id: next.id, result: { ...result, rawValue: null } }), /invalid/i);
  await malformed;
});

test("parameter HTTP retains loopback guards, private-session authentication and body limits", async () => {
  const bridge = new MaxWindowBridge(() => "http://localhost:9123/?view=ask&token=private");
  const maxParameters = new MaxParameterControl(bridge);
  const { session } = bridge.connect(bridge.prepare({ deviceId: "d", setId: "s" }).capability, undefined, 1);
  const server = new OdeServer({ maxParameters } as ServerDeps);
  const local = server as unknown as { app: Hono; token: string; guard: any; authorize: any; routeMaxParameters(): void };
  local.app.use("*", (c, next) => local.guard(c, next));
  local.app.use("*", (c, next) => local.authorize(c, next));
  local.routeMaxParameters();
  const send = (body: unknown, headers: Record<string, string> = {}) => local.app.request(`http://localhost:0${MAX_PARAMETERS.messagePath}`, {
    method: "POST", body: JSON.stringify(body), headers: { host: "localhost:0", "content-type": "application/json", ...headers },
  });
  assert.equal((await send({ session, message: {} }, { origin: "https://example.com" })).status, 403);
  assert.equal((await send({ session: local.token, message: {} })).status, 403);
  assert.equal((await send({ session, message: "x".repeat(MAX_PARAMETERS.maxBodyBytes) })).status, 413);
  assert.equal((await send({ session, message: {} })).status, 409);
});

test("the Max adapter uses native display values, validates identities and never replays a write", async () => {
  let raw = 0.5, display = 6, writes = 0, enabled = 1, state = 0, automation = 0, identity = "3", supported = true;
  const sent: any[] = [];
  const objects: Record<string, { id: string; name: string }> = {
    [address.guards[0]!.path]: { id: "1", name: "Guitar" },
    [address.guards[1]!.path]: { id: "2", name: "Amp" },
    [path]: { get id() { return identity; }, name: "Gain" },
  };
  class LiveAPI {
    type = "DeviceParameter";
    constructor(_callback: unknown, readonly path: string) {}
    get id() { return objects[this.path]?.id ?? "0"; }
    get(key: string) {
      if (key === "name") return [objects[this.path]?.name];
      if (key === "display_value" && !supported) throw new Error("unsupported");
      return [{ value: raw, display_value: display, is_enabled: enabled, state, automation_state: automation }[key]];
    }
    call(name: string) { assert.ok(name === "__str__" || name === "str_for_value"); return [`${display.toFixed(1)} dB`]; }
    set(key: string, value: number) { assert.equal(key, "display_value"); writes++; display = value; raw = value / 12; }
  }
  const vm: any = { LiveAPI, running: true, session: "private", ODE_PARAMETERS: MAX_PARAMETERS,
    ODE_PARAMETER_COPY: nativeStrings.maxParameters, ODE_WINDOW: { parameterNames: { signature: "Ode Window Version", port: "Ode Window Port", words: [], latch: "Ode Window Connect" } },
    http: (_path: string, body: any) => sent.push(body.message) };
  runInNewContext(await readFile(new URL("../live/max/parameters.js", import.meta.url), "utf8"), vm);
  const read = (id: string) => { vm.ode_parameters_command({ kind: "read", id, scope: "request", address }); return sent.at(-1); };
  assert.equal(read("read-1").result.formattedValue, "6.0 dB");
  const set = { kind: "set", id: "set-1", scope: "request", address, token: "read-1", value: 9, allowAutomationOverride: false };
  vm.ode_parameters_command(set);
  assert.equal(sent.at(-1).result.after.displayValue, 9);
  vm.ode_parameters_command(set);
  assert.equal(writes, 1);
  read("stale"); raw = 0.1;
  vm.ode_parameters_command({ ...set, id: "set-stale", token: "stale" });
  assert.equal(sent.at(-1).kind, "error");
  read("identity"); identity = "4";
  vm.ode_parameters_command({ ...set, id: "set-replaced", token: "identity" });
  assert.equal(sent.at(-1).kind, "error");
  read("disabled"); enabled = 0;
  vm.ode_parameters_command({ ...set, id: "set-disabled", token: "disabled" });
  assert.equal(sent.at(-1).kind, "error");
  enabled = 1; supported = false;
  assert.equal(read("unsupported").result.displayValue, null);
  vm.ode_parameters_command({ ...set, id: "set-unsupported", token: "unsupported" });
  assert.equal(sent.at(-1).kind, "error");
  assert.equal(writes, 1);
  supported = true; automation = 1;
  read("automated");
  vm.ode_parameters_command({ ...set, id: "set-automated", token: "automated" });
  assert.equal(sent.at(-1).kind, "error");
  read("override");
  vm.ode_parameters_command({ ...set, id: "set-override", token: "override", allowAutomationOverride: true });
  assert.equal(sent.at(-1).kind, "set");
  assert.equal(writes, 2);
  state = 2; read("state");
  vm.ode_parameters_command({ ...set, id: "set-inactive", token: "state" });
  assert.equal(sent.at(-1).kind, "error");
  objects[path]!.name = "Ode Window Port";
  vm.ode_parameters_command({ kind: "read", id: "private", scope: "request", address: { path, guards: [{ path, name: "Ode Window Port" }] } });
  assert.equal(sent.at(-1).kind, "error");
  assert.match(sent.at(-1).error, /private/i);
});
