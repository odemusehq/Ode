import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConversationStore } from "../mneme/conversations";
import { userPaths } from "../mneme/paths";
import { ProductionEvidence } from "../mneme/production-evidence";
import { ProductionTaskStore } from "../mneme/production-task";
import { SongStore, SongVersions } from "../mneme/song-store";
import { ToolObservations } from "../mneme/tool-observations";
import type { ProductionStep } from "../shared/production-task";
import { VersionAuthor } from "../shared/versions";
import type { ToolContext } from "../tools/define";
import { productionTaskTools } from "../tools/song/production-task";
import { TestSets } from "./sets";

test("production evidence checks saved sources and target scope rather than invented citations or success flags", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-evidence-"));
  const song = new SongStore(userPaths(root), () => undefined);
  const first = await song.create("Night Bus");
  const conversations = new ConversationStore(join(root, "conversations"), 2);
  const log = conversations.log(first.id);
  const exchangeId = await log.begin("Keep chorus-lead exactly as sung");
  await log.finish(exchangeId, "The hook is perfect", "complete");
  const observations = new ToolObservations(song);
  await observations.record({ exchangeId, toolCallId: "read-hook", name: "midi_clip_get_notes", input: { clip: { tag: "chorus-lead" } }, ok: true, text: '{"notes":[]}' });
  await observations.record({ exchangeId, toolCallId: "failed", name: "midi_clip_set_notes", input: { clip: { tag: "chorus-lead" } }, ok: false, text: "Clip missing" });
  await observations.record({ exchangeId, toolCallId: "bookkeeping", name: "production_task_read", input: {}, targets: ["chorus-lead"], ok: true, text: "{}" });
  const versions = new SongVersions(song, 10);
  const verify = new ProductionEvidence({ song, observations, versions, conversations }).verify;
  const step: ProductionStep = { id: randomUUID(), action: "Inspect the chorus", status: "complete", targetTags: ["chorus-lead"], evidence: [] };
  const citation = { kind: "tool" as const, exchangeId, toolCallId: "read-hook", summary: "Read current hook notes", targets: ["chorus-lead"] };
  assert.equal(await verify(citation, first.id, step), true);
  assert.equal(await verify({ ...citation, toolCallId: "invented" }, first.id, step), false);
  assert.equal(await verify({ ...citation, toolCallId: "failed" }, first.id, step), false);
  assert.equal(await verify({ ...citation, toolCallId: "bookkeeping" }, first.id, step), false);
  assert.equal(await verify(citation, first.id, { ...step, targetTags: ["bass"] }), false);
  const quote = { kind: "musician" as const, exchangeId, quote: "Keep chorus-lead exactly as sung", summary: "Retain the hook", targets: ["chorus-lead"] };
  assert.equal(await verify(quote, first.id, step), true);
  assert.equal(await verify({ ...quote, quote: "The hook is perfect" }, first.id, step), false);
  const before = TestSets.small();
  before.tracks[1]!.arrangementClips[0]!.tag = "chorus-lead";
  await versions.history.record(before, VersionAuthor.Musician, "Opened");
  const observed = structuredClone(before);
  observed.song.tempo = 121;
  const unowned = (await versions.history.record(observed, VersionAuthor.Observed, "Observed"))!;
  assert.equal(await verify({ kind: "version", versionId: unowned.id, summary: "A changed Set", targets: [] }, first.id, { ...step, targetTags: [] }), false);
  const after = structuredClone(observed);
  after.tracks[1]!.arrangementClips[0]!.notes![0]!.pitch = 46;
  const receipt = { kind: "midi-notes" as const, clip: { tag: "chorus-lead" }, token: "actual-object", before: before.tracks[1]!.arrangementClips[0]!.notes!, after: after.tracks[1]!.arrangementClips[0]!.notes! };
  const owned = (await versions.history.record(after, VersionAuthor.Observed, "Changed notes", undefined, { receipts: [receipt], unverified: false }))!;
  assert.equal(await verify({ kind: "version", versionId: owned.id, summary: "Wrote the hook notes", targets: ["chorus-lead"] }, first.id, step), true);
  const production = new ProductionTaskStore(song);
  const update = productionTaskTools.find((tool) => tool.name === "production_task_update")!;
  await update.run({ baseRevision: 0, goal: "Keep the hook", brief: "Retain the sung take", steps: [{ action: "Inspect the hook", status: "pending" }], exchangeId: "invented" }, { production, exchangeId, config: { limits: { toolResultMaxChars: 60000 } } } as unknown as ToolContext);
  assert.deepEqual((await production.read())?.exchangeIds, [exchangeId]);
  const pending = verify(citation, first.id, step);
  await song.create("Morning Train");
  assert.equal(await pending, true);
  assert.equal(await verify(citation, first.id, step), false);
});

test("a production step combines verified citation subsets while refusing forged or missing scope", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-evidence-union-"));
  try {
    const song = new SongStore(userPaths(root), () => undefined);
    const opened = await song.create("Rhythm section");
    const conversations = new ConversationStore(join(root, "conversations"), 2);
    const exchangeId = await conversations.log(opened.id).begin("Inspect bass and drums independently");
    const observations = new ToolObservations(song);
    for (const tag of ["bass", "drums"]) await observations.record({ exchangeId, toolCallId: `read-${tag}`, name: "track_get",
      input: { track: { tag } }, targets: [tag], ok: true, text: JSON.stringify({ tag, kind: "midi" }) });
    const verify = new ProductionEvidence({ song, observations, conversations, versions: new SongVersions(song, 10) }).verify;
    const store = new ProductionTaskStore(song, verify);
    const task = await store.update({ baseRevision: 0, goal: "Inspect the rhythm section", brief: "Independent reads, one combined checkpoint",
      steps: [{ action: "Inspect bass and drums", status: "working", targetTags: ["bass", "drums"] }] });
    const citations = ["bass", "drums"].map((tag) => ({ kind: "tool" as const, exchangeId, toolCallId: `read-${tag}`, summary: `Read ${tag}`, targets: [tag] }));
    const complete = (evidence: typeof citations) => store.update({ taskId: task.id, baseRevision: task.revision, goal: task.goal, brief: task.brief,
      steps: [{ ...task.steps[0]!, status: "complete", evidence }] });
    await assert.rejects(complete([{ ...citations[0]!, targets: ["bass", "drums"] }]), /evidence|verified|scope/i);
    await assert.rejects(complete([citations[0]!]), /target|cover|scope|evidence/i);
    await assert.rejects(complete(citations.map((citation) => ({ ...citation, targets: [] }))), /target|cover|scope|evidence/i);
    const finished = await complete(citations);
    assert.equal(finished.status, "complete");
    assert.deepEqual(finished.steps[0]!.evidence, citations);
  } finally { await rm(root, { recursive: true, force: true }); }
});
