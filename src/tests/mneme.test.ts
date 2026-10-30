import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { Mneme } from "../mneme/artist";
import { userPaths } from "../mneme/paths";
import defaults from "../shared/defaults.json";

async function memory(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ode-mneme-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = userPaths(root);
  await mkdir(paths.artist, { recursive: true });
  return { paths, mneme: new Mneme(paths, defaults.memory) };
}

test("legacy facts and habit counts remain readable with artist preference defaults", async (t) => {
  const { paths, mneme } = await memory(t);
  const updated = new Date().toISOString();
  await writeFile(join(paths.artist, "facts.json"), JSON.stringify([
    { id: "old", topic: "vocal colour", value: "dry and close", source: "said", confidence: 1, evidence: [{ song: "First song", note: "Artist asked", time: updated }], updated },
  ]));
  await writeFile(join(paths.artist, "habits.json"), JSON.stringify([{ name: "open endings", kept: 3, rejected: 1, updated }]));
  const [fact] = await mneme.recall();
  assert.equal(fact?.id, "old");
  assert.equal(fact?.scope, "artist");
  assert.equal(fact?.kind, "preference");
  assert.equal(fact?.evidence[0]?.song, "First song");
  assert.ok((await mneme.habitStrengths())[0]!.outcomes > 3.99);
  assert.equal(JSON.parse(await readFile(join(paths.artist, "facts.json"), "utf8"))[0].id, "old");
});

test("song recall isolates song choices while keeping enduring preferences and free topics", async (t) => {
  const { mneme } = await memory(t);
  const artist = await mneme.record({ topic: "weather inside the drum sound", value: "rough", source: "said" });
  const local = await mneme.record({ scope: "song", songId: "a", context: "verse", topic: "weather inside the drum sound", value: "rough", source: "noticed", evidence: { note: "Artist used rough drums", authorship: "artist" } });
  const other = await mneme.record({ scope: "song", songId: "b", topic: "weather inside the drum sound", value: "rough", source: "said" });
  const alternate = await mneme.record({ scope: "song", songId: "a", context: "chorus", topic: "weather inside the drum sound", value: "rough", source: "said" });
  assert.equal(new Set([artist.id, local.id, other.id, alternate.id]).size, 4);
  assert.deepEqual((await mneme.recall("weather", { songId: "a" })).map((fact) => fact.id), [alternate.id, local.id, artist.id]);
  assert.equal((await mneme.recall(undefined, { songId: "a", includeOtherSongs: true })).length, 4);
  await assert.rejects(mneme.record({ scope: "song", topic: "x", value: "y", source: "said" }), /songId/);
});

test("explicit corrections replace one record and noticed claims cannot overwrite said preferences", async (t) => {
  const { mneme } = await memory(t);
  const original = await mneme.record({ topic: "rhyme", value: "perfect", source: "said", evidence: { note: "Earlier request", exchangeId: "one" } });
  const corrected = await mneme.record({ id: original.id, topic: "rhyme", value: "slant", source: "said", evidence: { note: "Artist corrected that preference", exchangeId: "two" } });
  assert.equal(corrected.id, original.id);
  assert.equal(corrected.evidence.length, 2);
  assert.deepEqual((await mneme.recall()).map((fact) => fact.value), ["slant"]);
  await assert.rejects(mneme.record({ id: original.id, topic: "rhyme", value: "perfect", source: "noticed", evidence: { note: "One draft rhymes perfectly", authorship: "artist" } }), /said|explicit/i);
  await assert.rejects(mneme.record({ id: "missing", topic: "x", value: "y", source: "said" }), /not found|unknown/i);
  assert.equal((await mneme.recall())[0]?.value, "slant");
  const inferred = await mneme.record({ scope: "song", songId: "a", kind: "material", context: "verse", topic: "motif", value: "rising", source: "noticed", confidence: 0.8, evidence: { note: "Read the MIDI", authorship: "artist" } });
  const revised = await mneme.record({ id: inferred.id, topic: "motif", value: "falling", source: "noticed", confidence: 0.2, evidence: { note: "Read the MIDI", authorship: "artist" } });
  assert.deepEqual([revised.scope, revised.kind, revised.songId, revised.context, revised.confidence], ["song", "material", "a", "verse", 0.2]);
  const lessCertain = await mneme.record({ id: revised.id, topic: "motif", value: "falling", source: "noticed", confidence: 0.1, evidence: { note: "Read the MIDI", authorship: "artist" } });
  assert.equal(lessCertain.confidence, 0.1);
  const promoted = await mneme.record({ id: revised.id, scope: "artist", topic: "motif", value: "falling", source: "noticed", evidence: { note: "Checked across songs", authorship: "artist" } });
  assert.equal(promoted.songId, undefined);
  assert.equal(promoted.kind, "material");
  const cleared = await mneme.record({ id: revised.id, context: null, topic: "motif", value: "falling", source: "noticed", evidence: { note: "No longer tied to a verse", authorship: "artist" } });
  assert.equal(cleared.context, undefined);
  assert.equal((await mneme.recall("motif"))[0]?.context, undefined);
});

