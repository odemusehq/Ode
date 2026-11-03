import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductionRun } from "../harness/production-run";
import type { ProductionTask } from "../shared/production-task";

test("only declared current execution gets one reminder; old plans and partial quotes do not", async () => {
  const task = { id: "task", status: "working", exchangeIds: ["exchange"], steps: [{ action: "Arrange drums", status: "working", targetTags: ["drums"] }] } as ProductionTask;
  let interrupted = false;
  const run = new ProductionRun({ read: async () => task, interrupt: async () => { interrupted = true; return task; } }, "exchange", "finish the arrangement", new AbortController().signal);
  assert.equal(await run.afterReply(), null);
  assert.match(await run.execute("task", "finish"), /full current/);
  assert.equal(await run.afterReply(), null);
  await run.execute("task", "finish the arrangement");
  assert.match((await run.afterReply())!, /Arrange drums/);
  assert.equal(await run.afterReply(), null);
  await run.finish();
  assert.equal(interrupted, true);
  const next = new ProductionRun({ read: async () => task, interrupt: async () => task }, "different-exchange", "what remains?", new AbortController().signal);
  assert.match(await next.execute("task", "what remains?"), /linking/);
  assert.equal(await next.afterReply(), null);
});

test("tool work gets one completion review without treating a saved task as authorisation", async () => {
  let reads = 0;
  const run = new ProductionRun({ read: async () => { reads++; throw new Error("An undeclared old plan must not enter this review"); },
    interrupt: async () => null }, "exchange", "Why is the chorus louder?", new AbortController().signal);
  const review = await run.afterReply(true);
  assert.match(review!, /current request/i);
  assert.match(review!, /question/i);
  assert.match(review!, /not.*authoris/i);
  assert.equal(reads, 0);
  assert.equal(await run.afterReply(true), null);
});

test("completion review cannot continue a cancelled request", async () => {
  const controller = new AbortController();
  const run = new ProductionRun({ read: async () => null, interrupt: async () => null }, "exchange", "finish", controller.signal);
  controller.abort();
  assert.equal(await run.afterReply(true), null);
});
