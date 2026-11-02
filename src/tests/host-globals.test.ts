import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("the SDK loads when Live omits the DOMException global", () => {
  const compatibility = new URL("../live/extension/host-globals.ts", import.meta.url).href;
  const result = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    delete globalThis.DOMException;
    await import(${JSON.stringify(compatibility)});
    const controller = new AbortController(); controller.abort();
    if (!(controller.signal.reason instanceof DOMException)) throw new Error("Use Node's native DOMException.");
    await import("@anthropic-ai/claude-agent-sdk/core");
    console.log("loaded");
  `], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.trim(), "loaded");
});
