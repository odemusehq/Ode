import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { encodeWav, WavBitDepth } from "../audio/wav";
import { Dictation, DictationError } from "../server/dictation";
import { OdeServer, type ServerDeps } from "../server/http";
import { API } from "../shared/api";
import type { Hono } from "hono";

const wav = (frames = 160, channels = 1, sampleRate = 16000) => encodeWav({ sampleRate, channels: Array.from({ length: channels }, () => new Float32Array(frames).fill(0.1)) }, WavBitDepth.Int16);

test("dictation validates actual PCM WAV, dimensions and duration before any provider call", () => {
  assert.doesNotThrow(() => Dictation.validate(wav()));
  assert.doesNotThrow(() => Dictation.validate(wav(240, 1, 24000)));
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("not WAV"), wav(0), wav(160, 2), wav(160, 3), wav(160, 1, 48000), wav(1450000, 1, 24000)]) {
    assert.throws(() => Dictation.validate(bytes), DictationError);
  }
});

test("dictation uses temporary speech bytes, forwards cancellation and cleans every outcome", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-dictation-check-"));
  try {
    const bytes = wav();
    const controller = new AbortController();
    let calls = 0;
    const dictation = new Dictation({ transcribe: async (path, signal) => {
      calls++;
      assert.equal(signal, controller.signal);
      assert.deepEqual(await readFile(path), Buffer.from(bytes));
      return { text: "  Keep the vocal  ", turns: [] };
    } }, directory);
    assert.equal(await dictation.transcribe(bytes, controller.signal), "Keep the vocal");
    assert.equal(calls, 1);
    assert.deepEqual(await readdir(directory), []);
    const cancelled = new Dictation({ transcribe: async (_path, signal) => {
      controller.abort();
      signal?.throwIfAborted();
      return { text: "", turns: [] };
    } }, directory);
    await assert.rejects(cancelled.transcribe(bytes, controller.signal), (error) => error instanceof DictationError && error.status === 408);
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("dictation route permits song switching and refuses a late transcript for the previous song", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ode-dictation-route-"));
  try {
    const song = { songId: "first-song" };
    let entered!: () => void, finish!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const waiting = new Promise<void>((resolve) => { finish = resolve; });
    let calls = 0;
    const server = new OdeServer({ config: { tempDir: directory }, song, songs: { isSwitching: false },
      models: { roles: async () => ({ transcription: { provider: "meta", baseUrl: "https://invalid.test", apiKey: "fixture-key", model: "fixture" } }) },
      services: { transcribe: async () => { calls++; entered(); await waiting; return { text: "Keep the vocal", turns: [] }; } },
    } as unknown as ServerDeps);
    const local = server as unknown as { app: Hono; token: string; modifyingRequests: number; routeApi(): void; guard: any; authorize: any };
    local.app.use("*", (context, next) => local.guard(context, next));
    local.app.use("*", (context, next) => local.authorize(context, next));
    local.routeApi();
    const form = new FormData();
    form.set("songId", song.songId);
    form.set("file", new File([wav()], "dictation.wav", { type: "audio/wav" }));
    const response = local.app.request(`http://localhost:0${API.dictation}`, { method: "POST", body: form,
      headers: { host: "localhost:0", origin: "http://localhost:0", cookie: `ode=${local.token}` } });
    await started;
    assert.equal(local.modifyingRequests, 0);
    song.songId = "second-song";
    finish();
    const result = await response;
    assert.equal(result.status, 409);
    assert.match((await result.json() as { error: string }).error, /song changed/);
    assert.equal(calls, 1);
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
