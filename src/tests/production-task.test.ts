import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProductionTaskStore } from "../mneme/production-task";
import { userPaths } from "../mneme/paths";
import { SongStore } from "../mneme/song-store";
import { productionTaskTools } from "../tools/song/production-task";
import type { ToolContext } from "../tools/define";

test("production checkpoints survive interruption, reject stale or unsupported completion and retain replaced work", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-production-"));
  const song = new SongStore(userPaths(root), () => undefined);
  const first = await song.create("Night Bus");
  const firstDir = song.dataDir;
  const verified = { kind: "tool" as const, exchangeId: "exchange-1", toolCallId: "read-hook-1", summary: "The tagged chorus clip contains the retained hook.", targets: ["chorus-lead"] };
  const store = new ProductionTaskStore(song, async (evidence, songId) => evidence.kind === "tool" && evidence.toolCallId === verified.toolCallId && songId === first.id);
  const started = await store.update({ baseRevision: 0, goal: "Finish the chorus", brief: "Keep the sung hook", steps: [{ action: "Place the hook", status: "working", targetTags: ["chorus-lead"] }] });
  const step = started.steps[0]!;
  assert.equal(started.revision, 1);
  assert.equal((await new ProductionTaskStore(song).read())?.id, started.id);
  await assert.rejects(store.update({ taskId: started.id, baseRevision: 0, goal: started.goal, brief: started.brief, steps: started.steps }), /revision/i);
  const interrupted = (await store.recover())!;
  assert.equal(interrupted.status, "needs-inspection");
  assert.equal(interrupted.steps[0]?.status, "needs-inspection");
  const finishing = { taskId: started.id, baseRevision: interrupted.revision, goal: started.goal, brief: started.brief, steps: [{ ...step, status: "complete" as const, evidence: [] }] };
  await assert.rejects(store.update(finishing), /evidence/i);
  await assert.rejects(store.update({ ...finishing, steps: [{ ...finishing.steps[0]!, evidence: [{ ...verified, toolCallId: "invented" }] }] }), /verified|evidence/i);
  const finished = await store.update({ ...finishing, steps: [{ ...finishing.steps[0]!, evidence: [verified] }] });
  assert.equal(finished.status, "complete");
  const completed = { taskId: finished.id, baseRevision: finished.revision, goal: finished.goal, brief: finished.brief, steps: finished.steps };
  await assert.rejects(store.update({ ...completed, blocker: "The musician still needs to export it" }), /blocker/i);
  await assert.rejects(store.update({ ...completed, steps: [{ ...finished.steps[0]!, blocker: "Still waiting for a vocal" }] }), /blocker/i);
  const next = await store.update({ taskId: finished.id, baseRevision: finished.revision, replace: true, goal: "Arrange the bridge", brief: "Answer the chorus", steps: [{ action: "Read the bridge", status: "pending" }] });
  assert.notEqual(next.id, started.id);
  const archived = JSON.parse(await readFile(join(firstDir, "production-tasks", `${started.id}.json`), "utf8"));
  assert.equal(archived.goal, "Finish the chorus");
  assert.equal(archived.status, "complete");
  let inspecting!: () => void;
  let inspected!: () => void;
  const entered = new Promise<void>((resolve) => { inspecting = resolve; });
  const observed = new Promise<void>((resolve) => { inspected = resolve; });
  const delayed = new ProductionTaskStore(song, async () => { inspecting(); await observed; return true; });
  const pending = delayed.update({ taskId: next.id, baseRevision: next.revision, goal: next.goal, brief: next.brief, steps: [{ ...next.steps[0]!, status: "complete", evidence: [verified] }] });
  await entered;
  await song.create("Morning Train");
  inspected();
  await pending;
  assert.equal(await store.read(), null);
  await song.open(first.id);
  assert.equal((await store.read())?.id, next.id);
  assert.equal((await store.read())?.status, "complete");
});

