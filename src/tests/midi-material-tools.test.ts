import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MidiMaterials, type MidiMaterialScope } from "../harness/midi-materials";
import { AgentLoop, LoopEnd, LoopTool } from "../harness/loop";
import { Describer } from "../live/extension/describe";
import { toLiveNotes } from "../live/extension/notes";
import { MidiNoteOperations } from "../live/extension/ops/midi-notes";
import { TrackOperations } from "../live/extension/ops/tracks";
import { UndoOperations } from "../live/extension/ops/undo";
import type { AnyOperation, OperationTable, RegularOp } from "../live/extension/ops/operation";
import { ReferenceResolver } from "../live/extension/refs";
import { TaggedName } from "../live/extension/tags";
import type { Live } from "../live/extension/sdk";
import { Contour, Register } from "../music/melody/melody-plan";
import { OdeConfig } from "../shared/config";
import type { Note } from "../shared/live";
import type { MidiMaterialRef } from "../shared/midi-material";
import { emptyLeadSheet } from "../shared/song";
import { ToolRegistry, type ToolOutcome } from "../tools";
import type { ToolContext } from "../tools/define";
import { drumGrooveWriteTool } from "../tools/music/drum-groove-write";
import { melodyWriteTool } from "../tools/music/melody-write";
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

test("large helper material stays valid JSON and reaches native clip creation without model reserialization", async () => {
  const r = rig();
  try {
    const drumInput = { genre: "house", section: "chorus" as const, bars: 64, energy: 0.8, seed: 1, timeSignature: signature };
    const raw = await drumGrooveWriteTool.run(drumInput, r.ctx) as { notes: Note[] };
    const outcome = await r.run("drum_groove_write", drumInput), draft = result(outcome);
    assert.ok(outcome.text.length <= r.ctx.config.limits.toolResultMaxChars);
    assert.equal(draft.notes.kind, "midi-material");
    assert.equal(draft.notes.count, raw.notes.length);
    assert.deepEqual(await r.exactNotes(draft.notes), clean(raw.notes));
    const created = await r.run("track_create_midi_clip", { track: { index: 0 }, start: 16, length: 256, notes: draft.notes, name: "Long groove" });
    assert.equal(created.ok, true, created.text);
    const newClip = r.track.arrangementClips.find((clip) => clip.startTime === 16) as unknown as { notes: unknown };
    assert.deepEqual(newClip.notes, toLiveNotes(raw.notes));
    const lyricInput = { bars: 32, lyrics: Array.from({ length: 32 }, () => "I will follow you home"), contour: Contour.Arch,
      register: Register.Mid, density: 1, seed: 1, key: { root: 0, scale: "Major" }, range: { low: 60, high: 72 }, timeSignature: signature };
    const rawLyrics = await melodyWriteTool.run(lyricInput, r.ctx) as { notes: Note[]; phrases: { syllables: unknown; alignment: unknown }[] };
    assert.ok(JSON.stringify(rawLyrics).length > 60_000);
    const lyricsOutcome = await r.run("melody_write", lyricInput), lyrics = result(lyricsOutcome);
    assert.ok(lyricsOutcome.text.length <= 60_000);
    assert.deepEqual(await r.exactNotes(lyrics.notes), clean(rawLyrics.notes));
    let metadata = "", metadataOffset: number | null = 0, metadataHash: string | undefined;
    while (metadataOffset !== null) {
      const outcome = await r.run("midi_material_read", { id: lyrics.notes.id, section: "metadata", offset: metadataOffset, expectedHash: metadataHash });
      const page = result(outcome); assert.ok(outcome.text.length <= 60_000);
      metadata += page.text; metadataOffset = page.nextOffset; metadataHash = page.sha256;
    }
    const exactMetadata = JSON.parse(metadata);
    assert.deepEqual(exactMetadata.phrases[0].syllables, clean(rawLyrics.phrases[0]!.syllables));
    assert.deepEqual(exactMetadata.phrases.at(-1).alignment, rawLyrics.phrases.at(-1)!.alignment);
    const listed = result(await r.run("midi_material_list", { resultId: lyrics.midiMaterials.resultId, limit: 100 }));
    assert.ok(listed.items.some((item: any) => item.ref.id === lyrics.notes.id && item.sourceTool === "melody_write"));
    assert.equal(listed.scope.exchangeId, r.exchangeId);
    assert.equal(r.registry.available("subagent").some((tool) => tool.name === "midi_material_list"), true);
    assert.equal(r.registry.available("subagent").some((tool) => tool.name === "midi_clip_set_notes"), false);
    const source = result(await r.run("midi_clip_get_notes", { clip: { track: { index: 0 }, start: 0 } }));
    const hookInput = { ...lyricInput, bars: 2, lyrics: ["hello"], range: { low: 60, high: 79 },
      phrases: [{ line: 1, startBeat: 0, lengthBeats: 8, hookId: "kept" }],
      retainedHooks: [{ id: "kept", lengthBeats: 8, notes: source.notes }] };
    const hooked = result(await r.run("melody_write", hookInput));
    assert.deepEqual(await r.exactNotes(hooked.notes), clean(r.initial));
    assert.equal((await r.run("melody_write", { ...hookInput, retainedHooks: [{ id: "kept", lengthBeats: 1, notes: source.notes }] })).ok, false,
      "Original hook-boundary validation still runs after resolving a nested reference.");
  } finally { r.close(); }
});

