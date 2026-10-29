import assert from "node:assert/strict";
import { test } from "node:test";
import { ReleaseNotes } from "../packaging/notes";
import { Release } from "../packaging/release";

test("the Live extension's manifest has the version in package.json", async () => {
  await (await Release.read()).checkManifest();
});

test("release notes list each change and say how to install that release's extension", () => {
  const notes = ReleaseNotes.format(new Release("1.2.0"), ["Lyrics side panel", "Safer Undo"]);
  assert.match(notes, /^- Lyrics side panel$/m);
  assert.match(notes, /^- Safer Undo$/m);
  assert.ok(notes.includes("drop `Ode-1.2.0.ablx` on the page"), notes);
});
