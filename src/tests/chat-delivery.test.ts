import assert from "node:assert/strict";
import { test } from "node:test";
import { OdeClient } from "../ui/app/client";
import { Layout } from "../ui/app/layout";

test("a lost acknowledgement retries the same request id and success releases it", async () => {
  const client = new OdeClient(Layout.Ask);
  client.store.apply({ type: "title", title: "Fixture", songId: "fixture" });
  client.lyrics.flush = async () => true;
  const ids: string[] = [];
  client.api.chat = async ({ requestId }) => {
    ids.push(requestId!);
    if (ids.length === 1) throw new Error("lost acknowledgement");
    return { ok: true };
  };
  assert.equal(await client.send("keep the vocal"), false);
  assert.equal(await client.send("keep the vocal"), true);
  assert.equal(await client.send("keep the vocal"), true);
  assert.equal(ids[0], ids[1]);
  assert.notEqual(ids[1], ids[2]);
});

test("Stop while lyrics save does not submit the waiting chat afterwards", async () => {
  const client = new OdeClient(Layout.Ask);
  client.store.apply({ type: "title", title: "Fixture", songId: "fixture" });
  let release!: (value: boolean) => void;
  client.lyrics.flush = () => new Promise((resolve) => { release = resolve; });
  let dispatched = 0;
  client.api.chat = async () => { dispatched++; return { ok: true }; };
  let cancelled: string[] = [];
  client.api.stop = async (ids) => { cancelled = ids!; return { ok: true }; };
  client.refreshStatus = async () => undefined;
  const sent = client.send("write a bass line");
  await client.stopRequest();
  release(true);
  assert.equal(await sent, false);
  assert.equal(dispatched, 0);
  assert.equal(cancelled.length, 1);
});

test("a deliberate send after Stop gets a new identity", async () => {
  const client = new OdeClient(Layout.Ask);
  client.store.apply({ type: "title", title: "Fixture", songId: "fixture" });
  client.lyrics.flush = async () => true;
  const ids: string[] = [];
  client.api.chat = async ({ requestId }) => { ids.push(requestId!); throw new Error("lost acknowledgement"); };
  client.api.stop = async () => ({ ok: true });
  client.refreshStatus = async () => undefined;
  await client.send("finish the drums");
  await client.stopRequest();
  await client.send("finish the drums");
  assert.notEqual(ids[0], ids[1]);
});
