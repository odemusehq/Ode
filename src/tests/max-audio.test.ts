import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MaxAudioCapture } from "../server/max-audio";
import { MaxWindowBridge } from "../server/max-window";
import type { MaxAudioCommand, MaxAudioMessage, MaxAudioSource } from "../shared/max-audio";
import { MAX_AUDIO } from "../shared/max-audio";
import { Hono } from "hono";
import { OdeServer, type ServerDeps } from "../server/http";

const source = { id: "max-track-20-post", name: "Bass", kind: "track", stage: "post-mixer" } as const;
const host = { trackName: "Ode", deviceName: "Ode" };
const timing = { startedBeat: 0, endedBeat: 1, prerollBeats: 0, rangeUncertainty: "Host scheduler boundary" };

async function fixture(audioVersion?: number) {
  const tempDir = await mkdtemp(join(tmpdir(), "ode-max-audio-"));
  const window = new MaxWindowBridge(() => "http://localhost:12345/?view=ask&token=test");
  const audio = new MaxAudioCapture({ tempDir, window });
  const bootstrap = window.prepare({ setId: "sdk-set", deviceId: "sdk-device" });
  const { session } = window.connect(bootstrap.capability, audioVersion);
  const command = () => window.poll(session).audio as MaxAudioCommand;
  const send = (message: MaxAudioMessage) => audio.receive(session, message);
  const catalogue = async (sources: readonly MaxAudioSource[] = [source]) => {
    const result = audio.sources();
    const request = command();
    await send({ kind: "sources", id: request.id, catalogueId: "catalogue-1", sources, host });
    return result;
  };
  return { tempDir, window, audio, session, command, send, catalogue, close: () => rm(tempDir, { recursive: true, force: true }) };
}

test("old Max devices cannot queue audio work", async () => {
  const f = await fixture();
  try { await assert.rejects(f.audio.sources(), /upgrade|audio|device/i); assert.equal(f.window.poll(f.session).audio, undefined); }
  finally { await f.close(); }
});

test("selected mixes require an updated device and retain the actual included sources", async () => {
  const main = { id: "main-post", name: "Main", kind: "main", stage: "post-mixer" } as const;
  for (const version of [2, MAX_AUDIO.version]) {
    const f = await fixture(version);
    try {
      await f.catalogue([source, main]);
      const input = { sourceId: main.id, includeSourceIds: [source.id], startBeat: 0, durationSeconds: 0.001 };
      if (version === 2) { await assert.rejects(f.audio.capture(input), /device/i); assert.equal(f.command(), null); continue; }
      await assert.rejects(f.audio.capture({ ...input, includeSourceIds: ["stale"] }), /source/i);
      await assert.rejects(f.audio.capture({ ...input, sourceId: source.id }), /Main/i);
      const captured = f.audio.capture(input), request = f.command();
      assert.deepEqual(request.kind === "capture" && request.includeSourceIds, [source.id]);
      await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: main.id, sampleRate: 8000, channels: 2, frames: 8 });
      await f.send({ kind: "chunk", id: request.id, offset: 0, channels: [Array(8).fill(0.1), Array(8).fill(0.2)] });
      await f.send({ kind: "complete", id: request.id, frames: 8, timing });
      assert.deepEqual((await captured).includedSources, [source]);
    } finally { await f.close(); }
  }
});

test("completed ordered PCM is float32 WAV and retains values above full scale", async () => {
  const f = await fixture(1);
  try {
    assert.deepEqual((await f.catalogue()).sources, [source]);
    const captured = f.audio.capture({ sourceId: source.id, durationSeconds: 0.001 });
    const request = f.command();
    await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: source.id, sampleRate: 8000, channels: 2, frames: 8 });
    await f.send({ kind: "chunk", id: request.id, offset: 0, channels: [Array(8).fill(1.5), Array(8).fill(-2)] });
    await f.send({ kind: "complete", id: request.id, frames: 8, timing });
    const result = await captured;
    const wav = await readFile(result.path);
    const data = wav.indexOf(Buffer.from("data"));
    assert.equal(wav.readUInt16LE(20), 3);
    assert.equal(wav.readFloatLE(data + 8), 1.5);
    assert.equal(wav.readFloatLE(data + 12), -2);
    assert.equal(result.sha256.length, 64);
    assert.equal(result.frames, 8);
    assert.deepEqual(result.source, source);
  } finally { await f.close(); }
});

test("compact PCM preserves stereo samples and refuses malformed byte lengths", async () => {
  for (const broken of [false, true]) {
    const f = await fixture(2);
    try {
      await f.catalogue();
      const captured = f.audio.capture({ sourceId: source.id, durationSeconds: 0.001 });
      const rejected = broken ? assert.rejects(captured) : null;
      const request = f.command();
      await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: source.id, sampleRate: 8000, channels: 2, frames: 8 });
      const bytes = Buffer.alloc(broken ? 7 : 64);
      if (!broken) { bytes.writeFloatLE(1.5, 0); bytes.writeFloatLE(-2, 4); }
      const message = { kind: "pcm", id: request.id, offset: 0, data: bytes.toString("base64") } as any;
      if (broken) { await assert.rejects(f.send(message)); await rejected; assert.deepEqual(await readdir(f.tempDir), []); }
      else {
        await f.send(message); await f.send({ kind: "complete", id: request.id, frames: 8, timing });
        const wav = await readFile((await captured).path), start = wav.indexOf(Buffer.from("data")) + 8;
        assert.equal(wav.readFloatLE(start), 1.5); assert.equal(wav.readFloatLE(start + 4), -2);
      }
    } finally { await f.close(); }
  }
});