test("read-derived material keeps its original native guard while copies and reverse Undo remain supported", async () => {
  const r = rig(), sourceRef = { track: { index: 0 }, start: 0 }, destinationRef = { track: { index: 0 }, start: 8 };
  try {
    const read = result(await r.run("midi_clip_get_notes", { clip: sourceRef }));
    const varied = result(await r.run("melody_vary", { notes: read.notes, how: "rhythm", seed: 1, timeSignature: signature, key: { root: 0, scale: "Major" } }));
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

test("a child draft is discoverable by the parent without prose references and expires after exact placement", async () => {
  const r = rig(); r.close();
  const input = { genre: "house", section: "chorus" as const, bars: 64, energy: 0.8, seed: 1, timeSignature: signature };
  const expected = await drumGrooveWriteTool.run(input, r.ctx) as { notes: Note[] };
  const call = (id: string, name: string, args: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  let mainRound = 0, childRound = 0, approvals = 0, writerChars = 0;
  let discovered: MidiMaterialRef | undefined;
  const loop = new AgentLoop({ registry: r.registry, limits: r.ctx.config.limits, labels: { for: () => "Draft or place MIDI" },
    skills: {}, subagentPrompt: async () => "Draft only; the parent applies.",
    services: { chat: async (agent: string) => ({ complete: async ({ messages }: { messages: { role: string; tool_call_id?: string; content?: string }[] }) => {
      let message: unknown;
      if (agent === "subagent") {
        const round = childRound++;
        message = round === 0 ? { tool_calls: [call("child-search", LoopTool.ToolSearch, { query: "drum_groove_write" })] }
          : round === 1 ? { tool_calls: [call("draft", "drum_groove_write", input)] } : { content: "The draft is ready." };
      } else {
        const round = mainRound++;
        if (round === 0) message = { tool_calls: [call("child", LoopTool.Subagent, { task: "Draft a 64-bar house chorus." })] };
        else if (round === 1) message = { tool_calls: [call("inventory", "midi_material_list", {}),
          call("writer-search", LoopTool.ToolSearch, { query: "track_create_midi_clip" })] };
        else if (round === 2) {
          const inventory = JSON.parse(messages.findLast((item) => item.tool_call_id === "inventory")!.content!);
          discovered = inventory.items.find((item: any) => item.sourceTool === "drum_groove_write").ref;
          const args = { track: { index: 0 }, start: 32, length: 256, notes: discovered, name: "Child groove" };
          writerChars = JSON.stringify(args).length;
          message = { tool_calls: [call("place", "track_create_midi_clip", args)] };
        } else message = { content: "Placed." };
      }
      return { message, tokens: 1, finishReason: "stop" };
    } }) },
  } as never);
  const end = await loop.run({ agent: "main", system: "", history: [], prompt: "Draft and place the groove", conversation: "fixture", depth: 0,
    exchangeId: r.exchangeId, signal: new AbortController().signal,
    gate: { check: async (tool) => { if (tool.changes === "set") approvals++; return null; } },
    events: { thought() {}, toolStarted() {}, toolFinished() {}, subagentStarted() {}, subagentFinished() {} } });
  assert.equal(end.end, LoopEnd.Reply);
  assert.equal(approvals, 1);
  assert.ok(discovered && writerChars < 1000);
  const placed = r.track.arrangementClips.find((clip) => clip.startTime === 32) as unknown as { notes: unknown };
  assert.deepEqual(placed.notes, toLiveNotes(expected.notes));
  assert.equal((await r.run("midi_material_read", { id: discovered.id, section: "notes" })).ok, false);
});
