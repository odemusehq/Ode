import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { ComposerError, ComposerStore } from "../mneme/composer-store";
import { ConversationStore } from "../mneme/conversations";
import { SongStore } from "../mneme/song-store";
import { userPaths } from "../mneme/paths";
import { LocalAudioFiles } from "../live/local-audio-files";
import { encodeWav } from "../music/audio/wav";
import type { ComposerDraft, ComposerState } from "../shared/composer";
import { OdeServer, type ServerDeps } from "../server/http";
import { API } from "../shared/api";
import type { Hono } from "hono";

const draft = (text: string): ComposerDraft => ({ text, textEditId: randomUUID(), attachments: [] });
async function rig(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ode-composer-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const song = new SongStore(userPaths(root), () => undefined);
  const entry = await song.create("Night Bus");
  const conversations = new ConversationStore(join(root, "conversations"), 6);
  const audio = new LocalAudioFiles(root, join(root, "temp"));
  const store = new ComposerStore(song, conversations, audio);
  const writerId = randomUUID();
  const sequences = new Map<string, number>();
  const write = (state: ComposerState, next: ComposerDraft, writer = writerId) => {
    const sequence = (sequences.get(writer) ?? 0) + 1; sequences.set(writer, sequence);
    return { songId: state.songId, writerId: writer, writeId: randomUUID(), sequence, baseRevision: state.revision, draft: next };
  };
  return { root, song, songId: entry.id, conversations, audio, store, writerId, write, reopen: () => new ComposerStore(song, conversations, audio) };
}

test("composer saves are durable, private, idempotent and song-bound after switching", async (t) => {
  const r = await rig(t);
  const initial = await r.store.read(r.songId);
  const input = r.write(initial, draft("Keep the late entrance"));
  const saved = await r.store.save(input);
  assert.equal((await r.store.save(input)).revision, saved.revision);
  const other = await r.song.create("Morning Train");
  await r.store.save(r.write(saved, draft("Keep the late entrance and the breath")));
  assert.equal((await r.reopen().read(r.songId)).draft.text, "Keep the late entrance and the breath");
  assert.equal((await r.reopen().read(other.id)).draft.text, "");
  assert.equal((await stat(join(await r.song.directoryFor(r.songId), "composer.json"))).mode & 0o777, 0o600);
});

test("CAS conflicts survive closure and explicit resolution preserves the replaced draft", async (t) => {
  const r = await rig(t);
  const initial = await r.store.read(r.songId);
  const canonical = await r.store.save(r.write(initial, draft("First window")));
  const local = r.write(initial, draft("Second window"), randomUUID());
  await assert.rejects(r.store.save(local), (error) => error instanceof ComposerError && error.composer?.conflicts[0]?.draft.text === "Second window");
  const recovered = await r.reopen().read(r.songId);
  assert.equal(recovered.draft.text, canonical.draft.text);
  const resolved = await r.store.resolve({ songId: r.songId, writerId: local.writerId, writeId: randomUUID(), baseRevision: recovered.revision,
    conflictId: recovered.conflicts[0]!.id, choice: "local" });
  assert.equal(resolved.draft.text, "Second window");
  const directory = join(await r.song.directoryFor(r.songId), "composer-recovery");
  const retained = JSON.parse(await readFile(join(directory, (await readdir(directory))[0]!), "utf8"));
  assert.equal(retained.draft.text, "First window");
});

test("lost send acknowledgement reconciles accepted UUID and never prepares a duplicate", async (t) => {
  const r = await rig(t);
  const saved = await r.store.save(r.write(await r.store.read(r.songId), draft("Make the bass sparser")));
  const pending = await r.store.prepare({ songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft });
  assert.ok(pending.pending);
  await r.conversations.log(r.songId).beginOnce(pending.pending.payload, pending.pending.requestId);
  const afterRestart = await r.reopen().read(r.songId);
  assert.equal(afterRestart.draft.text, "");
  assert.equal(afterRestart.pending, null);
  const retry = await r.store.prepare({ songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: afterRestart.revision, snapshot: saved.draft });
  assert.equal(retry.acceptedRequestId, pending.pending.requestId);
  assert.equal(retry.pending, null);
  assert.equal((await r.conversations.log(r.songId).all()).length, 1);
});

