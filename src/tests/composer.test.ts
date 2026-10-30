import assert from "node:assert/strict";
import { test } from "node:test";
import { Composer } from "../ui/app/composer";
import type { OdeApi } from "../ui/app/api";
import type { ComposerState, ComposerWrite } from "../shared/composer";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComposerStore } from "../mneme/composer-store";
import { ConversationStore } from "../mneme/conversations";
import { SongStore } from "../mneme/song-store";
import { userPaths } from "../mneme/paths";
import { LocalAudioFiles } from "../live/local-audio-files";
import { ApiError } from "../ui/app/api";

async function persistentComposer() {
  const root = await mkdtemp(join(tmpdir(), "ode-composer-client-"));
  const song = new SongStore(userPaths(root), () => undefined);
  const selected = await song.create("Night Bus");
  const conversations = new ConversationStore(join(root, "conversations"), 2);
  const store = new ComposerStore(song, conversations, new LocalAudioFiles(root, join(root, "temp")));
  const adapt = async <T>(work: Promise<T>): Promise<T> => {
    try { return await work; }
    catch (error) { const problem = error as { status?: number; message: string; composer?: ComposerState }; throw new ApiError(problem.status ?? 500, problem.message, problem.composer); }
  };
  const api = {
    getComposer: (id: string) => store.read(id),
    saveComposer: (write: ComposerWrite) => adapt(store.save(write)),
    prepareComposerSend: (write: Parameters<ComposerStore["prepare"]>[0]) => adapt(store.prepare(write)),
    resolveComposer: (write: Parameters<ComposerStore["resolve"]>[0]) => adapt(store.resolve(write)),
    cancelComposerSend: (write: Parameters<ComposerStore["cancel"]>[0]) => adapt(store.cancel(write)),
  } as unknown as OdeApi;
  return { api, store, songId: selected.id, conversations };
}

test("draft save acknowledgements keep later typing and queued writes stay ordered", async () => {
  let stored: ComposerState = { songId: crypto.randomUUID(), revision: 0, draft: { text: "", textEditId: crypto.randomUUID(), attachments: [] }, pending: null, conflicts: [] };
  let first!: () => void;
  const held = new Promise<void>((resolve) => { first = resolve; });
  const writes: ComposerWrite[] = [];
  const api = {
    getComposer: async () => structuredClone(stored),
    saveComposer: async (write: ComposerWrite) => {
      writes.push(write);
      if (writes.length === 1) await held;
      stored = { ...stored, revision: stored.revision + 1, draft: write.draft };
      return structuredClone(stored);
    },
  } as unknown as OdeApi;
  const composer = new Composer(api);
  await composer.open(stored.songId);
  composer.editText("first idea");
  const saving = composer.flush();
  await Promise.resolve();
  composer.editText("later words");
  first();
  assert.equal(await saving, true);
  assert.equal(composer.getSnapshot().draft.text, "later words");
  assert.deepEqual(writes.map((write) => write.draft.text), ["first idea", "later words"]);
  const oversized = "🎵".repeat(10_000);
  composer.editText(oversized);
  assert.equal(composer.getSnapshot().draft.text, oversized);
  assert.equal(await composer.flush(), false);
  assert.equal(writes.length, 2);
  composer.editText("short enough");
  assert.equal(await composer.flush(), true);
  composer.dispose();
});

test("accepted sends leave later identical typing and newly selected copies of audio intact", async () => {
  const audio = { entryId: crypto.randomUUID(), id: crypto.randomUUID(), name: "hook.wav", scope: "reference" as const };
  const stored: ComposerState = { songId: crypto.randomUUID(), revision: 1, draft: { text: "keep the hook", textEditId: crypto.randomUUID(), attachments: [audio] }, pending: null, conflicts: [] };
  const composer = new Composer({ getComposer: async () => structuredClone(stored) } as unknown as OdeApi);
  await composer.open(stored.songId);
  const sent = composer.capture()!;
  composer.editText("");
  composer.editText("keep the hook");
  composer.addAttachment({ ...audio, entryId: crypto.randomUUID() });
  composer.acknowledge(sent);
  assert.equal(composer.getSnapshot().draft.text, "keep the hook");
  assert.equal(composer.getSnapshot().draft.attachments.length, 1);
  assert.notEqual(composer.getSnapshot().draft.attachments[0]?.entryId, audio.entryId);
  composer.dispose();
});

test("lost prepare acknowledgements and browser reload retain one send id; confirmed Stop preserves a fresh unsent intention", async () => {
  const { api, store, songId, conversations } = await persistentComposer();
  const composer = new Composer(api);
  await composer.open(songId);
  composer.editText("keep the hook");
  assert.equal(await composer.flush(), true);
  const clicked = composer.capture()!;
  const prepare = api.prepareComposerSend.bind(api);
  let lost = true;
  api.prepareComposerSend = async (write) => { const saved = await prepare(write); if (lost) { lost = false; throw new Error("lost prepare acknowledgement"); } return saved; };
  await assert.rejects(composer.prepare(clicked), /lost prepare/);
  assert.equal(await composer.flush(), true);
  const pending = (await composer.prepare(clicked)).pending!;
  const reopened = new Composer(api);
  await reopened.open(songId);
  assert.equal(reopened.getSnapshot().pending?.requestId, pending.requestId);
  await conversations.log(songId).beginOnce(pending.payload, pending.requestId);
  await store.accepted(songId, pending.requestId);
  await reopened.cancelPending(reopened.pendingRequests());
  assert.equal(await reopened.flush(), true);
  assert.equal((await store.read(songId)).draft.text, "keep the hook");
  const next = (await reopened.prepare(reopened.capture()!)).pending!;
  assert.notEqual(next.requestId, pending.requestId);
  assert.equal((await conversations.log(songId).all()).length, 1);
  composer.dispose(); reopened.dispose();
});

test("a conflicting draft is recoverable after reload and Keep this draft keeps the displayed words", async () => {
  const { api, store, songId } = await persistentComposer();
  const first = new Composer(api), second = new Composer(api);
  await first.open(songId); await second.open(songId);
  first.editText("the first window's idea");
  assert.equal(await first.flush(), true);
  second.editText("the second window's idea");
  assert.equal(await second.flush(), false);
  const reopened = new Composer(api);
  await reopened.open(songId);
  assert.equal(reopened.getSnapshot().draft.text, "the second window's idea");
  await reopened.resolve("local");
  assert.equal(reopened.getSnapshot().draft.text, "the second window's idea");
  assert.equal((await store.read(songId)).draft.text, "the second window's idea");
  first.dispose(); second.dispose(); reopened.dispose();
});

test("a lost save acknowledgement cannot rebase later typing onto another window's intervening draft", async () => {
  const { api, store, songId } = await persistentComposer();
  const save = api.saveComposer.bind(api);
  let lost = true;
  api.saveComposer = async (write) => { const stored = await save(write); if (lost) { lost = false; throw new Error("lost save acknowledgement"); } return stored; };
  const first = new Composer(api);
  await first.open(songId);
  first.editText("A1");
  assert.equal(await first.flush(), false);
  first.editText("A2");
  const second = new Composer(api);
  await second.open(songId);
  second.editText("B1");
  assert.equal(await second.flush(), true);
  assert.equal(await first.flush(), false);
  const stored = await store.read(songId);
  assert.equal(stored.draft.text, "B1");
  assert.equal(stored.conflicts.find((entry) => entry.writerId === first.writerId)?.draft.text, "A2");
  first.dispose(); second.dispose();
});