test("a gap revokes the capture and publishes no file", async () => {
  const f = await fixture(1);
  try {
    await f.catalogue();
    const captured = f.audio.capture({ sourceId: source.id, durationSeconds: 0.001 });
    const rejected = assert.rejects(captured, /order|offset|chunk/i);
    const request = f.command();
    await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: source.id, sampleRate: 8000, channels: 2, frames: 8 });
    await assert.rejects(f.send({ kind: "chunk", id: request.id, offset: 1, channels: [[1], [1]] }), /order|offset|chunk/i);
    await rejected;
    assert.deepEqual(await readdir(f.tempDir), []);
  } finally { await f.close(); }
});

test("device invalidation cancels waiting work", async () => {
  const f = await fixture(1);
  try {
    const pending = f.audio.sources();
    const rejected = assert.rejects(pending, /disconnect|changed|cancel/i);
    f.window.invalidate();
    await rejected;
    assert.deepEqual(await readdir(f.tempDir), []);
  } finally { await f.close(); }
});

test("abort revokes an in-progress PCM transfer", async () => {
  const f = await fixture(1);
  try {
    await f.catalogue();
    const signal = new AbortController();
    const pending = f.audio.capture({ sourceId: source.id, durationSeconds: 1 }, signal.signal);
    const rejected = assert.rejects(pending, /cancel/i);
    const request = f.command();
    await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: source.id, sampleRate: 8000, channels: 2, frames: 8000 });
    signal.abort();
    await rejected;
    assert.deepEqual(f.command(), { kind: "cancel", id: request.id });
    await assert.rejects(f.send({ kind: "complete", id: request.id, frames: 8000, timing }), /no longer/i);
    assert.deepEqual(await readdir(f.tempDir), []);
  } finally { await f.close(); }
});

test("selected capture cancellation waits for Max cleanup before releasing the device", async () => {
  const f = await fixture(MAX_AUDIO.version);
  try {
    const main = { id: "main", name: "Main", kind: "main", stage: "post-mixer" } as const;
    await f.catalogue([source, main]);
    const controller = new AbortController();
    let settled = false;
    const pending = f.audio.capture({ sourceId: main.id, includeSourceIds: [source.id], durationSeconds: 1, startBeat: 0 }, controller.signal);
    const rejected = assert.rejects(pending, /cancel/i).then(() => { settled = true; });
    const request = f.command(); controller.abort(); await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(f.command(), { kind: "cancel", id: request.id });
    assert.deepEqual(f.command(), { kind: "cancel", id: request.id });
    await assert.rejects(f.audio.sources(), /already/i);
    await f.send({ kind: "cancelled", id: request.id, restored: true });
    await rejected; assert.equal(f.command(), null);
  } finally { await f.close(); }
});

test("incomplete transfers and nonfinite samples never publish audio", async () => {
  for (const invalid of ["complete", "nonfinite", "overflow"] as const) {
    const f = await fixture(1);
    try {
      await f.catalogue();
      const pending = f.audio.capture({ sourceId: source.id, durationSeconds: 0.001 });
      const rejected = assert.rejects(pending);
      const request = f.command();
      await f.send({ kind: "begin", id: request.id, catalogueId: "catalogue-1", sourceId: source.id, sampleRate: 8000, channels: 2, frames: 8 });
      const message: MaxAudioMessage = invalid === "complete" ? { kind: "complete", id: request.id, frames: 8, timing }
        : { kind: "chunk", id: request.id, offset: 0, channels: [[invalid === "nonfinite" ? Infinity : 1e300], [0]] };
      await assert.rejects(f.send(message));
      await rejected;
      assert.deepEqual(await readdir(f.tempDir), []);
    } finally { await f.close(); }
  }
});

test("audio HTTP keeps private sessions isolated and bounds request bodies", async () => {
  const f = await fixture(1);
  try {
    const server = new OdeServer({ maxWindow: f.window, maxAudio: f.audio, songs: { isSwitching: false } } as unknown as ServerDeps);
    const local = server as unknown as { app: Hono; guard: any; authorize: any; routeMaxAudio(): void };
    local.app.use("*", (c, next) => local.guard(c, next));
    local.app.use("*", (c, next) => local.authorize(c, next));
    local.routeMaxAudio();
    const send = (body: unknown, headers: Record<string, string> = {}) => local.app.request(`http://localhost:0${MAX_AUDIO.messagePath}`, {
      method: "POST", body: JSON.stringify(body), headers: { host: "localhost:0", "content-type": "application/json", ...headers },
    });
    const pending = f.audio.sources();
    const request = f.command();
    const message = { kind: "sources", id: request.id, catalogueId: "catalogue-http", sources: [source], host };
    assert.equal((await send({ session: "0".repeat(48), message })).status, 403);
    assert.equal((await send({ session: f.session, message }, { origin: "https://example.org" })).status, 403);
    assert.equal((await send({ session: f.session, message, extra: "x".repeat(MAX_AUDIO.maxBodyBytes) })).status, 413);
    assert.equal((await send({ session: f.session, message })).status, 200);
    assert.equal((await pending).catalogueId, "catalogue-http");
  } finally { await f.close(); }
});
