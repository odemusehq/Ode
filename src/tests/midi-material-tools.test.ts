import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MidiMaterials, type MidiMaterialScope } from "../harness/midi-materials";
import { Describer } from "../live/extension/describe";
import { toLiveNotes } from "../live/extension/notes";
import { MidiNoteOperations } from "../live/extension/ops/midi-notes";
import { TrackOperations } from "../live/extension/ops/tracks";
import { UndoOperations } from "../live/extension/ops/undo";
import type { AnyOperation, OperationTable, RegularOp } from "../live/extension/ops/operation";
import { ReferenceResolver } from "../live/extension/refs";
import { TaggedName } from "../live/extension/tags";
import type { Live } from "../live/extension/sdk";
import { OdeConfig } from "../shared/config";
import type { Note } from "../shared/live";
import type { MidiMaterialRef } from "../shared/midi-material";
import { emptyLeadSheet } from "../shared/song";
import { ToolRegistry, type ToolOutcome } from "../tools";
import type { ToolContext } from "../tools/define";
import { FakeLive } from "./fake-live";
import { TestSets } from "./sets";

const signature = { numerator: 4, denominator: 4 } as const;
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function result(outcome: ToolOutcome): any { assert.equal(outcome.ok, true, outcome.text); return JSON.parse(outcome.text); }

function rig() {
  const fake = new FakeLive(), source = fake.midiClip("Source", 0), destination = fake.midiClip("Destination", 8);
  const initial: Note[] = [{ pitch: 60, start: 0.06, duration: 1.13, velocity: 87, probability: 0.8, releaseVelocity: 32 },
    { pitch: 64, start: 2.93, duration: 0.7, velocity: 101, velocityDeviation: 4 },
    { pitch: 76, start: 4, duration: 0.5, muted: true, probability: 0.3 }];
  for (const clip of [source, destination]) Object.defineProperty(clip, "notes", { value: toLiveNotes(initial), writable: true });
  const track = fake.midiTrack("Voice", [source, destination]);
  Object.defineProperty(track, "createMidiClip", { value: async (start: number) => {
    const clip = fake.midiClip("New clip", start);
    Object.defineProperty(clip, "notes", { value: [], writable: true });
    track.arrangementClips.push(clip);
    return clip;
  } });
  const set = fake.liveSet(), live = { withinTransaction: <T>(run: () => T) => run() } as Live;
  const services = { live, set, refs: new ReferenceResolver(set), describe: new Describer(set) };
  const midi = new MidiNoteOperations(services).table(), regular = { ...midi, ...new TrackOperations(services).table() };
  const operations = { ...regular, ...new UndoOperations(live, regular as unknown as OperationTable<RegularOp>).table() } as Record<string, AnyOperation>;
  const followUps = { after: async <T, R>(started: Promise<T>, apply: (value: T) => R) => apply(await started) };
  const calls: { op: string; args: any }[] = [];
  const config = new OdeConfig("unused", "unused"), song = { songId: randomUUID(), read: async () => emptyLeadSheet() };
  const ctx = { config, song, prefs: { effective: async () => ({ pronunciation: "uk", genre: null, vocalRange: null }) },
    snapshots: { latest: { song: { tempo: 120, scaleMode: false }, signature } },
    live: { extension: { call: async (op: string, args: any) => {
      calls.push({ op, args: structuredClone(args) });
      return operations[op]!.prepare(args, followUps)();
    } } } } as unknown as ToolContext;
  const registry = new ToolRegistry(ctx), exchangeId = randomUUID();
  const close = registry.beginMidiMaterials(exchangeId);
  const run = (name: string, input: unknown, signal?: AbortSignal) => registry.run(name, input, signal, { exchangeId });
  const exactNotes = async (ref: MidiMaterialRef) => {
    const notes: Note[] = []; let offset: number | null = 0;
    while (offset !== null) {
      const page = result(await run("midi_material_read", { id: ref.id, section: "notes", offset, limit: 512, expectedHash: ref.sha256 }));
      notes.push(...page.notes); offset = page.nextOffset;
    }
    return notes;
  };
  return { ctx, song, registry, run, exactNotes, close, midi, followUps, calls, source, destination, track, initial, exchangeId };
}

