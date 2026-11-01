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
  assert.ok(notes.includes("drop the downloaded `.ablx` on the page"), notes);
  assert.ok(notes.includes("`Ode-1.2.0-darwin-arm64.ablx`"), notes);
  assert.ok(notes.includes("`Ode-1.2.0-darwin-x64.ablx`"), notes);
  assert.ok(notes.includes("`Ode-1.2.0-win32-x64.ablx`"), notes);
  assert.ok(notes.includes("and `Ode.amxd`"), notes);
  assert.ok(notes.includes("Live 12 Suite Beta"), notes);
  assert.ok(notes.includes("Max for Live, included with Suite"), notes);
  assert.ok(notes.includes("Click **Open Ode** on the device"), notes);
});
