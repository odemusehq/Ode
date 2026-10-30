import assert from "node:assert/strict";
import { test } from "node:test";
import { OdeClient } from "../ui/app/client";
import { Layout } from "../ui/app/layout";
import type { ComposerState } from "../shared/composer";

test("Stop before a delayed prepare or chat acknowledgement preserves the visible draft", async () => {
  for (const stage of ["prepare", "chat"] as const) {
    const client = new OdeClient(Layout.Ask);
    const songId = crypto.randomUUID(), requestId = crypto.randomUUID();
    const initial: ComposerState = { songId, revision: 1, draft: { text: "keep the hook", textEditId: crypto.randomUUID(), attachments: [] }, pending: null, conflicts: [] };
    const accepted: ComposerState = { ...initial, revision: 3, draft: { text: "", textEditId: crypto.randomUUID(), attachments: [] }, acceptedRequestId: requestId };
    client.store.apply({ type: "title", title: "Fixture", songId });
    client.lyrics.flush = async () => true;
    client.api.getComposer = async () => structuredClone(initial);
    client.api.cancelComposerSend = async () => structuredClone(accepted);
    client.api.stop = async () => ({ ok: true });
    client.refreshStatus = async () => undefined;
    await client.composer.open(songId);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => { entered = resolve; });
    client.api.prepareComposerSend = async (write) => {
      if (stage === "prepare") { entered(); await held; return structuredClone(accepted); }
      return { ...initial, revision: 2, pending: { requestId, payload: "keep the hook", snapshot: write.snapshot } };
    };
    client.api.chat = async () => { entered(); await held; return { ok: true, composer: structuredClone(accepted) }; };
    const sent = client.sendDraft();
    await waiting;
    await client.stopRequest();
    release();
    assert.equal(await sent, false, stage);
    assert.equal(client.composer.getSnapshot().draft.text, "keep the hook", stage);
    client.composer.dispose();
  }
});

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