test("focused task patches preserve untouched work and normal updates cannot erase unfinished steps", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-production-"));
  try {
    const store = new ProductionTaskStore({ songId: "song", dataDir: root }, async (evidence) => evidence.summary === "verified");
    const task = await store.update({ baseRevision: 0, goal: "Arrange bass and drums", brief: "Both parts remain required", steps: [
      { action: "Arrange bass", status: "pending" }, { action: "Arrange drums", status: "pending" },
    ] });
    const evidence = { kind: "musician" as const, exchangeId: "exchange", quote: "Keep bass", summary: "verified", targets: [] };
    await assert.rejects(store.update({ taskId: task.id, baseRevision: task.revision, goal: task.goal, brief: task.brief,
      steps: [{ ...task.steps[0]!, status: "complete", evidence: [evidence] }] }), /unfinished.*omit|unfinished.*retain|unfinished.*keep/i);
    const patched = await store.patch({ taskId: task.id, baseRevision: task.revision,
      steps: [{ id: task.steps[0]!.id, status: "complete", evidence: [evidence] }] });
    assert.deepEqual(patched.steps[1], task.steps[1]);
    assert.notEqual(patched.status, "complete");
    await assert.rejects(store.patch({ taskId: task.id, baseRevision: task.revision, brief: "Old revision" }), /revision/);
    await assert.rejects(store.patch({ taskId: task.id, baseRevision: patched.revision,
      steps: [{ id: task.steps[1]!.id, status: "complete", evidence: [{ ...evidence, summary: "not verified" }] }] }), /evidence/);
    const header = await store.patch({ taskId: task.id, baseRevision: patched.revision, brief: "Keep the exact sung bass timing" });
    assert.deepEqual(header.steps[0]!.evidence, [evidence]);
    const replacement = await store.update({ taskId: task.id, baseRevision: header.revision, replace: true,
      goal: "Arrange only bass", brief: "New musician direction", steps: [{ action: "Review bass", status: "pending" }] });
    assert.notEqual(replacement.id, task.id);
    assert.equal(JSON.parse(await readFile(join(root, "production-tasks", `${task.id}.json`), "utf8")).steps.length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("allowed-size checkpoints have complete bounded read pages and compact writer acknowledgements", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-production-"));
  try {
    const store = new ProductionTaskStore({ songId: "song", dataDir: root });
    const escaped = `x${"\u0001".repeat(998)}`;
    const targets = Array.from({ length: 16 }, (_, index) => `${index}${"\u0001".repeat(197)}`);
    const evidence = Array.from({ length: 8 }, () => ({ kind: "tool" as const, exchangeId: escaped, toolCallId: escaped, summary: escaped, targets }));
    const ctx = { production: store, exchangeId: "trusted-exchange", config: { limits: { toolResultMaxChars: 60000 } } } as unknown as ToolContext;
    const update = productionTaskTools.find((tool) => tool.name === "production_task_update")!;
    const ack = await update.run({ baseRevision: 0, goal: escaped, brief: escaped.repeat(6), steps: Array.from({ length: 23 }, () => ({ action: escaped, status: "pending", targetTags: targets, evidence })) }, ctx);
    assert.ok(JSON.stringify(ack).length < 4000);
    const task = (await store.read())!;
    assert.ok(JSON.stringify(task).length > 60000);
    const read = productionTaskTools.find((tool) => tool.name === "production_task_read")!;
    const seen: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await read.run({ offset, limit: 24 }, ctx) as { steps: { id: string }[]; nextOffset: number | null };
      assert.ok(JSON.stringify(page).length <= 60000);
      seen.push(...page.steps.map((step) => step.id)); offset = page.nextOffset;
    }
    assert.deepEqual(seen, task.steps.map((step) => step.id));
    const last = task.steps.at(-1)!;
    const step = await read.run({ detail: "step", stepId: last.id }, ctx) as { step: { action: string } };
    assert.equal(step.step.action, escaped);
    assert.ok(JSON.stringify(step).length <= 60000);
    const citations: unknown[] = [];
    offset = 0;
    while (offset !== null) {
      const page = await read.run({ detail: "evidence", stepId: last.id, offset, limit: 8 }, ctx) as { evidence: unknown[]; nextOffset: number | null };
      assert.ok(JSON.stringify(page).length <= 60000);
      citations.push(...page.evidence); offset = page.nextOffset;
    }
    assert.deepEqual(citations, last.evidence);
    const patch = productionTaskTools.find((tool) => tool.name === "production_task_patch")!;
    const changed = await patch.run({ taskId: task.id, baseRevision: task.revision, steps: [{ id: last.id, status: "working" }] }, ctx);
    assert.ok(JSON.stringify(changed).length < 4000);
    assert.deepEqual((await store.read())!.steps[0], task.steps[0]);
    assert.deepEqual((await store.read())!.steps.at(-1)!.targetTags, last.targetTags);
    assert.deepEqual((await store.read())!.steps.at(-1)!.evidence, last.evidence);
    const beforeAppend = (await store.read())!;
    const appended = await patch.run({ taskId: task.id, baseRevision: beforeAppend.revision, appendSteps: [{ action: "Inspect the newly supplied vocal" }] }, ctx);
    assert.ok(JSON.stringify(appended).length < 4000);
    const afterAppend = (await store.read())!;
    assert.equal(afterAppend.steps.length, 24);
    assert.deepEqual(afterAppend.steps.slice(0, 23), beforeAppend.steps);
    await assert.rejects(store.patch({ taskId: task.id, baseRevision: afterAppend.revision, appendSteps: [{ action: "Beyond the plan limit" }] }), /24/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