test("MIDI material scopes keep exact detached notes and bound metadata, capacity and lifetime", () => {
  const store = new MidiMaterials(), scope = store.begin("song-a", "request-a");
  const notes: Note[] = [{ pitch: 60, start: 0.06, duration: 0.29, velocity: 87, probability: 0.7 }, { pitch: 64, start: 1.11, duration: 0.5 }];
  const expected = structuredClone(notes), text = "\n\"\\🎵".repeat(1800);
  const projected = scope.capture({ result: { notes, analysis: { text } }, outputs: [{ path: ["notes"] }], sourceTool: "fixture", maxResultChars: 900 }) as any;
  assert.ok(JSON.stringify(projected).length <= 900);
  const ref = projected.notes as MidiMaterialRef;
  notes[0]!.pitch = 80;
  const resolved = scope.resolve(ref); resolved.notes[0]!.pitch = 90;
  assert.deepEqual(scope.resolve(ref).notes, expected);
  assert.throws(() => scope.resolve({ ...ref, sha256: "0".repeat(64) }));
  assert.throws(() => scope.resolve({ ...ref, count: 3 }));
  assert.throws(() => store.begin("song-b", "request-a").resolve(ref));
  assert.throws(() => scope.read({ id: ref.id, section: "notes", offset: 3 }, 900));
  let offset: number | null = 0, hash: string | undefined, json = "";
  while (offset !== null) {
    const page = scope.read({ id: ref.id, section: "metadata", offset, limit: 700, expectedHash: hash }, 900) as any;
    assert.ok(JSON.stringify(page).length <= 900);
    json += page.text; hash = page.sha256; offset = page.nextOffset;
  }
  assert.equal(JSON.parse(json).analysis.text, text);
  assert.throws(() => scope.read({ id: ref.id, section: "metadata", offset: 1 }, 900));
  for (const limits of [{ maxMaterials: 1 }, { maxNotes: 1 }, { maxBytes: 1 }]) {
    const limited = new MidiMaterials(limits).begin("song-a", "request-a");
    assert.throws(() => limited.capture({ result: { notes: expected, other: expected }, outputs: [{ path: ["notes"] }, { path: ["other"] }], sourceTool: "fixture", maxResultChars: 900 }));
    assert.equal((limited.list() as any).total, 0);
  }
  const stopped = new AbortController(); stopped.abort();
  assert.throws(() => scope.capture({ result: { notes: expected }, outputs: [{ path: ["notes"] }], sourceTool: "fixture", maxResultChars: 900, signal: stopped.signal }), { name: "AbortError" });
  const fresh = new MidiMaterials().begin("song-a", "request-b");
  assert.throws(() => fresh.capture({ result: { notes: expected }, outputs: [{ path: ["notes"] }], sourceTool: "fixture", maxResultChars: 100 }));
  assert.equal((fresh.list() as any).total, 0);
  store.end(scope);
  assert.throws(() => scope.resolve(ref), /expired|request/i);
});

test("large native note reads reach clip creation without model reserialization", async () => {
  const r = rig();
  try {
    const notes: Note[] = Array.from({ length: 1024 }, (_, index) => ({ pitch: 60, start: index * 0.125, duration: 0.09, velocity: 87 }));
    (r.source as unknown as { notes: ReturnType<typeof toLiveNotes> }).notes = toLiveNotes(notes);
    const outcome = await r.run("midi_clip_get_notes", { clip: { track: { index: 0 }, start: 0 } });
    const read = result(outcome);
    assert.ok(outcome.text.length <= r.ctx.config.limits.toolResultMaxChars);
    assert.equal(read.notes.kind, "midi-material");
    assert.deepEqual(await r.exactNotes(read.notes), clean(notes));
    const created = await r.run("track_create_midi_clip", { track: { index: 0 }, start: 16, length: 256, notes: read.notes, name: "Copied performance" });
    assert.equal(created.ok, true, created.text);
    const clip = r.track.arrangementClips.find((item) => item.startTime === 16) as unknown as { notes: unknown };
    assert.deepEqual(clip.notes, toLiveNotes(notes));
    assert.equal(r.registry.available("subagent").some((tool) => tool.name === "midi_material_list"), true);
    assert.equal(r.registry.available("subagent").some((tool) => tool.name === "midi_clip_set_notes"), false);
  } finally { r.close(); }
});

