import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LyricsStore } from "../mneme/lyrics-store";
import { userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore, SongVersions } from "../mneme/song-store";
import { SetDiff } from "../mneme/set-diff";
import { RestorePlanner } from "../server/restore-planner";
import { RestoreRunner } from "../server/restore-runner";
import { SetReadError, SnapshotReader } from "../server/snapshot-reader";
import { VersionRecorder } from "../server/version-recorder";
import type { DeviceSnapshot, SetSnapshot } from "../shared/set-snapshot";
import type { LeadSheet } from "../shared/song";
import { VersionAuthor } from "../shared/versions";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

const at = TestSets.at;

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-restore-"));
}

/** The fake Set and a song with the test lead sheet and its lyrics, wired as the app wires them. */
async function rig() {
  const live = new FakeSetLive(TestSets.small(), TestSets.liveDevices());
  const paths = userPaths(join(await tempDir(), "Ode"));
  const song = new SongStore(paths, () => undefined);
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  await song.create("Night Bus");
  await song.replace(TestSets.sheet());
  await lyrics.replace(TestSets.sheet().lyrics);
  const versions = new SongVersions(song, 20);
  const reader = new SnapshotReader(live, song);
  const recorder = new VersionRecorder(reader, versions, () => undefined);
  return { live, song, lyrics, versions, reader, recorder };
}

/** A lead sheet without its lyrics revision, which goes up with every save. */
function withoutRevision(sheet: LeadSheet): Omit<LeadSheet, "lyricsRevision"> {
  const { lyricsRevision: _revision, ...rest } = sheet;
  return rest;
}

test("restoring brings the Set and the lyrics back to an earlier version, from the Set as it is now", async () => {
  const { live, song, lyrics, versions, recorder } = await rig();
  const start = await recorder.handEdits();
  assert.ok(start.version);

  live.edit((set) => {
    at(at(set.tracks, 1).arrangementClips, 0).notes = [45, 45, 52, 43].map((pitch, bar) => ({ pitch, start: bar * 4, duration: 1, velocity: 96 }));
    at(set.tracks, 2).devices.splice(1, 1);
    set.tracks.push(TestSets.track(3, "Lead", [], []));
    set.song.tempo = 124;
    at(set.song.locators, 1).name = "Hook";
  });
  const { text, revision } = await lyrics.read();
  await lyrics.write(text.replace("I count the windows going by", "I count the streetlights one by one"), revision, VersionAuthor.Ode);
  const ode = await recorder.odeChange("Lead added, bass lifted in bar 3", "add a lead");
  assert.ok(ode.version);

  // The musician mutes the drums by hand afterwards: restoring starts from the Set as it is, as History does.
  live.edit((set) => {
    at(set.tracks, 0).mute = true;
  });
  const now = await recorder.handEdits();
  const result = await new RestoreRunner(live, song, lyrics).putBack(now.snapshot, await versions.history.snapshotAt(start.version.id));
  await versions.history.truncateAfter(start.version.id);

  assert.deepEqual(result, { complete: true, skipped: [] });
  assert.deepEqual(TestSets.contents(live.snapshot()), TestSets.contents(TestSets.small()));
  assert.deepEqual(withoutRevision(await song.read()), withoutRevision(TestSets.sheet()));
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
  const unused = { songId: "night-bus", analysis: { lines: [], scheme: [], notes: [] }, revision: 0 };
  const runner = new RestoreRunner(live, { update: async () => TestSets.sheet() }, { replace: async (text) => ({ ...unused, text }) });
  const result = await runner.putBack(live.snapshot(), before);
  assert.equal(result.complete, true);
  assert.ok(result.skipped.some((item) => item.includes("Shimmer Verb")), result.skipped.join("\n"));
});

test("when Live can't answer, the Set isn't read and no version is written", async () => {
  const { live, versions, recorder } = await rig();
  live.extension.call = () => Promise.reject(new Error("Live is busy"));
  await assert.rejects(recorder.handEdits(), (error) => error instanceof SetReadError && error.message === "Ode can't read the Set: Live is busy");
  assert.deepEqual(await versions.history.list(), []);
});

/** The small test Set with these devices on the Bass track. */
function bassWith(devices: DeviceSnapshot[]): SetSnapshot {
  const set = TestSets.small();
  at(set.tracks, 1).devices = devices;
  return set;
}

const parameter = TestSets.parameter;
const operator = (index: number) => TestSets.device(index, "Operator", "Operator", [parameter(0, "Volume", 0, 1, 0.7)]);
const eq = (index: number) => TestSets.device(index, "EQ Eight", "Eq8", [parameter(0, "1 Gain A", -15, 15, 0)]);
const reverb = (index: number, decay: number) => TestSets.device(index, "Reverb", "Reverb", [parameter(0, "Decay Time", 200, 60000, decay)]);
const rack = (index: number, inner: DeviceSnapshot[]): DeviceSnapshot => ({
  index,
  name: "Audio Effect Rack",
  className: "AudioEffectGroupDevice",
  isRack: true,
  parameters: [parameter(0, "Macro 1", 0, 127, 0)],
  chains: [{ index: 0, devices: inner }],
});

test("a restore puts back a change inside a rack that an added device moved, and inserts in an order Live can follow", () => {
  const plan = (current: SetSnapshot, target: SetSnapshot) => new RestorePlanner(current).plan(SetDiff.between(current, target)).steps;
  const calls = (steps: ReturnType<typeof plan>) => steps.map((step) => step.map((call) => `${call.op} ${JSON.stringify(call.args)}`));

  const reverbBack = calls(plan(bassWith([operator(0), rack(1, [reverb(0, 20)])]), bassWith([operator(0), eq(1), rack(2, [reverb(0, 50)])])));
  assert.ok(reverbBack.flat().some((call) => call.startsWith("parameter_set") && call.includes('"chain":[1,0],"index":0') && call.includes('"value":50')), reverbBack.flat().join("\n"));

  const inserted = calls(plan(bassWith([operator(0), rack(1, [reverb(0, 20)])]), bassWith([operator(0), eq(1), rack(2, [reverb(0, 20), eq(1)])])));
  const stepOf = (op: string) => inserted.findIndex((step) => step.some((call) => call.startsWith(op)));
  assert.ok(stepOf("track_insert_device") >= 0 && stepOf("track_insert_device") < stepOf("chain_insert_device"), inserted.flat().join("\n"));
});
