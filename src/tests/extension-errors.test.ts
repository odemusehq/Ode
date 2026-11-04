import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { describeError, LiveError } from "../live/extension/errors";

test("native errors from another host realm retain their message", async () => {
  const error: unknown = runInNewContext('new Error("fsync API is disabled when Permission Model is enabled.")');
  assert.equal(error instanceof Error, false);
  assert.equal(describeError(error), "fsync API is disabled when Permission Model is enabled.");
  await assert.rejects(LiveError.guard(Promise.reject(error), "save"), {
    message: "Live failed to save: fsync API is disabled when Permission Model is enabled.",
  });
});