test("read-derived material keeps its original native guard while copies and reverse Undo remain supported", async () => {
  const r = rig(), sourceRef = { track: { index: 0 }, start: 0 }, destinationRef = { track: { index: 0 }, start: 8 };
  try {
    const read = result(await r.run("midi_clip_get_notes", { clip: sourceRef }));
    const varied = read;
    const expected = await r.exactNotes(varied.notes);
    const sourceWrite = await r.run("midi_clip_set_notes", { clip: sourceRef, notes: varied.notes, expected: { token: read.recoveryToken } });
    assert.equal(sourceWrite.ok, true, sourceWrite.text);
    assert.equal((await r.run("midi_clip_set_notes", { clip: sourceRef, notes: varied.notes, expected: { token: read.recoveryToken } })).ok, false,
      "A consumed token stays unusable as a write guard even when its origin identity remains available for copying.");
    const destination = result(await r.run("midi_clip_get_notes", { clip: destinationRef }));
    const copied = await r.run("apply_as_one_undo_step", { calls: [{ op: "midi_clip_set_notes", args: { clip: destinationRef, notes: varied.notes, expected: { token: destination.recoveryToken } } }] });
    assert.equal(copied.ok, true, copied.text);
    assert.deepEqual((r.destination as unknown as { notes: unknown }).notes, toLiveNotes(expected));
    const receipt = sourceWrite.receipts?.find((entry) => entry.kind === "midi-notes");
    assert.ok(receipt?.kind === "midi-notes");
    await r.midi.midi_clip_set_notes.prepare({ clip: sourceRef, notes: receipt.before, expected: { token: receipt.token, notes: receipt.after } }, r.followUps)();
    const manual = { pitch: 79, startTime: 6.37, duration: 0.29, velocity: 101, probability: 0.6 };
    const held = r.source as unknown as { notes: ReturnType<typeof toLiveNotes> };
    held.notes.push(manual);
    const fresh = result(await r.run("midi_clip_get_notes", { clip: sourceRef }));
    const stale = await r.run("apply_as_one_undo_step", { calls: [{ op: "midi_clip_set_notes", args: { clip: sourceRef, notes: varied.notes, expected: { token: fresh.recoveryToken } } }] });
    assert.equal(stale.ok, false, "A fresh destination token cannot bless old same-source material after a manual edit.");
    assert.deepEqual(held.notes.at(-1), manual);
    await assert.rejects(r.midi.midi_clip_set_notes.prepare({ clip: sourceRef, notes: r.initial, expected: { token: fresh.recoveryToken },
      originReadTokens: ["expired-source-token"] }, r.followUps)(), /expired|source snapshot/i);
    const calls = r.calls.length, stopped = new AbortController(); stopped.abort();
    await assert.rejects(r.run("midi_clip_set_notes", { clip: sourceRef, notes: varied.notes, expected: { token: fresh.recoveryToken } }, stopped.signal), { name: "AbortError" });
    assert.equal(r.calls.length, calls);
    const scope = (r.registry as unknown as { midiScopes: Map<string, MidiMaterialScope> }).midiScopes.get(r.exchangeId)!;
    const remaining = 512 - (scope.list() as any).total;
    const items = Array.from({ length: remaining }, () => []);
    scope.capture({ result: { items }, outputs: items.map((_item, index) => ({ path: ["items", index] })), sourceTool: "capacity-fixture", maxResultChars: 60_000 });
    const mixed = await r.run("apply_as_one_undo_step", { calls: [
      { op: "midi_clip_set_notes", args: { clip: sourceRef, notes: r.initial, expected: { token: fresh.recoveryToken } } },
      { op: "midi_clip_get_notes", args: { clip: sourceRef } },
    ] });
    const completed = result(mixed);
    assert.equal(completed.completed, true);
    assert.match(completed.materialWarning, /completed|unavailable|full/i);
    assert.ok(mixed.receipts?.some((entry) => entry.kind === "midi-notes"));
    assert.deepEqual(held.notes, toLiveNotes(r.initial), "Artifact exhaustion must not hide an already completed native write.");
    let sheet = emptyLeadSheet();
    r.song.read = async () => sheet;
    (r.song as any).updateWithReceipt = async (patch: Partial<typeof sheet>) => { sheet = { ...sheet, ...patch }; return { ...sheet, __odeReceipts: [] }; };
    r.source.name = TaggedName.of("Source", "chosen").toString();
    const snapshot = TestSets.small();
    snapshot.tracks[0]!.arrangementClips = [{ ...TestSets.clip(0, "Source", 0, 8, r.initial), tag: "chosen" }];
    r.ctx.snapshots.read = async () => snapshot;
    const saved = await r.run("hook_retain", { id: "kept", clipTag: "chosen", lengthBeats: 8 });
    assert.equal(saved.ok, true, saved.text);
    assert.equal(sheet.composition?.hooks[0]?.id, "kept", "A successful durable hook save stays successful when temporary material is full.");
    r.song.songId = randomUUID();
    assert.equal((await r.run("midi_material_read", { id: varied.notes.id, section: "notes" })).ok, false);
    r.close();
    assert.equal((await r.run("midi_clip_set_notes", { clip: sourceRef, notes: varied.notes, expected: { token: fresh.recoveryToken } })).ok, false);
  } finally { r.close(); }
});

test("explicit model note edits use the native guard and preserve unrelated notes", async () => {
  const r = rig(), clip = { track: { index: 0 }, start: 0 };
  try {
    const read = result(await r.run("midi_clip_get_notes", { clip }));
    const source = await r.exactNotes(read.notes);
    const edited = structuredClone(source);
    edited[1]!.velocity = 72;
    const held = r.source as unknown as { notes: ReturnType<typeof toLiveNotes> };
    const manual = { pitch: 79, startTime: 6.37, duration: 0.29, velocity: 101, probability: 0.6 };
    held.notes.push(manual);
    const stale = await r.run("midi_clip_set_notes", { clip, notes: edited, expected: { token: read.recoveryToken } });
    assert.equal(stale.ok, false);
    assert.deepEqual(held.notes.at(-1), manual);
    const fresh = result(await r.run("midi_clip_get_notes", { clip }));
    const current = await r.exactNotes(fresh.notes);
    current[1]!.velocity = 72;
    const applied = await r.run("midi_clip_set_notes", { clip, notes: current, expected: { token: fresh.recoveryToken } });
    assert.equal(applied.ok, true, applied.text);
    assert.deepEqual(held.notes, toLiveNotes(current));
    assert.deepEqual(await r.exactNotes(read.notes), clean(source));
  } finally { r.close(); }
});
