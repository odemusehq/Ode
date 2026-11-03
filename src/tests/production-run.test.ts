import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductionRun } from "../harness/production-run";
import type { ProductionTask } from "../shared/production-task";

test("only declared current execution gets one reminder; old plans and partial quotes do not", async () => {
  const task = { id: "task", status: "working", exchangeIds: ["exchange"], steps: [{ action: "Arrange drums", status: "working", targetTags: ["drums"] }] } as ProductionTask;
  let interrupted = false;
  const run = new ProductionRun({ read: async () => task, interrupt: async () => { interrupted = true; return task; } }, "exchange", "finish the arrangement", new AbortController().signal);
  assert.doesNotMatch((await run.afterReply())!, /Arrange drums/);
  assert.match(await run.execute("task", "finish"), /full current/);
  assert.equal(await run.afterReply(), null);
  await run.execute("task", "finish the arrangement");
  assert.match((await run.afterReply(1))!, /Arrange drums/);
  assert.equal(await run.afterReply(1), null);
  await run.finish();
  assert.equal(interrupted, true);
  const next = new ProductionRun({ read: async () => task, interrupt: async () => task }, "different-exchange", "what remains?", new AbortController().signal);
  assert.match(await next.execute("task", "what remains?"), /linking/);
  assert.doesNotMatch((await next.afterReply())!, /Arrange drums/);
});

test("only new tool work gets another completion review without granting old-plan authority", async () => {
  let reads = 0;
  const run = new ProductionRun({ read: async () => { reads++; throw new Error("An undeclared old plan must not enter this review"); },
    interrupt: async () => null }, "exchange", "Why is the chorus louder?", new AbortController().signal);
  const review = await run.afterReply(0);
  assert.match(review!, /current request/i);
  assert.match(review!, /question/i);
  assert.match(review!, /not.*authoris/i);
  assert.equal(reads, 0);
  assert.equal(await run.afterReply(0), null);
  assert.match((await run.afterReply(1))!, /current request/i);
  assert.match((await run.afterReply(2))!, /current request/i);
  assert.equal(await run.afterReply(2), null);
  assert.match((await run.afterReply(3))!, /current request/i);
  assert.match((await run.afterReply(4))!, /current request/i);
  assert.equal(await run.afterReply(4), null, "unchanged work cannot cause another Stop continuation");
});

test("completion review cannot continue a cancelled request", async () => {
  const controller = new AbortController();
  const run = new ProductionRun({ read: async () => null, interrupt: async () => null }, "exchange", "finish", controller.signal);
  controller.abort();
  assert.equal(await run.afterReply(1), null);
});
