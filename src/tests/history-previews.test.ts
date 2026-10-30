import assert from "node:assert/strict";
import { test } from "node:test";
import { SetDiff } from "../mneme/set-diff";
import { changeValues, notesChange, previewChanges } from "../ui/views/change-values";
import { TestSets } from "./sets";

test("history previews show actual values and distinguish missing instruments", () => {
  const before = TestSets.small();
  const after = structuredClone(before);
  after.tracks[1]!.mixer.volume.value = 0.5;
  after.tracks[1]!.devices = [TestSets.device(0, "Wavetable", "InstrumentVector", [])];
  const changes = SetDiff.between(before, after);
  const volume = changes.find((change) => change.target.scope === "device" && change.target.index === -1)!;
  assert.deepEqual(changeValues(volume), { before: ["0.85"], after: ["0.5"], rawParameter: true });
  const removed = changes.find((change) => change.kind === "removed")!;
  const added = changes.find((change) => change.kind === "added")!;
  assert.ok(changeValues(removed)!.before.includes("Operator"));
  assert.deepEqual(changeValues(removed)!.after, ["Not present"]);
  assert.ok(changeValues(added)!.after.includes("Wavetable"));
  const preview = previewChanges(changes);
  assert.equal(preview.length, 2);
  assert.equal(preview[0]!.label, "Bass · Operator → Wavetable");
  assert.ok(changeValues(preview[0]!)!.before.includes("Operator"));
  assert.ok(changeValues(preview[0]!)!.after.includes("Wavetable"));
  assert.equal(changes.length, 3);
});

test("history previews expose changed control ranges and keep MIDI on its piano roll", () => {
  const before = TestSets.small();
  const after = structuredClone(before);
  after.tracks[1]!.devices[0]!.parameters[0]!.max = 2000;
  after.tracks[1]!.arrangementClips[0]!.notes = [];
  const changes = SetDiff.between(before, after);
  const device = changes.find((change) => change.target.scope === "device")!;
  assert.ok(changeValues(device)!.before.includes("Filter Freq · 20–20000"));
  assert.ok(changeValues(device)!.after.includes("Filter Freq · 20–2000"));
  const notes = changes.find((change) => change.target.field === "notes")!;
  assert.equal(changeValues(notes), null);
  assert.equal(notesChange(notes)!.after!.length, 0);
});
