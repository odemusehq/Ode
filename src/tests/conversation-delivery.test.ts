import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConversationStore } from "../mneme/conversations";
import type { AudioDeliveryRef } from "../shared/audio-delivery";

test("retained audio links survive stopped-turn reload, cannot move songs or repoint, and never hide chat", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-conversation-delivery-"));
  try {
    const songId = randomUUID(), store = new ConversationStore(root, 2), log = store.log(songId);
    const exchangeId = await log.begin("Keep this supplied bounce");
    const ref: AudioDeliveryRef = { id: randomUUID(), songId, name: "Main.wav", sourceAudioId: randomUUID(),
      sha256: "a".repeat(64), bytes: 100, createdAt: new Date().toISOString(), provenance: "user-supplied", currentness: "unknown" };
    assert.equal(await log.addDelivery(exchangeId, ref), true);
    assert.equal(await log.addDelivery(exchangeId, ref), false);
    await assert.rejects(log.addDelivery(exchangeId, { ...ref, sha256: "b".repeat(64) }), /repoint/);
    await assert.rejects(log.addDelivery(exchangeId, { ...ref, songId: randomUUID() }), /another song/);
    await assert.rejects(log.addDelivery(randomUUID(), ref), /exchange.*missing/);
    await log.finish(exchangeId, "", "stopped");
    const reopened = new ConversationStore(root, 2).log(songId);
    assert.deepEqual((await reopened.find(exchangeId))?.deliveries, [ref]);
    assert.equal((await reopened.find(exchangeId))?.status, "stopped");
    const file = join(root, `${log.id}.json`);
    const raw = JSON.parse(await readFile(file, "utf8"));
    raw[0].deliveries.push({ id: "unsupported future link" });
    await writeFile(file, JSON.stringify(raw));
    const read = (await new ConversationStore(root, 2).log(songId).all())[0]!;
    assert.equal(read.request, "Keep this supplied bounce");
    assert.deepEqual(read.deliveries, [ref]);
    assert.equal(read.status, "stopped");
  } finally { await rm(root, { recursive: true, force: true }); }
});
