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
import { restoreStepExplains } from "../server/restore-change-scope";
import { SetReadError, SnapshotReader } from "../server/snapshot-reader";
import { VersionRecorder } from "../server/version-recorder";
import type { DeviceSnapshot, SetSnapshot } from "../shared/set-snapshot";
import type { LeadSheet } from "../shared/song";
import { VersionAuthor } from "../shared/versions";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

const at = TestSets.at;

test("a changed device parameter layout is recorded whole and never restored by numeric index", () => {
  for (const field of ["name", "range", "count"] as const) {
    const before = TestSets.small();
    const after = structuredClone(before);
    const device = at(at(after.tracks, 1).devices, 0);
    const parameter = at(device.parameters, 0);
    if (field === "name") parameter.name = "Another control";
    if (field === "range") parameter.max = 2000;
    if (field === "count") device.parameters.pop();
    parameter.value = 600;
    const changes = SetDiff.between(before, after);
    assert.deepEqual(TestSets.contents(SetDiff.apply(before, changes)), TestSets.contents(after));
    const plan = new RestorePlanner(after).plan(SetDiff.between(after, before));
    assert.equal(plan.steps.flat().some((call) => call.op === "parameter_set"), false);
    assert.ok(plan.skipped.length > 0);
  }
});

test("take-lane names can be restored while unsupported lane structure is explicit", () => {
  const current = TestSets.small();
  at(current.tracks, 1).takeLanes = [{ lane: 0, name: "Comp A", clips: [] }];
  const target = structuredClone(current);
  at(at(target.tracks, 1).takeLanes, 0).name = "Chosen take";
  const renamed = new RestorePlanner(current).plan(SetDiff.between(current, target));
  assert.deepEqual(renamed.steps.flat().map(({ op, args }) => ({ op, args })), [
    { op: "take_lane_rename", args: { lane: { track: { index: 1 }, lane: 0 }, name: "Chosen take" } },
  ]);
  assert.deepEqual(renamed.skipped, []);
  const call = renamed.steps.flat()[0]!;
  const change = SetDiff.between(current, target)[0]!;
  assert.equal(restoreStepExplains(call, change, current), true);
  assert.equal(restoreStepExplains(call, { ...change, after: [{ lane: 0, name: "Another hand edit" }] }, current), false);
  at(target.tracks, 1).takeLanes = [];
  const removed = new RestorePlanner(current).plan(SetDiff.between(current, target));
  assert.equal(removed.steps.length, 0);
  assert.ok(removed.skipped.some((reason) => reason.includes("restore this structure in Live")));
});

test("restoring missing take lanes creates them before their MIDI clips and keeps existing takes", async () => {
  const { live, song, lyrics, reader } = await rig();
  live.edit((set) => {
    const original = { ...TestSets.clip(1, "Original bass", 0, 4, [{ pitch: 48, start: 0, duration: 2, velocity: 80 }]),
      ref: { track: { index: 1 }, lane: 0, start: 0 } };
    at(set.tracks, 1).takeLanes = [{ lane: 0, name: "Original take", clips: [original] }];
  });
  const current = await reader.read();
  const target = structuredClone(current);
  const clip = { ...TestSets.clip(1, "Bass take", 0, 4, [{ pitch: 45, start: 0, duration: 1, velocity: 96 }]),
    ref: { track: { index: 1 }, lane: 1, start: 0 } };
  at(target.tracks, 1).takeLanes.push({ lane: 1, name: "Chosen take", clips: [clip] }, { lane: 2, name: "", clips: [] });
  const plan = new RestorePlanner(current).plan(SetDiff.between(current, target).reverse());
  const creations = plan.steps.findIndex((step) => step.some((call) => call.op === "track_create_take_lane"));
  const clips = plan.steps.findIndex((step) => step.some((call) => call.op === "take_lane_create_midi_clip"));
  assert.ok(creations >= 0 && clips > creations);
  const result = await new RestoreRunner(live, song, lyrics, () => reader.read()).putBack(current, target);
  assert.deepEqual(result, { complete: true, skipped: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(at(live.snapshot().tracks, 1).takeLanes)), at(target.tracks, 1).takeLanes);
  assert.deepEqual(SetDiff.between(live.snapshot(), target), []);
});

test("a missing audio file blocks the restore before any missing take lane is created", () => {
  const current = TestSets.small();
  at(current.tracks, 1).kind = "audio";
  const target = structuredClone(current);
  const clip = { ...TestSets.clip(1, "Vocal take", 0, 4, []), kind: "audio" as const,
    ref: { track: { index: 1 }, lane: 0, start: 0 }, filePath: "/missing-ode-test-audio.wav", warping: false, warpMode: 0, warpMarkers: [] };
  at(target.tracks, 1).takeLanes = [{ lane: 0, name: "Vocal take", clips: [clip] }];
  const plan = new RestorePlanner(current).plan(SetDiff.between(current, target));
  assert.ok(plan.blocked?.some((reason) => reason.includes("audio file is missing")));
  assert.deepEqual(plan.steps, []);
});

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
  const unused = { songId: "night-bus", analysis: { lines: [], scheme: [], notes: [] }, revision: 0, strictRhymes: [] };
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
