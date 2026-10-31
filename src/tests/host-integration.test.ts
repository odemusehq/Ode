import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Chain } from "@ableton-extensions/sdk";
import { audioProvenance, LocalAudioFiles } from "../live/local-audio-files";
import { BrowserWindow } from "../live/extension/browser-window";
import { Describer } from "../live/extension/describe";
import { ReferenceResolver } from "../live/extension/refs";
import { SnapshotOperations } from "../live/extension/ops/snapshot";
import { UndoOperations } from "../live/extension/ops/undo";
import type { OperationTable, RegularOp } from "../live/extension/ops/operation";
import type { Live, Version } from "../live/extension/sdk";
import { TempFolder } from "../mneme/paths";
import { ProjectMap } from "../mneme/project-map";
import { SetDiff, SetWording } from "../mneme/set-diff";
import { RestorePlanner } from "../server/restore-planner";
import { RestoreRunner } from "../server/restore-runner";
import type { ChainSnapshot, DeviceSnapshot } from "../shared/set-snapshot";
import { FakeLive } from "./fake-live";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";
import { observedSetDependencies } from "../tools/daw/state/dependencies";

test("audio uploads preserve exact bytes and declared source without claiming current Live audio", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-audio-"));
  try {
    const temp = join(root, "temp");
    const files = new LocalAudioFiles(join(root, "storage"), temp);
    const bytes = Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    const record = await files.add({ name: "../Chorus mix.wav", bytes, purpose: "processed-bounce", source: "Main post-FX, musician export", range: { start: 16, end: 32 } });
    assert.equal(record.name, "Chorus mix.wav");
    assert.equal(record.currentness, "unknown");
    assert.equal(record.provenance, "user-supplied");
    assert.deepEqual(await files.search("chorus post-FX"), [record]);
    const opened = await files.open(record.id);
    assert.deepEqual(await readFile(opened.path), Buffer.from(bytes));
    assert.deepEqual(await audioProvenance(await new TempFolder(temp).inside(opened.path)), record);
    await writeFile(opened.path, "changed");
    await assert.rejects(audioProvenance(opened.path), /attached audio changed/);
    await assert.rejects(files.open("../outside"));
    await assert.rejects(files.add({ name: "key.txt", bytes, purpose: "library" }), /audio file/);
    await assert.rejects(files.add({ name: "spoof.wav", bytes: Uint8Array.from([1, 2, 3]), purpose: "library" }), /audio header/);
    await assert.rejects(files.search("", Number.NaN));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("main-lane references never select a surviving same-start take and meter stays unknown", () => {
  const fake = new FakeLive();
  const take = fake.midiClip("Take", 8);
  const track = fake.midiTrack("Voice");
  Object.assign(track, { takeLanes: [{ clips: [take] }] });
  const set = fake.liveSet();
  const refs = new ReferenceResolver(set);
  assert.throws(() => refs.clip({ track: { index: 0 }, start: 8 }), /not found/);
  assert.equal(refs.clip({ track: { index: 0 }, start: 8, lane: 0 }).clip, take);
  assert.equal(new Describer(set).signature(), null);
  Object.assign(set.song, { scenes: [{ signatureNumerator: 7, signatureDenominator: 8 }] });
  assert.equal(new Describer(set).signature(), null);
});

test("chain snapshots include volume, pan and send values", async () => {
  const set = new FakeLive().liveSet();
  const parameter = (name: string, value: number) => ({ name, min: 0, max: 1, defaultValue: 0, isQuantized: false, valueItems: [], getValue: async () => value });
  const chain = { devices: [], mixer: { volume: parameter("Volume", 0.25), panning: parameter("Pan", 0.4), sends: [parameter("Send A", 0.7)] } } as unknown as Chain<Version>;
  const operations = new SnapshotOperations({ live: {} as Live, set, refs: new ReferenceResolver(set), describe: new Describer(set) });
  const snapshot = await (operations as unknown as { chain(chain: Chain<Version>, index: number, rack: string): Promise<ChainSnapshot> }).chain(chain, 0, "Rack");
  assert.equal(snapshot.mixer?.volume.value, 0.25);
  assert.equal(snapshot.mixer?.panning.value, 0.4);
  assert.equal(snapshot.mixer?.sends[0]?.value, 0.7);
});

test("grouped creation reports its separate native setup transaction", async () => {
  let transactions = 0;
  const live = { withinTransaction: <T>(work: () => T): T => { transactions++; return work(); } } as Live;
  const table = {
    song_create_audio_track: { prepare: (_args: unknown, followUps: { after<T, R>(started: Promise<T>, apply: (value: T) => R): Promise<R> }) => () => followUps.after(Promise.resolve({ name: "" }), (track) => ({ ...track, name: "Voice" })) },
    track_set: { prepare: () => async () => ({ name: "Voice" }) },
  } as unknown as OperationTable<RegularOp>;
  const operation = new UndoOperations(live, table).table().apply_as_one_undo_step;
  const unusedFollowUps = { after: async <T, R>(started: Promise<T>, apply: (value: T) => R) => apply(await started) };
  const created = await operation.prepare({ calls: [{ op: "song_create_audio_track", args: {} }] }, unusedFollowUps)();
  assert.equal(created.nativeTransactions, 2);
  assert.equal(transactions, 2);
  transactions = 0;
  const changed = await operation.prepare({ calls: [{ op: "track_set", args: {} }] }, unusedFollowUps)();
  assert.equal(changed.nativeTransactions, 1);
  assert.equal(transactions, 1);
});

test("browser chat uses platform argv and refuses nonlocal destinations", () => {
  const url = "http://localhost:8787/?view=ask&token=example";
  assert.deepEqual(BrowserWindow.command(url, "darwin"), { file: "/usr/bin/open", args: [url] });
  assert.deepEqual(BrowserWindow.command(url, "win32"), { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] });
  assert.equal(BrowserWindow.command(url, "linux"), null);
  assert.throws(() => BrowserWindow.command("https://example.org"), /local browser page/);
});

test("nested chain mixer changes survive snapshot patches and Ode restore", async () => {
  const initial = TestSets.small();
  const mixer = structuredClone(initial.tracks[1]!.mixer);
  const inner: DeviceSnapshot = { index: 0, name: "Audio Effect Rack", className: "AudioEffectGroupDevice", isRack: true, parameters: [], chains: [{ index: 0, devices: [], mixer: structuredClone(mixer) }] };
  const outer: DeviceSnapshot = { ...structuredClone(inner), index: 1, chains: [{ index: 0, devices: [inner], mixer: structuredClone(mixer) }] };
  initial.tracks[1]!.devices.push(outer);
  const target = structuredClone(initial);
  const changed = target.tracks[1]!.devices[1]!.chains![0]!.devices[0]!.chains![0]!.mixer!;
  changed.volume.value = 0.25;
  changed.panning.value = -0.4;
  changed.sends[0]!.value = 0.7;
  const changes = SetDiff.between(initial, target);
  assert.equal(changes.length, 3);
  assert.ok(changes.every((change) => change.target.scope === "device" && change.target.index === -1 && JSON.stringify(change.target.chain) === "[1,0,0,0]"));
  assert.deepEqual(SetDiff.apply(initial, changes), target);
  const live = new FakeSetLive(initial);
  const runner = new RestoreRunner(live, { update: async () => TestSets.sheet() }, { replace: async () => { throw new Error("No lyrics changed"); } });
  assert.deepEqual(await runner.putBack(initial, target), { complete: true, skipped: [] });
  const restored = live.snapshot().tracks[1]!.devices[1]!.chains![0]!.devices[0]!.chains![0]!.mixer!;
  assert.deepEqual(restored, changed);
});

test("recreated supported rack chains restore their captured mixer values", async () => {
  const target = TestSets.small();
  const mixer = structuredClone(target.tracks[1]!.mixer);
  mixer.volume.value = 0.35;
  mixer.panning.value = 0.25;
  mixer.sends = [];
  const rack: DeviceSnapshot = { index: 1, name: "Audio Effect Rack", className: "AudioEffectGroupDevice", isRack: true, parameters: [], chains: [{ index: 0, devices: [], mixer }] };
  target.tracks[1]!.devices.push(rack);
  const current = structuredClone(target);
  current.tracks[1]!.devices.pop();
  const template = { ...structuredClone(rack), chains: [] };
  const live = new FakeSetLive(current, { "Audio Effect Rack": template });
  const runner = new RestoreRunner(live, { update: async () => TestSets.sheet() }, { replace: async () => { throw new Error("No lyrics changed"); } });
  assert.deepEqual(await runner.putBack(current, target), { complete: true, skipped: [] });
  const restored = live.snapshot().tracks[1]!.devices[1]!.chains![0]!.mixer!;
  assert.equal(restored.volume.value, 0.35);
  assert.equal(restored.panning.value, 0.25);
});

test("unsupported MIDI loop reconstruction blocks the whole destructive plan, including deleted tracks", () => {
  for (const edit of [
    (clip: ReturnType<typeof TestSets.clip>) => { clip.looping = true; clip.loopEnd = 4; clip.endMarker = 4; },
    (clip: ReturnType<typeof TestSets.clip>) => { clip.loopStart = 1; },
    (clip: ReturnType<typeof TestSets.clip>) => { clip.startMarker = 1; },
  ]) {
    const target = TestSets.small();
    edit(target.tracks[1]!.arrangementClips[0]!);
    const current = structuredClone(target);
    current.tracks[1]!.arrangementClips = [];
    const plan = new RestorePlanner(current).plan(SetDiff.between(current, target));
    assert.ok(plan.blocked?.some((reason) => reason.includes("MIDI markers")));
    assert.deepEqual(plan.steps, []);
    const deletedTrack = structuredClone(target);
    deletedTrack.tracks.splice(1, 1);
    const trackPlan = new RestorePlanner(deletedTrack).plan(SetDiff.between(deletedTrack, target));
    assert.ok(trackPlan.blocked?.length);
    const notesOnly = structuredClone(target);
    notesOnly.tracks[1]!.arrangementClips[0]!.notes = [];
    assert.equal(new RestorePlanner(notesOnly).plan(SetDiff.between(notesOnly, target)).blocked, undefined);
  }
});

test("unknown meter survives history patches and uses beat labels", () => {
  const before = TestSets.small();
  const after = structuredClone(before);
  after.signature = null;
  after.song.locators[1]!.time = 24;
  const changes = SetDiff.between(before, after);
  assert.equal(SetDiff.apply(before, changes).signature, null);
  assert.equal(SetWording.beatsPerBar(null), null);
  assert.equal(SetWording.bars(8, 16, null), "beats 8–16");
  const map = ProjectMap.encode(after, 10000);
  assert.match(map, /meter unknown/);
  assert.match(map, /Chorus at beat 24/);
  assert.match(map, /launch meter 4\/4/);
});

test("observed dependencies preserve containment without inventing send destinations", () => {
  const snapshot = TestSets.small();
  snapshot.tracks[1]!.groupTrack = 0;
  snapshot.tracks[0]!.devices[0]!.chains![0]!.devices.push(TestSets.device(0, "Utility", "StereoGain", []));
  const graph = observedSetDependencies(snapshot);
  assert.deepEqual({
    complete: graph.complete,
    group: graph.tracks[1]!.group,
    nestedDevice: graph.tracks[0]!.devices[1]!.device,
    sendDestination: graph.tracks[1]!.sendControls[0]!.destination,
  }, {
    complete: false,
    group: { index: 0 },
    nestedDevice: { track: { index: 0 }, chain: [0, 0], index: 0 },
    sendDestination: null,
  });
});
