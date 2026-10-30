import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { Mneme } from "../mneme/artist";
import { userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore } from "../mneme/song-store";
import { ContextSummary } from "../mneme/summary";
import { OdeConfig } from "../shared/config";
import { Mode } from "../shared/personalisation";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import { OdeSession, type SessionDeps } from "../harness/session";
import type { ToolGate } from "../harness/loop";
import { Decision } from "../harness/approvals";
import type { ConversationLog } from "../mneme/conversations";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ode-memory-context-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = new OdeConfig(root, join(root, "temp")), paths = userPaths(root);
  const song = new SongStore(paths, () => undefined);
  const first = await song.create("First");
  const mneme = new Mneme(paths, config.memory);
  const prefs = new PreferencesStore(join(paths.preferences, "preferences.json"));
  const registry = new ToolRegistry({ config, song, mneme,
    live: { extension: { call: async () => { throw new Error("This check must not call Live."); } } },
  } as unknown as ToolContext);
  return { config, song, first, mneme, prefs, registry, summary: new ContextSummary(mneme, song, prefs, config.memory) };
}

test("memory tools bind local choices and evidence to the current song and accepted exchange", async (t) => {
  const { registry, song, first } = await fixture(t);
  const saved = await registry.run("memory_record", { topic: "rhyme", value: "Keep this verse unrhymed", source: "said", evidence: "No rhymes in this verse", context: "Verse 1" }, undefined,
    { exchangeId: "exchange-1", toolCallId: "call-1" });
  assert.equal(saved.ok, true, saved.text);
  const fact = JSON.parse(saved.text);
  assert.equal(fact.scope, "song");
  assert.equal(fact.songId, first.id);
  assert.equal(fact.evidence[0].exchangeId, "exchange-1");
  await song.create("Second");
  const current = JSON.parse((await registry.run("memory_recall", {})).text);
  assert.deepEqual(current.facts, []);
  const history = JSON.parse((await registry.run("memory_recall", { includeOtherSongs: true })).text);
  assert.equal(history.facts[0].id, fact.id);
});

test("request summaries favour relevant memories and keep song-local preferences out of other songs", async (t) => {
  const { mneme, summary, song, first, config, prefs } = await fixture(t);
  await mneme.record({ topic: "rhyme", value: "Prefer near rhymes", source: "said" });
  await mneme.record({ topic: "drums", value: "Prefer sparse drums", source: "said" });
  await mneme.record({ topic: "rhyme", value: "This verse has no rhyme", source: "said", scope: "song", songId: first.id });
  const one = new ContextSummary(mneme, song, prefs, { ...config.memory, summaryFacts: 1 });
  const text = await one.build("rhyme in this verse");
  assert.match(text, /This verse has no rhyme/);
  assert.doesNotMatch(text, /Prefer sparse drums/);
  await song.create("Second");
  assert.doesNotMatch(await summary.build("rhyme"), /This verse has no rhyme/);
});

test("repertoire is available as past work without becoming an artist preference", async (t) => {
  const { registry, song } = await fixture(t);
  const saved = await registry.run("memory_record", { kind: "material", topic: "drum groove", value: "A sparse half-time groove with a tom pickup", source: "noticed", evidence: "Inspected the chorus MIDI notes", authorship: "ode" });
  assert.equal(saved.ok, true, saved.text);
  await song.create("Second");
  const result = JSON.parse((await registry.run("memory_recall", { kind: "material", includeOtherSongs: true })).text);
  assert.equal(result.facts[0].kind, "material");
  assert.equal(result.facts[0].evidence[0].authorship, "ode");
});

test("artist memory can be maintained in Manual mode while musical changes still wait", async (t) => {
  const { registry } = await fixture(t);
  let approvals = 0;
  const session = new OdeSession({ prefs: { mode: async () => Mode.Manual }, deletions: { cantBeUndone: async () => false },
    snapshots: { read: async () => ({}) }, approvals: { request: async () => { approvals++; return Decision.Deny; } }, labels: { for: () => "change" },
  } as unknown as SessionDeps, { id: "song" } as ConversationLog);
  const { gate } = session as unknown as { gate: ToolGate };
  assert.equal(await gate.check(registry.find("memory_record")!, {}, new AbortController().signal), null);
  assert.equal(approvals, 0);
  assert.notEqual(await gate.check(registry.find("track_set")!, {}, new AbortController().signal), null);
  assert.equal(approvals, 1);
});

test("memory evidence and feedback remain readable through complete pages as the database grows", async (t) => {
  const { registry, mneme } = await fixture(t);
  const entry = { topic: "drums", value: "Sparse drum phrasing", source: "noticed" as const };
  const first = await mneme.record({ ...entry, evidence: { note: "First observed recording", authorship: "artist" } });
  for (let index = 0; index < 31; index++) {
    await mneme.record({ ...entry, id: first.id, evidence: { note: `${index}: ${"e".repeat(1950)}`, authorship: "artist" } });
  }
  const found = await registry.run("memory_recall", { topic: "drums", limit: 1 });
  assert.equal(found.ok, true, found.text);
  assert.equal(JSON.parse(found.text).facts[0].evidenceTotal, 32);
  const tail = JSON.parse((await registry.run("memory_recall", { id: first.id, evidenceOffset: 30, evidenceLimit: 2 })).text);
  assert.equal(tail.facts[0].evidence.length, 2);
  assert.match(tail.facts[0].evidence[1].note, /^30:/);
  for (let index = 0; index < 4; index++) await mneme.noteOutcome(`choice ${index}`, true, { exchangeId: `feedback-${index}` });
  const feedback = JSON.parse((await registry.run("memory_recall", { detail: "feedback", limit: 2 })).text);
  assert.equal(feedback.habits.length, 2);
  const rest = JSON.parse((await registry.run("memory_recall", { detail: "feedback", offset: feedback.nextOffset, limit: 2 })).text);
  assert.equal(new Set([...feedback.habits, ...rest.habits].map((habit) => habit.name)).size, 4);
});

test("long project notes cannot hide locks and effective settings from the request summary", async (t) => {
  const { song, summary } = await fixture(t);
  await song.update({ intent: { story: "s".repeat(1100) }, notes: Array.from({ length: 5 }, () => "n".repeat(180)), locked: ["Keep vocal intact"] });
  const text = await summary.build("drums");
  assert.match(text, /Keep vocal intact/);
  assert.match(text, /Settings:/);
  assert.ok(text.length <= 2000);
});
