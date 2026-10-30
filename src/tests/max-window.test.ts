import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { OdeServer, type ServerDeps } from "../server/http";
import { MaxWindowBridge } from "../server/max-window";
import { DialogView } from "../shared/config";
import { MAX_WINDOW } from "../shared/max-window";

const binding = { deviceId: "device-1", setId: "set-1" };
const url = (view: DialogView) => `http://localhost:9123/?view=${view}&token=private-ui-token`;

test("Max bootstrap is consumed once and cannot authenticate the private polling session", () => {
  const bridge = new MaxWindowBridge(url);
  const bootstrap = bridge.prepare(binding);
  assert.equal(bootstrap.words.length, 8);
  assert.equal(bootstrap.words.map((word) => word.toString(16).padStart(4, "0")).join(""), bootstrap.capability);
  assert.equal(bootstrap.capability.length, 32);
  const connected = bridge.connect(bootstrap.capability);
  assert.notEqual(connected.session, bootstrap.capability);
  assert.equal(connected.url, url(DialogView.Ask));
  assert.throws(() => bridge.connect(bootstrap.capability), /connect/i);
  assert.throws(() => bridge.poll(bootstrap.capability), /connect/i);
  assert.equal(bridge.connected, true);
});

test("an SDK open waits for explicit page readiness and rejects a failed page", async () => {
  const bridge = new MaxWindowBridge(url);
  const { session } = bridge.connect(bridge.prepare(binding).capability);
  let opened = false;
  const opening = bridge.open(DialogView.Lyrics).then(() => { opened = true; });
  const command = bridge.poll(session).command!;
  assert.equal(command.view, "lyrics");
  assert.equal(command.url, url(DialogView.Lyrics));
  await Promise.resolve();
  assert.equal(opened, false);
  assert.throws(() => bridge.acknowledge({ session: "0".repeat(48), id: command.id, status: "ready" }), /connect/i);
  assert.equal(opened, false);
  bridge.acknowledge({ session, id: command.id, status: "ready" });
  await opening;
  assert.equal(opened, true);
  assert.equal(bridge.poll(session).command, null);
  assert.throws(() => bridge.acknowledge({ session, id: command.id, status: "ready" }), /command/i);
  const failed = bridge.open(DialogView.Settings);
  const failure = assert.rejects(failed, /window could not open/i);
  bridge.acknowledge({ session, id: bridge.poll(session).command!.id, status: "error", error: "untrusted device detail" });
  await failure;
});

test("native Set or device replacement revokes credentials and outstanding opens", async () => {
  let current = true;
  const bridge = new MaxWindowBridge(url);
  const { session } = bridge.connect(bridge.prepare(binding, () => current).capability);
  const pending = assert.rejects(bridge.open(DialogView.Ask), /connect/i);
  current = false;
  assert.throws(() => bridge.poll(session), /connect/i);
  await pending;
  assert.equal(bridge.connected, false);
  assert.throws(() => bridge.poll(session), /connect/i);
  const replacement = bridge.prepare({ deviceId: "device-2", setId: "set-2" });
  const next = bridge.connect(replacement.capability);
  assert.throws(() => bridge.poll(session), /connect/i);
  assert.equal(bridge.poll(next.session).command, null);
});

test("stale polling leases and bootstrap capabilities expire", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const bridge = new MaxWindowBridge(url);
  const expired = bridge.prepare(binding);
  t.mock.timers.tick(MAX_WINDOW.bootstrapMs + 1);
  assert.throws(() => bridge.connect(expired.capability), /connect/i);
  const { session } = bridge.connect(bridge.prepare(binding).capability);
  t.mock.timers.tick(MAX_WINDOW.leaseMs + 1);
  assert.equal(bridge.connected, false);
  assert.throws(() => bridge.poll(session), /connect/i);
  await assert.rejects(bridge.open(DialogView.Ask), /connect/i);
});

test("window commands are bounded and time out even while the device keeps polling", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const bridge = new MaxWindowBridge(url);
  const { session } = bridge.connect(bridge.prepare(binding).capability);
  const waiting = Array.from({ length: MAX_WINDOW.maxPending }, () => assert.rejects(bridge.open(DialogView.Ask), /respond/i));
  await assert.rejects(bridge.open(DialogView.History), /already waiting/i);
  for (let elapsed = 0; elapsed <= MAX_WINDOW.openTimeoutMs; elapsed += MAX_WINDOW.pollMs) {
    bridge.poll(session);
    t.mock.timers.tick(MAX_WINDOW.pollMs);
  }
  await Promise.all(waiting);
  assert.equal(bridge.poll(session).command, null);
});

test("bridge HTTP credentials stay isolated from UI auth and retain loopback request guards", async () => {
  const bridge = new MaxWindowBridge(url);
  const bootstrap = bridge.prepare(binding);
  const switching = { isSwitching: true };
  const server = new OdeServer({ maxWindow: bridge, songs: switching } as unknown as ServerDeps);
  const local = server as unknown as { app: Hono; token: string; modifyingRequests: number; guard: any; authorize: any; routeMaxWindow(): void };
  local.app.use("*", (c, next) => local.guard(c, next));
  local.app.use("*", (c, next) => local.authorize(c, next));
  local.routeMaxWindow();
  local.app.get("/ordinary", (c) => c.json({ ok: true }));
  const send = (path: string, body: unknown, headers: Record<string, string> = {}) => local.app.request(`http://localhost:0${path}`, {
    method: "POST", body: JSON.stringify(body), headers: { host: "localhost:0", "content-type": "application/json", ...headers },
  });
  assert.equal((await send(MAX_WINDOW.api.connect, { capability: local.token })).status, 403);
  assert.equal((await send(MAX_WINDOW.api.connect, { capability: bootstrap.capability }, { origin: "https://example.org" })).status, 403);
  assert.equal((await send(MAX_WINDOW.api.connect, { capability: bootstrap.capability }, { host: "example.org:0" })).status, 403);
  const connection = await send(MAX_WINDOW.api.connect, { capability: bootstrap.capability });
  assert.equal(connection.status, 200);
  const { session } = await connection.json() as { session: string };
  assert.equal(local.modifyingRequests, 0);
  assert.equal((await send(MAX_WINDOW.api.poll, { session })).status, 200);
  assert.equal((await send(MAX_WINDOW.api.poll, { session }, { "content-type": "text/plain" })).status, 415);
  assert.equal((await send(MAX_WINDOW.api.poll, { session, extra: "x".repeat(5_000) })).status, 413);
  assert.equal((await local.app.request(`http://localhost:0/ordinary?token=${session}`, { headers: { host: "localhost:0" } })).status, 403);
  assert.equal((await local.app.request(`http://localhost:0/ordinary?token=${local.token}`, { headers: { host: "localhost:0" } })).status, 200);
  assert.equal((await local.app.request(`http://localhost:0${MAX_WINDOW.api.poll}`, { headers: { host: "localhost:0" } })).status, 405);
  switching.isSwitching = false;
  assert.equal((await send(`${MAX_WINDOW.api.poll}/extra`, { session })).status, 403);
  bridge.invalidate();
});
