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
