import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MidiNoteOperations } from "../live/extension/ops/midi-notes";
import { ReferenceResolver } from "../live/extension/refs";
import { Describer } from "../live/extension/describe";
import type { Live } from "../live/extension/sdk";
import { LyricsStore } from "../mneme/lyrics-store";
import { userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore, SongVersions } from "../mneme/song-store";
import { SnapshotReader } from "../server/snapshot-reader";
import { VersionRecorder } from "../server/version-recorder";
import { VersionActions } from "../server/version-actions";
import { RestoreRunner } from "../server/restore-runner";
import { RequestContext, type RequestContextDeps } from "../server/request-context";
import type { SessionManager } from "../harness/session-manager";
import { VersionAuthor } from "../shared/versions";
import { FakeLive } from "./fake-live";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

async function rig() {
  const paths = userPaths(await mkdtemp(join(tmpdir(), "ode-scoped-recovery-")));
  const song = new SongStore(paths, () => undefined);
  await song.create("Night Bus");
  const lyrics = new LyricsStore(song, new PreferencesStore(join(paths.preferences, "preferences.json")), () => undefined);
  const live = new FakeSetLive(TestSets.small());
  const versions = new SongVersions(song, 20);
  const recorder = new VersionRecorder(new SnapshotReader(live, song), versions, () => undefined);
  return { song, lyrics, live, versions, recorder };
}

test("MIDI receipts bind to the native clip and refuse changed notes or a restarted extension", async () => {
  const fake = new FakeLive();
  const clip = fake.midiClip("Hook", 0);
  Object.defineProperty(clip, "notes", { value: [{ pitch: 60, startTime: 0, duration: 1 }], writable: true });
  fake.midiTrack("Voice", [clip]);
  const set = fake.liveSet();
  const services = { live: {} as Live, set, refs: new ReferenceResolver(set), describe: new Describer(set) };
  const operations = new MidiNoteOperations(services).table();
  const followUps = { after: async <T, R>(started: Promise<T>, apply: (value: T) => R) => apply(await started) };
  const ref = { track: { index: 0 }, start: 0 };
  const written = await operations.midi_clip_set_notes.prepare({ clip: ref, notes: [{ pitch: 64, start: 0, duration: 1 }] }, followUps)();
  const receipt = written.__odeReceipts?.[0];
  assert.ok(receipt?.kind === "midi-notes");
  assert.equal(receipt.before[0]?.pitch, 60);
  await operations.midi_clip_set_notes.prepare({ clip: ref, notes: receipt.before, expected: { token: receipt.token, notes: receipt.after } }, followUps)();
  assert.equal((clip as unknown as { notes: { pitch: number }[] }).notes[0]?.pitch, 60);
  const second = await operations.midi_clip_set_notes.prepare({ clip: ref, notes: [{ pitch: 64, start: 0, duration: 1 }] }, followUps)();
  const currentReceipt = second.__odeReceipts?.[0];
  assert.ok(currentReceipt?.kind === "midi-notes");
  Object.assign(clip, { notes: [{ pitch: 67, startTime: 0, duration: 1 }] });
  await assert.rejects(operations.midi_clip_set_notes.prepare({ clip: ref, notes: currentReceipt.before, expected: { token: currentReceipt.token, notes: currentReceipt.after } }, followUps)(), /kept/);
  assert.equal((clip as unknown as { notes: { pitch: number }[] }).notes[0]?.pitch, 67);
  const restarted = new MidiNoteOperations(services).table();
  await assert.rejects(restarted.midi_clip_get_notes.prepare({ clip: ref, recoveryToken: receipt.token }, followUps)(), /earlier Live session/);
});

test("scoped lyric Undo keeps simultaneous and later musician lines", async () => {
  const { lyrics } = await rig();
  const base = await lyrics.replace("[Verse]\none\ntwo\nthree");
  const written = await lyrics.write("[Verse]\nONE\ntwo\nTHREE", base.revision, VersionAuthor.Ode);
  assert.ok(written.receipt?.kind === "lyrics");
  await lyrics.write("[Verse]\nMine\nTwo\nTHREE", written.revision, VersionAuthor.Musician);
  const restored = await lyrics.revert(written.receipt);
  assert.equal(restored.text, "[Verse]\nMine\nTwo\nthree");
  assert.deepEqual(restored.conflicts, [2]);
});

test("sheet receipts preserve unrelated changes and refuse overlapping changes", async () => {
  const { song } = await rig();
  const written = await song.updateWithReceipt({ title: "Last Bus" });
  const receipt = written.__odeReceipts[0];
  assert.ok(receipt?.kind === "sheet-fields");
  await song.update({ notes: ["Keep the breath"] });
  await song.restoreFields(receipt.after, receipt.before, receipt.songId);
  assert.equal((await song.read()).title, "Night Bus");
  assert.deepEqual((await song.read()).notes, ["Keep the breath"]);
  await song.update({ title: "My title" });
  await assert.rejects(song.restoreFields(receipt.after, receipt.before, receipt.songId), /kept/);
  assert.equal((await song.read()).title, "My title");
});

