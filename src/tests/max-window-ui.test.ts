import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { DialogResult, LiveDialog } from "../ui/app/dialog";
import { Layout } from "../ui/app/layout";
import { MaxWindowClient } from "../ui/app/max-window";
import { OdeClient } from "../ui/app/client";

function page(t: TestContext, address = "http://localhost:9123/?view=ask&token=private") {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalEvents = Object.getOwnPropertyDescriptor(globalThis, "EventSource");
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const listeners = new Map<string, () => void>(), streams: string[] = [];
  const messages: unknown[][] = [], navigations: string[] = [], errors: string[] = [];
  const location = { href: address, assign: (url: string) => navigations.push(url) };
  const max = {
    bindInlet: (name: string, callback: (...args: unknown[]) => void) => handlers.set(name, callback),
    outlet: (...args: unknown[]) => messages.push(args),
  };
  const host = { location, max, addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    history: { replaceState: (_state: unknown, _title: string, url: string) => { location.href = url; } } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  Object.defineProperty(globalThis, "EventSource", { configurable: true, value: class { constructor(url: string) { streams.push(url); } } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalEvents) Object.defineProperty(globalThis, "EventSource", originalEvents);
    else Reflect.deleteProperty(globalThis, "EventSource");
  });
  return { host, handlers, messages, navigations, errors, listeners, streams };
}

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

test("the real jweb bindInlet API recognises Max and acknowledges a mounted page once", (t) => {
  const fake = page(t, "http://localhost:9123/?view=ask&token=private&odeWindowCommand=first");
  const client = new MaxWindowClient(async () => true, (message) => fake.errors.push(message), () => {});
  client.start();
  assert.equal(LiveDialog.hosted, true);
  assert.equal(LiveDialog.modal, false);
  assert.ok(fake.handlers.has("ode_open"));
  assert.deepEqual(fake.messages, []);
  client.ready();
  client.ready();
  assert.deepEqual(fake.messages, [["ode_opened", "first"]]);
  assert.equal(new URL(fake.host.location.href).searchParams.has("odeWindowCommand"), false);
  LiveDialog.close(DialogResult.Done);
  assert.deepEqual(fake.messages.at(-1), ["ode_close"]);
});

test("native view commands save first and acknowledge every in-page pane after it mounts", async (t) => {
  const fake = page(t);
  let saved!: (value: boolean) => void, saves = 0;
  const views: Layout[] = [];
  const client = new MaxWindowClient(() => { saves++; return new Promise((resolve) => { saved = resolve; }); }, (message) => fake.errors.push(message), (view) => { views.push(view); });
  client.start();
  const open = fake.handlers.get("ode_open")!;
  open("lyrics", fake.host.location.href.replace("view=ask", "view=lyrics"), "lyrics");
  await settled();
  assert.equal(saves, 1);
  assert.deepEqual(views, []);
  assert.deepEqual(fake.navigations, []);
  saved(true);
  await settled();
  assert.deepEqual(views, [Layout.Lyrics]);
  assert.deepEqual(fake.navigations, []);
  assert.deepEqual(fake.messages, [], "The existing page must commit the pane before acknowledging it");
  client.ready();
  client.ready();
  assert.deepEqual(fake.messages, [["ode_opened", "lyrics"]]);
  for (const view of [Layout.History, Layout.Settings, Layout.Ask]) {
    const address = new URL(fake.host.location.href);
    address.searchParams.set("view", view);
    open(view, address.href, view);
    await settled();
    saved(true);
    await settled();
    assert.equal(views.at(-1), view);
    client.ready();
    assert.deepEqual(fake.messages.at(-1), ["ode_opened", view]);
  }
  assert.deepEqual(views, [Layout.Lyrics, Layout.History, Layout.Settings, Layout.Ask]);
  assert.deepEqual(fake.navigations, []);
});

test("untrusted navigation and failed draft saves leave the current Max page open", async (t) => {
  const fake = page(t);
  let saves = 0;
  const client = new MaxWindowClient(async () => { saves++; return false; }, (message) => fake.errors.push(message), () => {});
  client.start();
  const open = fake.handlers.get("ode_open")!;
  open("lyrics", "https://example.org/?view=lyrics", "bad-address");
  await settled();
  assert.equal(saves, 0);
  assert.equal(fake.messages.at(-1)?.[0], "ode_open_failed");
  open("lyrics", fake.host.location.href.replace("view=ask", "view=lyrics"), "unsaved");
  await settled();
  assert.equal(saves, 1);
  assert.deepEqual(fake.navigations, []);
  assert.match(String(fake.messages.at(-1)?.[2]), /draft could not be saved/i);
  assert.equal(fake.messages.some((message) => message[0] === "ode_opened"), false);
});

test("sidebar tabs retain the workspace and dirty Settings guard only whole-window closing", async (t) => {
  const fake = page(t, "http://localhost:9123/?view=settings&token=private");
  const client = new OdeClient(Layout.Settings);
  assert.equal(client.store.getSnapshot().sidebarOpen, true);
  assert.equal(client.store.getSnapshot().sidebarView, Layout.Settings);
  const compact = new OdeClient(Layout.Ask);
  assert.equal(compact.store.getSnapshot().sidebarOpen, false);
  assert.equal(compact.store.getSnapshot().sidebarView, Layout.Lyrics);
  let historyChecks = 0, historyReads = 0;
  client.api.checkVersions = async () => { historyChecks++; return null; };
  client.api.getVersions = async () => { historyReads++; return []; };
  client.start();
  assert.equal(fake.streams.length, 1, "Settings starts the same conversation stream as every other pane");
  assert.ok(fake.listeners.has("pagehide"));
  let checks = 0;
  const release = client.beforeLeave(() => { checks++; return false; });
  fake.handlers.get("ode_open")!("history", fake.host.location.href.replace("view=settings", "view=history"), "history");
  await settled();
  assert.equal(client.store.getSnapshot().sidebarView, Layout.History);
  assert.equal(historyChecks, 1);
  assert.equal(historyReads, 1);
  assert.deepEqual(fake.messages, []);
  client.windowReady();
  assert.deepEqual(fake.messages.at(-1), ["ode_opened", "history"]);
  fake.handlers.get("ode_open")!("history", fake.host.location.href, "already-history");
  await settled();
  assert.deepEqual(fake.messages.at(-1), ["ode_opened", "already-history"], "A matching pane needs no new render");
  assert.equal(historyChecks, 1);
  await client.navigate(Layout.Settings);
  await client.navigate(Layout.Ask);
  assert.equal(client.store.getSnapshot().sidebarOpen, false);
  assert.equal(client.store.getSnapshot().sidebarView, Layout.Settings);
  await client.toggleSidebar();
  assert.equal(client.store.getSnapshot().sidebarOpen, true);
  assert.equal(client.store.getSnapshot().sidebarView, Layout.Settings);
  await client.toggleSidebar();
  assert.equal(client.store.getSnapshot().sidebarOpen, false);
  assert.equal(fake.streams.length, 1);
  assert.equal(checks, 0, "Hiding a mounted form never discards its inputs");
  await client.close();
  assert.equal(checks, 1);
  assert.deepEqual(fake.navigations, []);
  assert.equal(fake.messages.some((message) => message[0] === "ode_close"), false);
  release();
  await client.close();
  assert.deepEqual(fake.messages.at(-1), ["ode_close"]);
  assert.equal(new URL(fake.host.location.href).searchParams.get("view"), "ask");
  assert.equal(new URL(fake.host.location.href).searchParams.get("token"), "private");
});
