import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LyricsStore } from "../mneme/lyrics-store";
import { userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore, SongVersions } from "../mneme/song-store";
import { VersionAuthor } from "../shared/versions";
import { TestSets } from "./sets";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-song-data-"));
}

/** A song store in a fresh user folder, with its lyrics, on an unsaved Set. */
async function songWithLyrics(): Promise<{ root: string; song: SongStore; lyrics: LyricsStore }> {
  const root = await tempDir();
  const paths = userPaths(join(root, "Ode"));
  const song = new SongStore(paths, () => undefined);
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  await song.open({ setId: "unsaved-1", filePath: null, instance: "first" });
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

test("two Sets in one project folder keep their own song and versions", async () => {
  const root = await tempDir();
  const song = new SongStore(userPaths(join(root, "Ode")), () => undefined);
  const versions = new SongVersions(song, 20);
  const project = join(root, "Projects", "Night Bus Project");
  const band = join(project, "Night Bus.als");
  const acoustic = join(project, "Night Bus acoustic.als");

  await song.open({ setId: band, filePath: band, instance: "first" });
  await song.update({ title: "Night Bus" });
  assert.ok(await versions.history.record(TestSets.small(), VersionAuthor.Musician, "Opened"));

  await song.open({ setId: acoustic, filePath: acoustic, instance: "second" });
  assert.equal(song.dataDir, join(project, "Ode", "Night Bus acoustic"));
  assert.equal((await song.read()).title, "");
  assert.deepEqual(await versions.history.list(), []);

  await song.open({ setId: band, filePath: band, instance: "third" });
  assert.equal(song.dataDir, join(project, "Ode", "Night Bus"));
  assert.equal((await song.read()).title, "Night Bus");
  assert.equal((await versions.history.list()).length, 1);
});

test("Save As carries the song and its versions to the new name, and the Set under the old name keeps its own", async () => {
  const { root, song, lyrics } = await songWithLyrics();
  const versions = new SongVersions(song, 20);
  const first = join(root, "Projects", "Night Bus Project", "Night Bus.als");
  await song.open({ setId: first, filePath: first, instance: "first" });
  await song.update({ title: "Night Bus" });
  await lyrics.replace("[Verse 1]\nThe last bus leaves at midnight");
  const opened = await versions.history.record(TestSets.small(), VersionAuthor.Musician, "Opened");
  assert.ok(opened);

  const second = join(root, "Projects", "Night Bus v2 Project", "Night Bus v2.als");
  const savedAs = { setId: second, filePath: second, instance: "first" };
  assert.equal(song.continues(savedAs), true);
  await song.open(savedAs);
  assert.equal(song.dataDir, join(root, "Projects", "Night Bus v2 Project", "Ode", "Night Bus v2"));
  assert.equal((await song.read()).title, "Night Bus");
  assert.equal((await lyrics.read()).text, "[Verse 1]\nThe last bus leaves at midnight");
  assert.deepEqual((await versions.history.list()).map((version) => version.id), [opened.id]);
  await stat(join(root, "Projects", "Night Bus Project", "Ode", "Night Bus", "song.json"));

  assert.equal(song.continues({ setId: "unsaved-2", filePath: null, instance: "second" }), false);
});
