import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import { test } from "node:test";

const deviceFile = new URL("../live/max/device.ts", import.meta.url);

test("Max device packages its embedded client, transient controls and untouched stereo path", async () => {
  assert.equal(await access(deviceFile).then(() => true, () => false), true, "The Max device builder is missing");
  const { MaxDevice } = await import("../live/max/device");
  const bytes = await MaxDevice.build();
  assert.equal(bytes.subarray(0, 12).toString("hex"), "616d70660400000061616161");
  assert.equal(bytes.subarray(12, 16).toString(), "meta");
  assert.equal(bytes.readUInt32LE(16), 4);
  assert.equal(bytes.readUInt32LE(20), 0, "The self-contained device is unfrozen");
  assert.equal(bytes.subarray(24, 28).toString(), "ptch");
  assert.equal(bytes.readUInt32LE(28), bytes.length - 32);
  assert.equal(bytes.at(-1), 0);
  const { patcher } = JSON.parse(bytes.subarray(32, -1).toString());
  const objects = patcher.boxes.map(({ box }: { box: Record<string, unknown> }) => box);
  const input = objects.find((box: Record<string, unknown>) => box.text === "plugin~ 1 2 3 4");
  const output = objects.find((box: Record<string, unknown>) => box.text === "plugout~");
  assert.ok(input && output);
  for (const channel of [0, 1]) assert.ok(patcher.lines.some(({ patchline }: { patchline: { source: unknown[]; destination: unknown[] } }) =>
    JSON.stringify(patchline.source) === JSON.stringify([input.id, channel]) && JSON.stringify(patchline.destination) === JSON.stringify([output.id, channel])));
  assert.equal(patcher.lines.filter(({ patchline }: { patchline: { destination: unknown[] } }) => patchline.destination[0] === output.id).length, 2,
    "Captured auxiliary inputs must never be mixed into the audible output");
  const controls = objects.filter((box: Record<string, unknown>) => box.maxclass === "live.numbox");
  assert.equal(controls.length, 11);
  for (const control of controls) {
    const parameter = control.saved_attribute_attributes.valueof;
    assert.equal(parameter.parameter_type, 0);
    assert.equal(parameter.parameter_invisible, 4);
    assert.equal(parameter.parameter_visible_undoable, 0);
    assert.equal(control.parameter_mappable, 0);
    assert.notEqual(control.presentation, 1);
  }
  const code = objects.find((box: Record<string, unknown>) => box.maxclass === "v8.codebox")?.code;
  assert.equal(typeof code, "string");
  assert.doesNotThrow(() => new Script(code));
});

test("the window subpatcher exposes a native inlet for its pcontrol connection", async () => {
  const { MaxDevice } = await import("../live/max/device");
  const { patcher } = JSON.parse((await MaxDevice.build()).subarray(32, -1).toString());
  const objects = patcher.boxes.map(({ box }: { box: Record<string, any> }) => box);
  const controller = objects.find((box: Record<string, any>) => box.text === "pcontrol");
  const connection = patcher.lines.find(({ patchline }: { patchline: { source: unknown[] } }) => patchline.source[0] === controller.id).patchline;
  const window = objects.find((box: Record<string, any>) => box.id === connection.destination[0]);
  const nativeInlets = window.patcher.boxes.filter(({ box }: { box: Record<string, unknown> }) => box.maxclass === "inlet" || box.text === "inlet");
  assert.ok(nativeInlets.length > connection.destination[1], "Max deletes pcontrol's patchcord when the child has no native inlet");
  assert.deepEqual(window.patcher.rect.slice(2), [1080, 740], "The workspace starts with room for chat and its docked sidebar");
  assert.deepEqual(window.patcher.boxes.find(({ box }: { box: Record<string, unknown> }) => box.varname === "odeBrowser").box.presentation_rect, [0, 0, 1080, 740]);
});

