import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { WSContext } from "hono/ws";
import { NotFoundError } from "../live/extension/errors";
import { ReferenceResolver } from "../live/extension/refs";
import { userPaths } from "../mneme/paths";
import { SongStore } from "../mneme/song-store";
import { analyzeLine } from "../music/phonetics/line-analyzer";
import { analyzeLyrics } from "../music/prosody/lyrics-analyzer";
import { compareRhyme } from "../music/rhyme/rhyme-comparer";
import { LiveHub, NotConnectedError } from "../server/live-hub";
import { ModelServices } from "../services";
import { OdeConfig } from "../shared/config";
import { FakeLive } from "./fake-live";
import { testEnv } from "./test-env";

const TIMEOUTS = { normal: 200, long: 400 };
const NO_EVENTS = { onSetInfo: () => undefined, onStatus: () => undefined };

/** A local port with nothing listening on it. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function newHub(): Promise<LiveHub> {
  return new LiveHub("127.0.0.1", await closedPort(), TIMEOUTS, NO_EVENTS);
}

function notConnected(pattern: RegExp): (error: unknown) => boolean {
  return (error) => error instanceof NotConnectedError && pattern.test(error.message);
}

function notFound(message: string): (error: unknown) => boolean {
  return (error) => error instanceof NotFoundError && error.message === message;
}

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-test-"));
}

// 1. Live closed, extension not connected, or the Ode device not on the Master.

test("Live parts that aren't connected answer 'not connected' with what to do", async () => {
  const hub = await newHub();
  await assert.rejects(hub.device.call("transport_play", {}), notConnected(/^not connected: Ode device\. Put the Ode device on the Master track\./));
  await assert.rejects(hub.extension.call("song_get", {}), notConnected(/^not connected: Ode extension\./));
  await assert.rejects(hub.bridge.call("browser_search", { query: "piano" }), notConnected(/^not connected: Ode bridge\./));
});

test("a change made while the extension's connection is closed is queued, with how to apply it", async () => {
  const hub = await newHub();
  const result = await hub.extension.call<{ queued: boolean; message: string }>("song_create_midi_track", { name: "Bass" });
  assert.equal(result.queued, true);
  assert.match(result.message, /Ode: Apply changes/);
  assert.equal(hub.extension.takeQueue().length, 1);
});

test("a connected part that never answers times out instead of hanging", async () => {
  const hub = await newHub();
  hub.device.attach({ send: () => undefined } as unknown as WSContext);
  const started = performance.now();
  await assert.rejects(hub.device.call("transport_play", {}), /did not answer "transport_play"/);
  assert.ok(performance.now() - started < 2_000);
});

// 2. Unsaved or moved Set.

test("an unsaved Set keeps its song in the user folder and moves it into its folder in the project on first save", async () => {
  const root = await tempDir();
  const paths = userPaths(join(root, "Ode"));
  const store = new SongStore(paths, () => undefined);
  await store.open({ setId: "unsaved-1", filePath: null, instance: "first" });
  await store.update({ title: "Night Bus Frequencies" });
  const unsavedDir = join(paths.unsaved, "unsaved-1");
  assert.equal(store.dataDir, unsavedDir);

  const setFile = join(root, "Projects", "Night Bus Project", "Night Bus.als");
  await store.open({ setId: setFile, filePath: setFile, instance: "first" });
  assert.equal(store.dataDir, join(root, "Projects", "Night Bus Project", "Ode", "Night Bus"));
  assert.equal((await store.read()).title, "Night Bus Frequencies");
  await assert.rejects(stat(unsavedDir), { code: "ENOENT" });

  const reopened = new SongStore(paths, () => undefined);
  await reopened.open({ setId: setFile, filePath: setFile, instance: "later" });
  assert.equal((await reopened.read()).title, "Night Bus Frequencies");
});

// 3. The musician moves, renames or deletes things while Ode works.

test("moved or renamed objects are reported as not found; a tagged clip is found again by its tag", () => {
  const live = new FakeLive();
  const hook = live.midiClip("Chorus melody ·o3f2", 16);
  const vocals = live.midiTrack("Vocals", [hook]);
  live.midiTrack("Bass");
  const refs = new ReferenceResolver(live.liveSet());

  hook.startTime = 32;
  vocals.name = "Lead vocal";

  assert.throws(() => refs.clip({ track: { index: 0 }, start: 16 }), notFound("not found: Arrangement clip at beat 16 on track at index 0"));
  assert.throws(() => refs.track({ name: "Vocals" }), notFound('not found: track named "Vocals"'));
  assert.throws(() => refs.track({ index: 5 }), notFound("not found: track at index 5"));
  assert.equal(refs.clip({ tag: "o3f2" }).clip, hook);
});

// 4. Words missing from the dictionaries, and UK/US differences.

test("words missing from the dictionaries are marked not certain, and the accent changes rhymes", () => {
  for (const accent of ["us", "uk"] as const) {
    assert.equal(analyzeLine("zorblefrax", accent).words[0]?.certain, false);
  }
  const analysis = analyzeLyrics(["the zorblefrax was singing"], "uk");
  assert.ok(analysis.notes.some((note) => note.kind === "uncertain" && note.message.includes("zorblefrax")));
  assert.notEqual(compareRhyme("bath", "math", "uk").kind, compareRhyme("bath", "math", "us").kind);
});

// 5. Providers missing or not configured.

test("optional providers left unset say 'not configured' instead of failing", async () => {
  const dir = await tempDir();
  const services = new ModelServices(OdeConfig.load(testEnv(dir)));
  const available = services.available();
  assert.equal(available.stem_separation, false);
  assert.equal(available.singing_voice, false);
  assert.equal(available.sound_generation, false);
  await assert.rejects(
    async () => services.generateSound("rain on a tin roof", 2, join(dir, "rain.wav")),
    /not configured: set ODE_SOUND_GENERATION_PROVIDER/,
  );
  await assert.rejects(
    async () => services.separateStem(join(dir, "song.wav"), "the guitar", dir),
    /not configured: set ODE_STEM_SEPARATION_PROVIDER/,
  );
});
