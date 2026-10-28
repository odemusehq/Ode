import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProjectMap } from "../mneme/project-map";
import { SetDiff } from "../mneme/set-diff";
import { VersionHistory } from "../mneme/version-history";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor } from "../shared/versions";
import { TestSets } from "./sets";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ode-versions-"));
}

const contents = TestSets.contents;

/** The small test Set after a musician's evening: notes, a mute, an EQ move, a new track, tempo and key. */
const at = TestSets.at;

function edited(): SetSnapshot {
  const set = TestSets.small();
  at(at(set.tracks, 1).arrangementClips, 0).notes = [45, 45, 52, 43].map((pitch, bar) => ({ pitch, start: bar * 4, duration: 1, velocity: 96 }));
  at(set.tracks, 0).mute = true;
  at(at(at(set.tracks, 2).devices, 1).parameters, 0).value = 200;
  set.tracks.push(TestSets.track(3, "Lead", [TestSets.device(0, "Drift", "Drift", [TestSets.parameter(0, "Filter Freq", 20, 20000, 1500)])], []));
  set.song.tempo = 124;
  set.song.rootNote = 0;
  set.song.scaleName = "Major";
  set.song.scaleIntervals = [0, 2, 4, 5, 7, 9, 11];
  return set;
}

test("the diff labels each change in plain words", () => {
  const labels = SetDiff.between(TestSets.small(), edited()).map((change) => change.label);
  assert.ok(labels.some((label) => label.startsWith("Bass · notes") && label.includes("3")), labels.join("\n"));
  assert.ok(labels.includes("Drums · muted"), labels.join("\n"));
  assert.ok(labels.some((label) => label.startsWith("Pad · EQ Eight") && label.includes("120 → 200")), labels.join("\n"));
  assert.ok(labels.includes("Lead · added"), labels.join("\n"));
  assert.ok(labels.includes("Song · tempo 120 → 124 BPM"), labels.join("\n"));
  assert.ok(labels.includes("Song · key A minor → C major"), labels.join("\n"));
});

test("the playhead, playing and the selection are not changes", () => {
  const moved = TestSets.small();
  moved.transport.playing = true;
  moved.transport.time = 37;
  moved.selection = { track: { index: 0 }, clip: null, scene: null, time: 37, isPlaying: true };
  assert.deepEqual(SetDiff.between(TestSets.small(), moved), []);
});

test("applying a diff gives the later Set", () => {
  const before = TestSets.small();
  const after = edited();
  at(after.tracks, 2).arrangementClips = [];
  after.song.locators.push({ index: 2, name: "Bridge", time: 64 });
  at(after.returnTracks, 0).devices = [];
  assert.deepEqual(contents(SetDiff.apply(before, SetDiff.between(before, after))), contents(after));
});

test("a lyric rewrite is a change that applies back", () => {
  const sheet = TestSets.sheet();
  const rewritten = structuredClone(sheet);
  at(at(rewritten.sections, 0).lines, 1).text = "I count the streetlights one by one";
  const before = { ...TestSets.small(), sheet };
  const after = { ...TestSets.small(), sheet: rewritten };
  const changes = SetDiff.between(before, after);
  assert.deepEqual(changes.map((change) => change.label), ["Lyrics · Verse 1 · line 2"]);
  assert.deepEqual(SetDiff.apply(before, changes).sheet, rewritten);
});

test("the history saves only real changes and rebuilds any version", async () => {
  const history = new VersionHistory(await tempDir(), 2);
  const base = await history.record(TestSets.small(), VersionAuthor.Musician, "Opened");
  assert.ok(base);
  assert.equal(base.changes.length, 0);
  assert.equal(await history.record(TestSets.small(), VersionAuthor.Musician, "Nothing"), null);

  const muted = TestSets.small();
  at(muted.tracks, 0).mute = true;
  const first = await history.record(muted, VersionAuthor.Musician, "You · 1 edit on Drums");
  const second = await history.record(edited(), VersionAuthor.Ode, "Lead added", "add a lead");
  assert.ok(first && second);
  assert.ok(first.id < second.id);

  assert.deepEqual(contents(await history.snapshotAt(first.id)), contents(muted));
  assert.deepEqual(contents(await history.snapshotAt(second.id)), contents(edited()));
  assert.deepEqual((await history.items()).map((item) => item.id), [second.id, first.id, base.id]);
  assert.equal((await history.name(first.id, "Drums parked")).name, "Drums parked");

  await history.truncateAfter(first.id);
  assert.deepEqual((await history.list()).map((version) => version.id), [base.id, first.id]);
  assert.deepEqual(contents((await history.latest()) as SetSnapshot), contents(muted));
});

test("the history keeps a full snapshot every few versions", async () => {
  const dir = await tempDir();
  const history = new VersionHistory(dir, 2);
  for (const tempo of [120, 121, 122, 123, 124]) {
    const set = TestSets.small();
    set.song.tempo = tempo;
    await history.record(set, VersionAuthor.Musician, `tempo ${tempo}`);
  }
  const snapshots = await readdir(join(dir, "snapshots"));
  assert.ok(snapshots.length >= 2 && snapshots.length <= 3, snapshots.join(", "));
});

// Review Focus 1: a big Set fits the map, with every track named.

test("the map of a big Set drops detail to fit its limit and still names every track", () => {
  const set = TestSets.large(120, 400);
  assert.doesNotMatch(ProjectMap.encode(set, 24000), /read tools/);
  const map = ProjectMap.encode(set, 8000);
  assert.ok(map.length <= 8000, `${map.length} characters`);
  for (const track of set.tracks) assert.ok(map.includes(`${track.name}:`), track.name);
  assert.match(map, /read tools/);
});
