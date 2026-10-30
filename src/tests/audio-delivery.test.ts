import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Hono } from "hono";
import { LocalAudioFiles } from "../live/local-audio-files";
import { AudioDeliveries } from "../mneme/audio-deliveries";
import { JsonFile } from "../mneme/json-file";
import { userPaths } from "../mneme/paths";
import { SongStore } from "../mneme/song-store";
import { encodeWav, WavBitDepth } from "../music/audio/wav";
import { OdeServer, type ServerDeps } from "../server/http";
import { audioHash } from "../services/music-audio";
import { API } from "../shared/api";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

test("exact audio deliveries recover their chat link, retry once and remain bound to their original song", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-delivery-"));
  const atomic = JsonFile.writeAtomically;
  try {
    const song = new SongStore(userPaths(root), () => undefined);
    const first = await song.create("Night Bus"), firstDir = song.dataDir;
    const audio = new LocalAudioFiles(root, join(root, "work"));
    const bytes = encodeWav({ sampleRate: 8_000, channels: [new Float32Array(400).fill(1.5)] }, WavBitDepth.Float32);
    const source = await audio.add({ name: "supplied.wav", bytes, purpose: "processed-bounce", source: "Musician-supplied Main bounce" });
    let failLink = true;
    const linked = new Set<string>();
    const deliveries = new AudioDeliveries({ song, audio, attach: async (songId, _exchangeId, ref) => {
      assert.equal(songId, first.id);
      if (failLink) { failLink = false; throw new Error("Interrupted before chat link acknowledgement"); }
      linked.add(ref.id);
    } });
    const input = { songId: first.id, exchangeId: randomUUID(), audioId: source.id, name: "Night Bus – supplied mix.wav" };
    const saved = await deliveries.retain(input);
    assert.ok(saved.linkWarning);
    assert.equal((await deliveries.list(first.id)).total, 1);
    const recovered = await deliveries.recover(first.id);
    assert.equal(recovered.failed, 0);
    assert.equal(linked.has(saved.delivery.id), true);
    const retried = await deliveries.retain(input);
    assert.equal(retried.delivery.id, saved.delivery.id);
    assert.equal((await deliveries.list(first.id, { limit: 1 })).total, 1);
    const manifest = await deliveries.read(first.id, saved.delivery.id);
    assert.equal(manifest.sha256, audioHash(bytes));
    assert.equal(manifest.sourceAudioId, source.id);
    assert.equal(manifest.audio.frames, 400);
    assert.equal(manifest.audio.sampleRate, 8_000);
    assert.equal(manifest.audio.bitDepth, 32);
    assert.equal(manifest.currentness, "unknown");
    for (const name of ["../outside.wav", "wrong-format.mp3", "bad\r\nname.wav"]) {
      await assert.rejects(deliveries.retain({ ...input, name }));
    }

    const stop = new AbortController();
    JsonFile.writeAtomically = async (...args) => { queueMicrotask(() => stop.abort()); return atomic(...args); };
    await assert.rejects(deliveries.retain({ ...input, name: "cancelled.wav" }, { signal: stop.signal }), { name: "AbortError" });
    JsonFile.writeAtomically = atomic;
    assert.equal((await deliveries.list(first.id)).total, 1);
    assert.equal((await readdir(join(firstDir, "release", "audio-deliveries"))).length, 2);
    await assert.rejects(deliveries.retain({ ...input, name: "small-window.wav" }, { maxResultChars: 100 }), /receipt.*limit/i);
    assert.equal((await deliveries.list(first.id)).total, 1);

    await deliveries.retain({ ...input, name: "Night Bus – alternate supplied name.wav" });
    const onePage = await deliveries.list(first.id, { limit: 1 });
    const maxChars = JSON.stringify(onePage).length + 16;
    const registry = new ToolRegistry({ song, deliveries, config: { limits: { toolResultMaxChars: maxChars } },
      live: { extension: { call: async () => { throw new Error("No Live call expected"); } } } } as unknown as ToolContext);
    assert.equal(registry.find("audio_delivery_add")?.changes, "memory");
    assert.equal(registry.available("subagent").some((tool) => tool.name === "audio_delivery_add"), false);
    const page = await registry.run("audio_delivery_list", { limit: 20 });
    assert.equal(page.ok, true, page.text);
    assert.ok(page.text.length <= maxChars);
    const listed = JSON.parse(page.text);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.total, 2);
    assert.equal(listed.nextOffset, 1);
    const lastPage = await registry.run("audio_delivery_list", { limit: 20, offset: listed.nextOffset });
    assert.equal(lastPage.ok, true, lastPage.text);
    const last = JSON.parse(lastPage.text);
    assert.equal(last.nextOffset, null);
    assert.notEqual(last.items[0].id, listed.items[0].id);

    const other = await song.create("Other song");
    const server = new OdeServer({ config: {}, song, songs: { isSwitching: false }, deliveries } as unknown as ServerDeps);
    const local = server as unknown as { app: Hono; token: string; routeApi(): void; guard: any; authorize: any };
    local.app.use("*", (context, next) => local.guard(context, next));
    local.app.use("*", (context, next) => local.authorize(context, next));
    local.routeApi();
    const request = (songId: string, id: string, authorized = true) => local.app.request(`http://localhost:0${API.audioDelivery(songId, id)}`, {
      headers: { host: "localhost:0", ...(authorized ? { cookie: `ode=${local.token}` } : {}) },
    });
    assert.equal((await request(first.id, saved.delivery.id, false)).status, 403);
    const download = await request(first.id, saved.delivery.id);
    assert.equal(download.status, 200);
    assert.ok(Buffer.from(await download.arrayBuffer()).equals(Buffer.from(bytes)), "Delivery must retain the exact supplied bytes, including float headroom.");
    assert.equal(download.headers.get("content-type"), "audio/wav");
    assert.equal(download.headers.get("content-length"), String(bytes.byteLength));
    assert.match(download.headers.get("content-disposition")!, /attachment;.*filename\*=UTF-8''/i);
    assert.equal(download.headers.get("cache-control"), "no-store");
    assert.equal((await request(other.id, saved.delivery.id)).status, 404);
    const retained = join(firstDir, "release", "audio-deliveries", `${saved.delivery.id}${manifest.extension}`);
    await writeFile(retained, "changed retained bytes");
    const changed = await request(first.id, saved.delivery.id);
    assert.equal(changed.status, 409);
    assert.equal(changed.headers.get("content-disposition"), null);
    assert.deepEqual(await deliveries.recover(first.id), { linked: 2, failed: 0 });
    await rm(retained);
    await assert.rejects(deliveries.download(first.id, saved.delivery.id));
    const outside = join(root, "outside.wav");
    await writeFile(outside, bytes);
    await symlink(outside, retained);
    await assert.rejects(deliveries.download(first.id, saved.delivery.id), /inside|outside|folder|contain|managed/i);
    assert.ok(Buffer.from(await readFile(outside)).equals(Buffer.from(bytes)));
  } finally { JsonFile.writeAtomically = atomic; await rm(root, { recursive: true, force: true }); }
});
