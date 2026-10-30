import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { DialogResult, LiveDialog } from "../ui/app/dialog";
import { Layout } from "../ui/app/layout";
import { MaxWindowClient } from "../ui/app/max-window";
import { OdeClient } from "../ui/app/client";

function page(t: TestContext, address = "http://localhost:9123/?view=ask&token=private") {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const messages: unknown[][] = [], navigations: string[] = [], errors: string[] = [];
  const location = { href: address, assign: (url: string) => navigations.push(url) };
  const max = {
    bindInlet: (name: string, callback: (...args: unknown[]) => void) => handlers.set(name, callback),
    outlet: (...args: unknown[]) => messages.push(args),
  };
  const host = { location, max, history: { replaceState: (_state: unknown, _title: string, url: string) => { location.href = url; } } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });
  return { host, handlers, messages, navigations, errors };
}

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

test("the real jweb bindInlet API recognises Max and acknowledges a mounted page once", (t) => {
  const fake = page(t, "http://localhost:9123/?view=ask&token=private&odeWindowCommand=first");
  const client = new MaxWindowClient(Layout.Ask, async () => true, (message) => fake.errors.push(message));
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

test("opening Lyrics in the chat saves first and acknowledges the pane after it mounts", async (t) => {
  const fake = page(t);
  let saved!: (value: boolean) => void, saves = 0;
  const views: Layout[] = [];
  const client = new MaxWindowClient(Layout.Ask, () => { saves++; return new Promise((resolve) => { saved = resolve; }); }, (message) => fake.errors.push(message), (view) => { views.push(view); });
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
  open("ask", fake.host.location.href, "chat");
  await settled();
  saved(true);
  await settled();
  assert.deepEqual(views, [Layout.Lyrics, Layout.Ask]);
  client.ready();
  assert.deepEqual(fake.messages.at(-1), ["ode_opened", "chat"]);
  assert.deepEqual(fake.navigations, []);
});

test("untrusted navigation and failed draft saves leave the current Max page open", async (t) => {
  const fake = page(t);
  let saves = 0;
  const client = new MaxWindowClient(Layout.Ask, async () => { saves++; return false; }, (message) => fake.errors.push(message));
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

test("a form awaiting explicit Save or Cancel blocks SDK navigation and closing", async (t) => {
  const fake = page(t, "http://localhost:9123/?view=settings&token=private");
  const client = new OdeClient(Layout.Settings);
  client.start();
  let checks = 0;
  const release = client.beforeLeave(() => { checks++; return false; });
  fake.handlers.get("ode_open")!("ask", fake.host.location.href.replace("view=settings", "view=ask"), "unsaved-settings");
  await settled();
  await client.navigate(Layout.Ask);
  await client.close();
  assert.equal(checks, 3);
  assert.deepEqual(fake.navigations, []);
  assert.equal(fake.messages.at(-1)?.[0], "ode_open_failed");
  assert.equal(fake.messages.some((message) => message[0] === "ode_close"), false);
  release();
  await client.navigate(Layout.Ask);
  assert.equal(new URL(fake.navigations[0]!).searchParams.get("view"), "ask");
});
