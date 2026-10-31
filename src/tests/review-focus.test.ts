import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { NotFoundError } from "../live/extension/errors";
import { ReferenceResolver } from "../live/extension/refs";
import { userPaths } from "../mneme/paths";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore } from "../mneme/song-store";
import { ModelServices } from "../services";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { FakeLive } from "./fake-live";

function notFound(message: string): (error: unknown) => boolean {
  return (error) => error instanceof NotFoundError && error.message === message;
}

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-test-"));
}

// 1. Songs: each keeps its own data, and the one used last opens again.

test("each song keeps its own lyrics, and the song used last opens again", async () => {
  const paths = userPaths(join(await tempDir(), "Ode"));
  const songs = new SongStore(paths, () => undefined);
  const nightBus = await songs.create("Night Bus");
  await songs.saveLyrics(() => "[Verse 1]\nThe last bus leaves at midnight");
  await songs.create("Morning Train");
  assert.equal((await songs.read()).lyrics, "");
  await songs.open(nightBus.id);
  assert.match((await songs.read()).lyrics, /last bus/);
  const reopened = new SongStore(paths, () => undefined);
  assert.equal((await reopened.openLast()).id, nightBus.id);
  assert.deepEqual((await reopened.list()).map((song) => song.title).sort(), ["Morning Train", "Night Bus"]);
});

// 2. The musician moves, renames or deletes things while Ode works.

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

// 4. Optional providers left unset.

test("optional providers left unset name the setting to add", async () => {
  const dir = await tempDir();
  const services = new ModelServices(new ModelRoles(new SettingsStore(dir, ProviderCatalog.bundled), ProviderCatalog.bundled));
  const available = await services.available();
  assert.equal(available.stem_separation, false);
  assert.equal(available.singing_voice, false);
  assert.equal(available.sound_generation, false);
  await assert.rejects(
    async () => services.generateSound("rain on a tin roof", 2, join(dir, "rain.wav")),
    /Add a sound generation service/,
  );
  await assert.rejects(
    async () => services.separateStem(join(dir, "song.wav"), "the guitar", dir),
    /Add a stem separation service/,
  );
});