test("request-period hand edits remain observed and scoped Undo preserves them", async () => {
  const { song, lyrics, live, versions, recorder } = await rig();
  const base = await lyrics.replace("[Verse]\nOriginal line");
  await recorder.handEdits();
  const written = await lyrics.write("[Verse]\nOde line", base.revision, VersionAuthor.Ode);
  assert.ok(written.receipt);
  live.edit((set) => { set.tracks[0]!.mute = true; });
  const recorded = await recorder.odeChange("Changed a lyric", "change the lyric", [written.receipt]);
  assert.equal(recorded.version?.author, VersionAuthor.Observed);
  assert.ok(recorded.version?.recovery?.receipts.length);
  const sessions = { current: { exclusive: async <T>(work: (signal: AbortSignal) => Promise<T>) => work(new AbortController().signal) } } as unknown as SessionManager;
  const actions = new VersionActions({ live, song, lyrics, versions, recorder, sessions, selection: { refresh: async () => undefined }, emit: () => undefined });
  assert.equal((await actions.undo(recorded.version!.id)).restored, true);
  assert.equal((await lyrics.read()).text, base.text);
  assert.equal(live.snapshot().tracks[0]?.mute, true);
  await assert.rejects(actions.undo(recorded.version!.id), /automatic Undo/);
});

test("explicit restore merges lyrics typed while asynchronous host work applies", async () => {
  const { song, lyrics, live, recorder } = await rig();
  await lyrics.replace("[Verse]\nOriginal line");
  const target = await recorder.readCurrent();
  const written = await lyrics.write("[Verse]\nOde line", (await lyrics.read()).revision, VersionAuthor.Ode);
  live.edit((set) => { set.song.tempo = 124; });
  const current = await recorder.readCurrent();
  const original = live.extension.call.bind(live.extension);
  live.extension.call = async <R>(op: string, args: unknown): Promise<R> => {
    if (op === "song_set_tempo") await lyrics.write("[Verse]\nMy late line", written.revision, VersionAuthor.Musician);
    return original<R>(op, args);
  };
  const restored = await new RestoreRunner(live, song, lyrics).putBack(current, target);
  assert.ok(restored.skipped.some((line) => line.includes("Later lyric edits were kept")));
  assert.equal((await lyrics.read()).text, "[Verse]\nMy late line");
});

test("a failed restart observation remains pending and recovers as observed before hand edits", async () => {
  const { song, live, versions, recorder } = await rig();
  await recorder.handEdits();
  live.edit((set) => { set.song.tempo = 124; });
  const original = live.extension.call.bind(live.extension);
  live.extension.call = async () => { throw new Error("Host disconnected"); };
  const deps = { song, recorder, emit: () => undefined } as unknown as RequestContextDeps;
  await new RequestContext(deps).recover(["Make the chorus brighter"]);
  live.extension.call = original;
  // A new context has no in-memory marker: recovery must find the durable one itself.
  await new RequestContext(deps).recover();
  const latest = (await versions.history.tail(1))[0];
  assert.equal(latest?.author, VersionAuthor.Observed);
  assert.equal(latest?.recovery?.unverified, true);
  const item = (await versions.history.items())[0];
  assert.equal(item?.scopedUndo, false);
  assert.equal("recovery" in item!, false);
  assert.equal((await recorder.handEdits()).version, null);
});

test("sheet absence survives receipt persistence and Undo removes a newly added optional plan", async () => {
  const { song, versions, recorder } = await rig();
  await recorder.handEdits();
  const written = await song.updateWithReceipt({ composition: { hooks: [], phrases: [], parts: [], notes: ["Keep this hook"] } });
  const recorded = await recorder.odeChange("Saved the musical plan", "Plan the song", written.__odeReceipts);
  assert.ok(recorded.version);
  const reloaded = new SongVersions(song, 20);
  const receipt = (await reloaded.history.get(recorded.version.id)).recovery?.receipts[0];
  assert.ok(receipt?.kind === "sheet-fields");
  assert.deepEqual(receipt.beforeAbsent, ["composition"]);
  await song.restoreFields(receipt.after, receipt.before, receipt.songId, receipt.afterAbsent, receipt.beforeAbsent);
  assert.equal((await song.read()).composition, undefined);
  assert.equal((await versions.history.items())[0]?.scopedUndo, true);
});

