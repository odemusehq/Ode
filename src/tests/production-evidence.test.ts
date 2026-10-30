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
import { ToolRegistry } from "../tools";
import { writeWav } from "../music/audio/wav";
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

test("partial mix observations cover only measured sources, including calls selected by name", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-mix-evidence-"));
  const song = new SongStore(userPaths(root), () => undefined);
  const created = await song.create("Night Bus");
  const conversations = new ConversationStore(join(root, "conversations"), 2);
  const exchangeId = await conversations.log(created.id).begin("Inspect the voice and lead");
  let renders = 0;
  const registry = new ToolRegistry({ live: { extension: { call: async (op: string) => {
    if (op === "song_get") return { tracks: [
      { index: 0, name: "Voice", tag: "voice", kind: "audio" },
      { index: 1, name: "Lead", tag: "lead", kind: "midi" },
    ], returnTracks: [] };
    assert.equal(op, "render_track_audio");
    const path = join(root, `capture-${renders++}.wav`);
    await writeWav(path, { sampleRate: 8000, channels: [Float32Array.from({ length: 4000 }, (_, i) => 0.1 * Math.sin(i))] });
    return { path };
  } } } } as unknown as ToolContext);
  const observations = new ToolObservations(song);
  const input = { tracks: [{ name: "Voice" }, { tag: "voice" }, { tag: "lead" }], start: 0, end: 16 };
  const result = await registry.run("mix_check", input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.targets, ["voice"]);
  const body = JSON.parse(result.text);
  assert.equal(body.status, "partial");
  assert.equal(body.tracks.length, 1);
  assert.equal(body.masking.length, 0);
  assert.match(body.skipped[0].reason, /duplicate reference/);
  assert.equal(body.tracks[0].source.frames, 4000);
  assert.match(body.tracks[0].source.sha256, /^[a-f0-9]{64}$/);
  await observations.record({ ...result, input: result.input, name: "mix_check", exchangeId, toolCallId: "partial" });
  // Legacy receipts inferred requested tags, and must not become proof of a measured source.
  await observations.record({ ...result, targets: undefined, input, name: "mix_check", exchangeId, toolCallId: "legacy" });
  const verify = new ProductionEvidence({ song, observations, conversations, versions: new SongVersions(song, 10), isRelevantTool: () => true }).verify;
  const step = { id: randomUUID(), action: "Measure a source", status: "complete" as const, evidence: [], targetTags: ["voice"] };
  const citation = { kind: "tool" as const, exchangeId, toolCallId: "partial", summary: "Measured source bytes", targets: ["voice"] };
  assert.equal(await verify(citation, created.id, step), true);
  assert.equal(await verify({ ...citation, targets: ["lead"] }, created.id, { ...step, targetTags: ["lead"] }), false);
  assert.equal(await verify({ ...citation, toolCallId: "legacy" }, created.id, step), false);
  const none = await registry.run("mix_check", { ...input, tracks: [{ tag: "lead" }] });
  assert.equal(none.ok, false);
  assert.match(none.text, /No requested source.*MIDI track/);
  assert.equal(none.targets, undefined);
  assert.equal(renders, 1);
});