test("acceptance and late keepalive writes preserve later identical typing and never restore delivered text", async (t) => {
  const r = await rig(t);
  const sentDraft = draft("Keep this hook");
  const saved = await r.store.save(r.write(await r.store.read(r.songId), sentDraft));
  const pending = await r.store.prepare({ songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: saved.revision, snapshot: sentDraft });
  const typedAgain = draft(sentDraft.text);
  await r.store.save(r.write(pending, typedAgain));
  await r.conversations.log(r.songId).beginOnce(pending.pending!.payload, pending.pending!.requestId);
  const accepted = await r.store.accepted(r.songId, pending.pending!.requestId);
  assert.equal(accepted.draft.textEditId, typedAgain.textEditId);
  assert.equal(accepted.draft.text, typedAgain.text);
  const stale = await r.store.save(r.write(saved, sentDraft));
  assert.deepEqual(stale.draft, typedAgain);
  assert.deepEqual(stale.conflicts, []);
});

test("Stop retires an unaccepted UUID across restart while fresh explicit typing can be sent", async (t) => {
  const r = await rig(t);
  const saved = await r.store.save(r.write(await r.store.read(r.songId), draft("Add a quiet answer")));
  const pending = await r.store.prepare({ songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft });
  const stopped = await r.store.cancel({ songId: r.songId, requestId: pending.pending!.requestId });
  assert.equal(stopped.draft.text, saved.draft.text);
  await assert.rejects(r.reopen().assertRequest(r.songId, pending.pending!.requestId, pending.pending!.payload), /stopped/);
  const next = await r.store.prepare({ songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: stopped.revision, snapshot: stopped.draft });
  assert.notEqual(next.pending!.requestId, pending.pending!.requestId);
});

test("uploads link before acknowledgement, retry once, and stay with their intended writer after divergence", async (t) => {
  const r = await rig(t);
  const saved = await r.store.save(r.write(await r.store.read(r.songId), draft("Compare this reference")));
  const input = { songId: r.songId, writerId: r.writerId, entryId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft, scope: "reference" as const,
    audio: { name: "reference.wav", bytes: encodeWav({ sampleRate: 16000, channels: [new Float32Array(32)] }), purpose: "reference" as const } };
  const uploaded = await r.store.attach(input);
  const replay = await r.store.attach(input);
  assert.equal(replay.id, uploaded.id);
  assert.equal(replay.composer.draft.attachments.length, 1);
  const nextSelection = { ...input, entryId: randomUUID(), baseRevision: replay.composer.revision, snapshot: replay.composer.draft };
  const changed = await r.store.save(r.write(replay.composer, draft("Other window's request"), randomUUID()));
  await assert.rejects(r.store.attach(nextSelection), (error) => error instanceof ComposerError && error.composer?.conflicts[0]?.draft.attachments.length === 2);
  const current = await r.store.read(r.songId);
  assert.equal(current.draft.text, changed.draft.text);
  assert.equal(current.draft.attachments.length, 0);
  assert.equal(current.conflicts[0]?.draft.text, saved.draft.text);
  assert.equal(current.conflicts[0]?.draft.attachments.length, 2);
});

test("evicting recent write receipts never lets an older writer edit replace its newer conflict", async (t) => {
  const r = await rig(t);
  const initial = await r.store.read(r.songId);
  await r.store.save(r.write(initial, draft("Canonical")));
  const other = randomUUID();
  const old = r.write(initial, draft("Old conflict"), other);
  await assert.rejects(r.store.save(old), ComposerError);
  await assert.rejects(r.store.save(r.write(initial, draft("Latest conflict"), other)), ComposerError);
  // The bounded write-id cache may expire; the compact per-writer ordering anchor must remain authoritative.
  const path = join(await r.song.directoryFor(r.songId), "composer.json");
  const document = JSON.parse(await readFile(path, "utf8"));
  document.writes = [];
  await writeFile(path, JSON.stringify(document));
  const retried = await r.reopen().save(old);
  assert.equal(retried.draft.text, "Canonical");
  assert.equal(retried.conflicts[0]?.draft.text, "Latest conflict");
});