test("a musician line preserved inside an Ode lyric write is still observed as mixed authorship", async () => {
  const { lyrics, recorder } = await rig();
  const base = await lyrics.replace("[Verse]\none\ntwo");
  await recorder.handEdits();
  await lyrics.write("[Verse]\nMine\ntwo", base.revision, VersionAuthor.Musician);
  const written = await lyrics.write("[Verse]\none\nTWO", base.revision, VersionAuthor.Ode);
  assert.ok(written.receipt);
  assert.equal(written.text, "[Verse]\nMine\nTWO");
  const recorded = await recorder.odeChange("Changed line two", "Revise line two", [written.receipt]);
  assert.equal(recorded.version?.author, VersionAuthor.Observed);
  assert.equal(recorded.version?.recovery?.unverified, false);
});

test("an edit to a future restore target during an earlier step stops before it is overwritten", async () => {
  const { song, lyrics, live, recorder } = await rig();
  const current = await recorder.readCurrent();
  const target = structuredClone(current);
  target.tracks[2]!.devices[1]!.parameters[0]!.value = 200;
  target.song.tempo = 124;
  const original = live.extension.call.bind(live.extension);
  live.extension.call = async <R>(op: string, args: unknown): Promise<R> => {
    const result = await original<R>(op, args);
    if (op === "parameter_set") live.edit((set) => { set.song.tempo = 130; });
    return result;
  };
  const restored = await new RestoreRunner(live, song, lyrics, () => recorder.readCurrent()).putBack(current, target);
  assert.equal(restored.complete, false);
  assert.ok(restored.skipped.some((line) => line.includes("outside the restore step")));
  assert.equal(live.snapshot().song.tempo, 130);
  assert.equal(live.calls.some((call) => call.op === "song_set_tempo"), false);
});

test("failed Undo recording retains an observed-recovery marker across restart", async () => {
  const { song, lyrics, live, versions, recorder } = await rig();
  const base = await lyrics.replace("[Verse]\nOriginal");
  await recorder.handEdits();
  const written = await lyrics.write("[Verse]\nOde", base.revision, VersionAuthor.Ode);
  assert.ok(written.receipt);
  const version = await recorder.odeChange("Changed a line", "Change a line", [written.receipt]);
  const sessions = { current: { exclusive: async <T>(work: (signal: AbortSignal) => Promise<T>) => work(new AbortController().signal) } } as unknown as SessionManager;
  const actions = new VersionActions({ live, song, lyrics, versions, recorder, sessions, selection: { refresh: async () => undefined }, emit: () => undefined });
  const record = recorder.odeChange.bind(recorder);
  recorder.odeChange = async () => { throw new Error("Snapshot unavailable after inverse"); };
  await assert.rejects(actions.undo(version.version!.id), /Snapshot unavailable/);
  recorder.odeChange = record;
  await new RequestContext({ song, recorder, emit: () => undefined } as unknown as RequestContextDeps).recover();
  assert.equal((await versions.history.tail(1))[0]?.author, VersionAuthor.Observed);
  assert.equal((await recorder.handEdits()).version, null);
});

test("production context keeps the goal and step identities within its character budget", async () => {
  const task = { id: "task", revision: 2, status: "working", goal: "Finish the playable song", brief: "brief ".repeat(1000),
    steps: Array.from({ length: 24 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, action: "Arrange the current chorus ".repeat(40),
      status: index === 0 ? "working" : "pending", targetTags: ["voice", "bass"], evidence: Array.from({ length: 8 }, () =>
        ({ kind: "tool", exchangeId: "exchange", toolCallId: "call", summary: "Evidence-summary-must-stay-out ".repeat(40), targets: ["voice"] })) })) };
  const context = new RequestContext({ config: { memory: { mapMaxChars: 4000 } }, production: { read: async () => task } } as unknown as RequestContextDeps);
  const text = await (context as unknown as { productionPart(): Promise<string> }).productionPart();
  assert.ok(text.length <= 4000);
  assert.match(text, /Finish the playable song/);
  for (const step of task.steps) assert.ok(text.includes(step.id));
  assert.doesNotMatch(text, /Evidence-summary-must-stay-out/);
  assert.match(text, /production_task_read/);
});

test("fresh guarded History restore still completes normal device creation and setup", async () => {
  const { song, lyrics } = await rig();
  const live = new FakeSetLive(TestSets.small(), TestSets.liveDevices());
  const reader = new SnapshotReader(live, song);
  const current = await reader.read();
  const target = structuredClone(current);
  target.song.tempo = 124;
  target.tracks[1]!.devices.push(TestSets.device(target.tracks[1]!.devices.length, "EQ Eight", "Eq8", [TestSets.parameter(0, "1 Frequency A", 20, 20000, 200)]));
  const outcome = await new RestoreRunner(live, song, lyrics, () => reader.read()).putBack(current, target);
  assert.equal(outcome.complete, true, outcome.skipped.join("\n"));
  assert.equal(live.snapshot().song.tempo, 124);
  assert.equal(live.snapshot().tracks[1]?.devices.at(-1)?.parameters[0]?.value, 200);
});
