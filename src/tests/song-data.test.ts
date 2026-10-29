import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LyricsForAnotherSongError, LyricsStore } from "../mneme/lyrics-store";
import { userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore, SongVersions } from "../mneme/song-store";
import { VersionAuthor } from "../shared/versions";
import { TestSets } from "./sets";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-song-data-"));
}

/** A song store in a fresh user folder, with its lyrics, on a new song. */
async function songWithLyrics(): Promise<{ root: string; song: SongStore; lyrics: LyricsStore }> {
  const root = await tempDir();
  const paths = userPaths(join(root, "Ode"));
  const song = new SongStore(paths, () => undefined);
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  await song.create("Night Bus");
  return { root, song, lyrics };
}

test("lyrics saved by the musician and by Ode at the same time keep both changes when they are on different lines", async () => {
  const { lyrics } = await songWithLyrics();
  const base = await lyrics.replace("[Verse 1]\nThe last bus leaves at midnight\nI count the windows going by\nThe driver hums a song I know");
  await lyrics.write(base.text.replace("at midnight", "at half past twelve"), base.revision, VersionAuthor.Musician);
  const saved = await lyrics.write(base.text.replace("a song I know", "a tune I know"), base.revision, VersionAuthor.Ode);
  assert.equal(saved.text, "[Verse 1]\nThe last bus leaves at half past twelve\nI count the windows going by\nThe driver hums a tune I know");
  assert.deepEqual(saved.conflicts, []);
  assert.equal(saved.revision, base.revision + 2);
});

test("where the musician and Ode change the same line, the musician's line is kept and listed", async () => {
  const { lyrics } = await songWithLyrics();
  const base = await lyrics.replace("[Chorus]\nWe run until the morning\nAnd never look behind");
  await lyrics.write(base.text.replace("until the morning", "until the light"), base.revision, VersionAuthor.Musician);
  const saved = await lyrics.write(base.text.replace("until the morning", "into the morning"), base.revision, VersionAuthor.Ode);
  assert.equal(saved.text, "[Chorus]\nWe run until the light\nAnd never look behind");
  assert.deepEqual(saved.conflicts, [2]);
});

test("two songs keep their own versions", async () => {
  const root = await tempDir();
  const song = new SongStore(userPaths(join(root, "Ode")), () => undefined);
  const versions = new SongVersions(song, 20);
  const band = await song.create("Night Bus");
  assert.ok(await versions.history.record(TestSets.small(), VersionAuthor.Musician, "Opened"));
  await song.create("Night Bus, acoustic");
  assert.deepEqual(await versions.history.list(), []);
  await song.open(band.id);
  assert.equal((await versions.history.list()).length, 1);
});

test("a lyrics save made in one song stays out of the song opened after it", async () => {
  const { song, lyrics } = await songWithLyrics();
  const first = song.songId;
  await lyrics.write("Night bus, lights out", 0, VersionAuthor.Musician, first);
  await song.create("Night Bus, acoustic");
  await assert.rejects(lyrics.write("Night bus, lights out\nA line typed late", 1, VersionAuthor.Musician, first), LyricsForAnotherSongError);
  assert.equal((await lyrics.read()).text, "");
});