test("HTTP composer saves permit old-song delivery while actual chat remains song-bound and idempotent", async (t) => {
  const r = await rig(t);
  const initial = await r.store.read(r.songId);
  const other = await r.song.create("Morning Train");
  let executions = 0;
  const switching = { isSwitching: true };
  const server = new OdeServer({ config: {}, song: r.song, composer: r.store, songs: switching, sessions: { current: {
    accept: async (request: { text: string; requestId: string }) => { if ((await r.conversations.log(r.song.songId).beginOnce(request.text, request.requestId)).created) executions++; },
  } } } as unknown as ServerDeps);
  const local = server as unknown as { app: Hono; token: string; modifyingRequests: number; routeApi(): void; guard: any; authorize: any };
  local.app.use("*", (context, next) => local.guard(context, next));
  local.app.use("*", (context, next) => local.authorize(context, next));
  local.routeApi();
  const send = (path: string, body: unknown, method = "POST") => local.app.request(`http://localhost:0${path}`, { method, body: JSON.stringify(body),
    headers: { host: "localhost:0", origin: "http://localhost:0", cookie: `ode=${local.token}`, "content-type": "application/json" } });
  const savedResponse = await send(API.composer, r.write(initial, draft("Keep the human timing")), "PUT");
  assert.equal(savedResponse.status, 200);
  assert.equal(local.modifyingRequests, 0);
  assert.equal(r.song.songId, other.id);
  const saved = await savedResponse.json() as ComposerState;
  const preparedResponse = await send(API.composerSend, { songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft });
  assert.equal(preparedResponse.status, 200);
  const prepared = await preparedResponse.json() as ComposerState;
  switching.isSwitching = false;
  const chat = { songId: r.songId, requestId: prepared.pending!.requestId, text: prepared.pending!.payload };
  assert.equal((await send(API.chat, chat)).status, 409);
  assert.equal(executions, 0);
  await r.song.open(r.songId);
  const accepted = await send(API.chat, chat);
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json() as { composer: ComposerState }).composer.draft.text, "");
  assert.equal((await send(API.chat, chat)).status, 200);
  assert.equal(executions, 1);
});

test("replaying a stopped preparation never returns another window's pending words", async (t) => {
  const r = await rig(t);
  const saved = await r.store.save(r.write(await r.store.read(r.songId), draft("Original clicked words")));
  const prepare = { songId: r.songId, writerId: r.writerId, writeId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft };
  const first = await r.store.prepare(prepare);
  const stopped = await r.store.cancel({ songId: r.songId, requestId: first.pending!.requestId });
  const writer = randomUUID();
  const other = await r.store.save(r.write(stopped, draft("Other window's words"), writer));
  const pending = await r.store.prepare({ songId: r.songId, writerId: writer, writeId: randomUUID(), baseRevision: other.revision, snapshot: other.draft });
  await assert.rejects(r.store.prepare(prepare), /stopped or replaced/);
  assert.equal((await r.store.read(r.songId)).pending!.requestId, pending.pending!.requestId);
});

test("attachment append refuses an oversized draft before creating an asset or invalid storage", async (t) => {
  const r = await rig(t);
  const bytes = encodeWav({ sampleRate: 16000, channels: [new Float32Array(16)] });
  const entries = [];
  for (let index = 0; index < 4; index++) {
    const audio = await r.audio.add({ name: `${"r".repeat(100)}${index}.wav`, bytes, purpose: "reference" });
    entries.push({ entryId: randomUUID(), id: audio.id, name: audio.name, scope: "reference" as const });
  }
  const large = { ...draft("\n".repeat(24000)), attachments: entries };
  const saved = await r.store.save(r.write(await r.store.read(r.songId), large));
  await assert.rejects(r.store.attach({ songId: r.songId, writerId: r.writerId, entryId: randomUUID(), baseRevision: saved.revision, snapshot: saved.draft,
    scope: "reference", audio: { name: `${"x".repeat(250)}.wav`, bytes, purpose: "reference" } }), /too large/);
  assert.equal((await r.reopen().read(r.songId)).draft.text, large.text);
  assert.equal((await r.audio.search("")).length, 4);
});
