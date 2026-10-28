import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { SessionManager } from "../harness/session-manager";
import { userPaths } from "../mneme/paths";
import { SongStore, SongVersions } from "../mneme/song-store";
import { Listening } from "../server/listening";
import { RestoreRunner } from "../server/restore-runner";
import { SetReadError, SnapshotReader } from "../server/snapshot-reader";
import { RefusedError, VersionActions } from "../server/version-actions";
import { VersionRecorder } from "../server/version-recorder";
import { VersionAuthor } from "../shared/versions";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

const at = TestSets.at;

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-restore-"));
}

/** The fake Set and an unsaved song with the test lead sheet, wired as the server wires them. */
async function rig() {
  const live = new FakeSetLive(TestSets.small(), TestSets.liveDevices());
  const song = new SongStore(userPaths(join(await tempDir(), "Ode")), () => undefined);
  await song.open({ setId: "unsaved-1", filePath: null });
  await song.replace(TestSets.sheet());
  const versions = new SongVersions(song, 20);
  const reader = new SnapshotReader(live, song);
  const recorder = new VersionRecorder(reader, versions, () => undefined);
  return { live, song, versions, reader, recorder };
}

test("restoring brings the Set and the lyrics back to an earlier version, from the Set as it is now", async () => {
  const { live, song, versions, recorder } = await rig();
  const start = await recorder.handEdits();
  assert.ok(start.version);

  live.edit((set) => {
    at(at(set.tracks, 1).arrangementClips, 0).notes = [45, 45, 52, 43].map((pitch, bar) => ({ pitch, start: bar * 4, duration: 1, velocity: 96 }));
    at(set.tracks, 2).devices.splice(1, 1);
    set.tracks.push(TestSets.track(3, "Lead", [], []));
    set.song.tempo = 124;
    at(set.song.locators, 1).name = "Hook";
  });
  const sheet = await song.read();
  at(at(sheet.sections, 0).lines, 1).text = "I count the streetlights one by one";
  await song.replace(sheet);
  const ode = await recorder.odeChange("Lead added, bass lifted in bar 3", "add a lead");
  assert.ok(ode.version);

  // The musician mutes the drums by hand afterwards: restoring starts from the Set as it is, as History does.
  live.edit((set) => {
    at(set.tracks, 0).mute = true;
  });
  const now = await recorder.handEdits();
  const result = await new RestoreRunner(live, song).putBack(now.snapshot, await versions.history.snapshotAt(start.version.id));
  await versions.history.truncateAfter(start.version.id);

  assert.deepEqual(result, { complete: true, skipped: [] });
  assert.deepEqual(TestSets.contents(live.snapshot()), TestSets.contents(TestSets.small()));
  assert.deepEqual(await song.read(), TestSets.sheet());
  assert.deepEqual((await versions.history.list()).map((version) => version.id), [start.version.id]);
});

test("what can't be put back, such as a plug-in removed by hand, is listed instead of skipped silently", async () => {
  const set = TestSets.small();
  at(set.tracks, 2).devices.push(TestSets.device(2, "Shimmer Verb", "PluginDevice", [TestSets.parameter(0, "Mix", 0, 1, 0.4)]));
  const live = new FakeSetLive(set, TestSets.liveDevices());
  const before = live.snapshot();
  live.edit((current) => {
    at(current.tracks, 2).devices.pop();
  });
  const result = await new RestoreRunner(live, { read: async () => TestSets.sheet(), replace: async (sheet) => sheet }).putBack(live.snapshot(), before);
  assert.equal(result.complete, true);
  assert.ok(result.skipped.some((item) => item.includes("Shimmer Verb")), result.skipped.join("\n"));
});

test("Ode plays the bars it changed", async () => {
  const { live, reader, recorder } = await rig();
  await recorder.handEdits();
  live.edit((set) => {
    const notes = at(at(set.tracks, 1).arrangementClips, 0).notes ?? [];
    at(notes, 2).pitch = 52;
  });
  const ode = await recorder.odeChange("Bass lifted in bar 3", "lift the bass");
  await new Listening(live, reader).playChanged(ode.changes);
  const { transport } = live.snapshot();
  assert.deepEqual(transport.loop, { on: true, start: 8, length: 4 });
  assert.equal(transport.playing, true);
});

// Review Focus 4: an unsaved Set.

test("an unsaved Set keeps its versions in the user folder, they move into the project on first save, and a copy asks to save first", async () => {
  const root = await tempDir();
  const paths = userPaths(join(root, "Ode"));
  const song = new SongStore(paths, () => undefined);
  await song.open({ setId: "unsaved-2", filePath: null });
  const versions = new SongVersions(song, 20);
  const first = await versions.history.record(TestSets.small(), VersionAuthor.Musician, "Opened");
  assert.ok(first);
  await stat(join(paths.unsaved, "unsaved-2", "versions", "versions.jsonl"));

  const live = new FakeSetLive(TestSets.small());
  const recorder = new VersionRecorder(new SnapshotReader(live, song), versions, () => undefined);
  // Copying never runs a request, so it needs no session.
  const actions = new VersionActions({ live, song, versions, recorder, sessions: {} as SessionManager, emit: () => undefined });
  await assert.rejects(actions.copy(first.id), (error) => error instanceof RefusedError && error.message === "Save the Set first");

  const setFile = join(root, "Projects", "Night Bus Project", "Night Bus.als");
  await song.open({ setId: setFile, filePath: setFile });
  await stat(join(root, "Projects", "Night Bus Project", "Ode", "versions", "versions.jsonl"));
  assert.deepEqual((await versions.history.list()).map((version) => version.id), [first.id]);
});

// Review Focus 5: the extension isn't connected.

test("with the extension disconnected the Set can't be read, and no version is written", async () => {
  const { live, versions, recorder } = await rig();
  live.extension.disconnect();
  await assert.rejects(recorder.handEdits(), (error) => error instanceof SetReadError && error.message === "Ode can't read the Set: connect the fake Ode extension.");
  assert.deepEqual(await versions.history.list(), []);
});