test("embedded Max client consumes bootstrap once and waits for page readiness before acknowledging open", async () => {
  const { MaxDevice } = await import("../live/max/device");
  const { patcher } = JSON.parse((await MaxDevice.build()).subarray(32, -1).toString());
  const boxes = patcher.boxes.map(({ box }: { box: Record<string, unknown> }) => box);
  const code = boxes.find((box: Record<string, unknown>) => box.maxclass === "v8.codebox").code;
  const values = new Map<string, number>([
    ["Ode Window Port", 43123], ["Ode Window Connect", 7], ["Ode Window Version", 1],
    ...[0, 1, 43981, 65535, 2, 3, 4, 5].map((value, index): [string, number] => [`Ode Window Key ${index + 1}`, value]),
  ]);
  const page: unknown[][] = [];
  const window: unknown[][] = [];
  const statuses: string[] = [];
  const requests: FakeRequest[] = [];
  class FakeRequest {
    readyState = 0;
    status = 0;
    responseText = "";
    onreadystatechange: (() => void) | null = null;
    url = "";
    body: unknown;
    aborted = false;
    open(method: string, url: string) { assert.equal(method, "POST"); this.url = url; }
    setRequestHeader() {}
    send(body: string) { this.body = JSON.parse(body); requests.push(this); }
    abort() { this.aborted = true; }
    reply(body: unknown, status = 200) { this.status = status; this.responseText = JSON.stringify(body); this.readyState = 4; this.onreadystatechange?.(); }
  }
  const tasks: Task[] = [];
  class Task {
    interval = 0;
    freed = false;
    constructor() { tasks.push(this); }
    schedule() {}
    repeat() {}
    cancel() {}
    freepeer() { this.freed = true; }
  }
  const browser = { rect: [0, 0, 1080, 740], message: (...args: unknown[]) => page.push(args) };
  const child = { wind: { visible: true, size: [1080, 740] }, getnamed: (name: string) => name === "odeBrowser" ? browser : { message: (...args: unknown[]) => window.push(args) } };
  const context = createContext({
    Task, XMLHttpRequest: FakeRequest,
    patcher: { getnamed: (name: string) => name === "odeWindow" ? { subpatcher: () => child } : { getvalueof: () => values.get(name), message: (...args: unknown[]) => { if (name === "odeStatus") statuses.push(String(args[1])); } } },
    outlet: (...args: unknown[]) => window.push(args),
  });
  new Script(code).runInContext(context);
  context.start();
  child.wind.size = [760, 680];
  context.tick();
  assert.deepEqual(Array.from(browser.rect), [0, 0, 760, 680], "The browser must follow resizing of its own floating window");
  assert.deepEqual(page.shift(), ["sendbox", "presentation_rect", 0, 0, 760, 680]);
  assert.deepEqual(requests[0]?.body, { capability: "00000001abcdffff0002000300040005" });
  assert.equal(requests[0]?.url, "http://127.0.0.1:43123/max-window/connect");
  const url = `http://localhost:43123/?view=ask&token=${"a".repeat(48)}`;
  requests[0]!.reply({ session: "b".repeat(48), url });
  assert.equal(tasks[1]?.freed, true, "A completed request must release its native timeout Task");
  values.set("Ode Window Port", 0);
  values.set("Ode Window Connect", 0);
  for (let index = 1; index <= 8; index++) values.set(`Ode Window Key ${index}`, 0);
  context.tick();
  assert.deepEqual(requests[1]?.body, { session: "b".repeat(48) });
  requests[1]!.reply({ command: { id: "first", view: "ask", url } });
  assert.ok(window.some((message) => message[0] === "front"), "Show the native window before waiting for its hidden jweb renderer to load");
  assert.equal(page[0]?.[0], "read");
  const firstPage = new URL(String(page[0]?.[1]));
  assert.equal(firstPage.searchParams.get("odeWindowCommand"), "first");
  assert.equal(firstPage.searchParams.has("odeChatWidth"), false, "The workspace must not depend on an automatic native width protocol");
  assert.equal(requests.length, 2, "Reading a page is not evidence it became ready");
  context.tick();
  requests[2]!.reply({ command: { id: "queued", view: "lyrics", url: url.replace("view=ask", "view=lyrics") } });
  assert.equal(page.length, 1, "A queued command must not replace the page currently opening");
  context.tick(); // This poll can return the old command while its acknowledgement is in flight.
  context.ode_opened("first");
  assert.deepEqual(requests[4]?.body, { session: "b".repeat(48), id: "first", status: "ready" });
  requests[3]!.reply({ command: { id: "first", view: "ask", url } });
  assert.equal(page.length, 1, "A delayed poll must not reopen a command that the page already handled");
  requests[4]!.reply({ ok: true });
  context.ode_opened("first");
  assert.equal(requests.length, 5, "Duplicate page readiness must not acknowledge the command twice");
  context.tick();
  requests[5]!.reply({ command: { id: "second", view: "lyrics", url: url.replace("view=ask", "view=lyrics") } });
  assert.equal(page[1]?.[0], "ode_open", "An existing page must save its drafts before navigating");
  assert.deepEqual(page[1]?.slice(1), ["lyrics", url.replace("view=ask", "view=lyrics"), "second"]);
  assert.equal(window.some((message) => message[0] === "window" && message[1] === "size"), false, "Opening a sidebar view must leave the native frame unchanged");
  const focused = window.filter((message) => message[0] === "front").length;
  context.ode_open_failed("second", "Save the open draft before switching views.");
  assert.equal(window.filter((message) => message[0] === "front").length, focused + 1, "A failed view change must reveal the existing page's save notice");
  assert.deepEqual(requests[6]?.body, { session: "b".repeat(48), id: "second", status: "error", error: "Save the open draft before switching views." });
  requests[6]!.reply({ error: "The command already expired" }, 409);
  context.tick();
  assert.deepEqual(requests[7]?.body, { session: "b".repeat(48) }, "An expired command must not revoke a valid connection");
  requests[7]!.reply({ error: "Disconnected" }, 403);
  // A restarted extension can reuse both the operating system's port and its first latch value.
  values.set("Ode Window Port", 43123);
  values.set("Ode Window Connect", 7);
  context.tick();
  assert.equal(requests[8]?.url, "http://127.0.0.1:43123/max-window/connect");
  const replacementUrl = url.replace("a".repeat(48), "d".repeat(48));
  requests[8]!.reply({ error: "Unsupported media type" }, 415);
  const failure = statuses.at(-1);
  assert.match(failure!, /failed|could not connect/i);
  context.tick();
  assert.equal(statuses.at(-1), failure, "A failed bootstrap must retain its actionable notice between polls");
  context.open_ode();
  assert.equal(requests[9]?.url, "http://127.0.0.1:43123/max-window/connect", "Open Ode retries the failed bootstrap");
  requests[9]!.reply({ session: "c".repeat(48), url: replacementUrl });
  context.tick();
  assert.deepEqual(requests[10]?.body, { session: "c".repeat(48) });
  context.stop();
  assert.equal(requests[10]!.aborted, true, "Removing the device must cancel its outstanding requests");
  assert.equal(tasks.every((task) => task.freed), true, "Removing the device must release its loop and request Tasks");
});
