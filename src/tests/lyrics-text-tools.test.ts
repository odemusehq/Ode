import assert from "node:assert/strict";
import { test } from "node:test";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

test("lyric text tools read and replace only the requested lines against their revision", async () => {
  let text = "[Verse]\nFirst line\nSecond line\n\n[Chorus]\nKeep this";
  let revision = 3;
  const registry = new ToolRegistry({ live: { extension: {} }, song: { read: async () => ({ locked: [] }) }, lyrics: {
    read: async () => ({ text, revision }),
    write: async (value: string, base: number) => { assert.equal(base, revision); text = value; return { text, revision: ++revision, conflicts: [] }; },
  } } as unknown as ToolContext);
  const selected = await registry.run("lyrics_read", { startLine: 2, endLine: 3 });
  assert.equal(selected.ok, true, selected.text);
  assert.deepEqual(JSON.parse(selected.text).lines, ["2: First line", "3: Second line"]);
  const saved = await registry.run("lyrics_write", { startLine: 3, endLine: 3, text: "Changed line", baseRevision: 3 });
  assert.equal(saved.ok, true, saved.text);
  assert.equal(text, "[Verse]\nFirst line\nChanged line\n\n[Chorus]\nKeep this");
  const stale = await registry.run("lyrics_write", { startLine: 2, endLine: 2, text: "Stale", baseRevision: 3 });
  assert.equal(stale.ok, false);
  assert.match(stale.text, /changed|revision/i);
  assert.match(text, /First line/);
});