test("preference inferences require evidence and cannot turn Ode material into artist voice", async (t) => {
  const { mneme } = await memory(t);
  await assert.rejects(mneme.record({ topic: "images", value: "rain", source: "noticed" }), /evidence|note/i);
  await assert.rejects(mneme.record({ topic: "images", value: "rain", source: "noticed", evidence: { note: "  " } }), /evidence|note/i);
  await assert.rejects(mneme.record({ topic: "images", value: "rain", source: "noticed", evidence: { note: "Generated draft", authorship: "ode" } }), /Ode|authored/i);
  const tentative = await mneme.record({ topic: "images", value: "rain", source: "noticed", confidence: 1, evidence: { note: "Joint draft", authorship: "mixed", toolCallId: "tool-1" } });
  assert.ok(tentative.confidence <= 0.5);
  assert.equal(tentative.evidence[0]?.authorship, "mixed");
  const material = await mneme.record({ kind: "material", topic: "used lines", value: "rain on the windows", source: "noticed", evidence: { note: "Generated chorus", authorship: "ode", exchangeId: "draft-1" } });
  assert.equal((await mneme.recall(undefined, { kind: "material" }))[0]?.id, material.id);
});

test("duplicate evidence does not refresh stale inferred confidence", async (t) => {
  const { paths, mneme } = await memory(t);
  const updated = new Date(Date.now() - 180 * 86_400_000).toISOString();
  await writeFile(join(paths.artist, "facts.json"), JSON.stringify([
    { id: "stale", scope: "artist", kind: "preference", topic: "rhythm", value: "loose", source: "noticed", confidence: 0.8, evidence: [{ note: "Loose take", authorship: "artist", exchangeId: "take-1", toolCallId: "memory-1", time: updated }], updated },
  ]));
  const repeated = await mneme.record({ topic: " rhythm ", value: " loose ", source: "noticed", confidence: 1, evidence: { note: "Loose take", authorship: "artist", exchangeId: "take-1", toolCallId: "memory-2" } });
  assert.equal(repeated.updated, updated);
  assert.equal(repeated.evidence.length, 1);
  assert.equal(repeated.evidence[0]?.toolCallId, "memory-1");
  assert.ok((await mneme.recall())[0]!.confidence <= 0.4);
});

test("feedback is idempotent within its song and context and retains legacy counts", async (t) => {
  const { paths, mneme } = await memory(t);
  const updated = new Date().toISOString();
  await writeFile(join(paths.artist, "habits.json"), JSON.stringify([{ name: "space", kept: 3, rejected: 1, updated }]));
  const first = await mneme.noteOutcome("space", true, { songId: "a", context: "chorus", exchangeId: "accepted-1", note: "Keep the pause" });
  const repeated = await mneme.noteOutcome("space", true, { songId: "a", context: "chorus", exchangeId: "accepted-1" });
  assert.equal(repeated.kept, first.kept);
  assert.equal(repeated.updated, first.updated);
  await mneme.noteOutcome("space", false, { songId: "b", exchangeId: "accepted-1" });
  await mneme.noteOutcome("space", false, { songId: "a", context: "verse", exchangeId: "accepted-1" });
  const scoped = await mneme.habitStrengths({ songId: "a" });
  assert.equal(scoped.length, 3);
  assert.ok(scoped.find((habit) => habit.scope === "artist")!.outcomes > 3.99);
  assert.ok(scoped.some((habit) => habit.songId === "a" && habit.context === "chorus"));
  assert.ok(!scoped.some((habit) => habit.songId === "b"));
  assert.equal((await mneme.habitStrengths({ songId: "a", includeOtherSongs: true })).length, 4);
});

test("facts and provenance persist while all remembered lyrics remain available for comparison", async (t) => {
  const { paths, mneme } = await memory(t);
  await mneme.record({ scope: "song", songId: "a", kind: "material", topic: "used chorus", value: "A borrowed moon", context: "Ode draft", source: "noticed", evidence: { note: "Avoid repeating this idea", authorship: "ode", toolCallId: "draft-3" } });
  await mneme.noteOutcome("restrained drums", true, { exchangeId: "feedback-1" });
  await mneme.rememberSong({ songId: "a", title: "First", lyrics: ["A borrowed moon"] });
  await mneme.rememberSong({ songId: "b", title: "Second", lyrics: ["An imported line"] });
  const reopened = new Mneme(paths, defaults.memory);
  const [fact] = await reopened.recall(undefined, { songId: "a" });
  assert.equal(fact?.context, "Ode draft");
  assert.equal(fact?.evidence[0]?.toolCallId, "draft-3");
  assert.deepEqual(await reopened.pastLyrics("a"), ["An imported line"]);
  assert.deepEqual(await reopened.pastLyrics("b"), ["A borrowed moon"]);
  assert.equal((await reopened.noteOutcome("restrained drums", true, { exchangeId: "feedback-1" })).kept, 1);
});


test("cancelled queued memory writes leave facts and feedback unchanged", async (t) => {
  const { mneme } = await memory(t);
  const controller = new AbortController();
  const first = mneme.record({ topic: "drums", value: "sparse", source: "said" });
  const cancelled = mneme.record({ topic: "drums", value: "dense", source: "said" }, controller.signal);
  controller.abort();
  const refused = assert.rejects(cancelled, { name: "AbortError" });
  const saved = await first;
  await refused;
  await assert.rejects(mneme.forget(saved.id, controller.signal), { name: "AbortError" });
  await assert.rejects(mneme.noteOutcome("dense drums", true, { exchangeId: "cancelled", signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual((await mneme.recall()).map((fact) => fact.value), ["sparse"]);
  assert.deepEqual(await mneme.habitStrengths(), []);
});
