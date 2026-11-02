import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReferenceFiles } from "../mneme/references";
import { ComposerStore } from "../mneme/composer-store";
import { ConversationStore } from "../mneme/conversations";
import { SongStore } from "../mneme/song-store";
import { userPaths } from "../mneme/paths";
import { LocalAudioFiles } from "../live/local-audio-files";
import { chatContextSize } from "../services/capabilities";
import { OdeApi } from "../ui/app/api";
import { encodeMonoWav } from "../ui/app/microphone";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8Z8AAAAASUVORK5CYII=", "base64");
async function rig(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ode-references-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, refs: new ReferenceFiles(root, join(root, "temp")) };
}

test("oversized folder selections are refused before starting an upload", async () => {
  const file = new File(["x"], "brief.txt");
  await assert.rejects(new OdeApi().importReference({ folder: "too-many", files: Array.from({ length: 257 }, (_, i) => ({ file, path: `too-many/${i}.txt` })) }, {
    songId: randomUUID(), writerId: randomUUID(), entryId: randomUUID(), baseRevision: 0, snapshot: { text: "", textEditId: randomUUID(), attachments: [] },
  }), /256/);
});

test("selected images survive reopening and reach context as their original image bytes", async t => {
  const { root, refs } = await rig(t);
  const image = await refs.add([{ name: "mood.png", bytes: png }]);
  const reopened = new ReferenceFiles(root, join(root, "new-temp"));
  const content = await reopened.context([{ ...image, entryId: randomUUID() }]);
  const part = content.find(part => part.type === "image_url");
  assert.ok(part?.type === "image_url");
  assert.deepEqual(Buffer.from(part.image_url.url.split(",")[1]!, "base64"), png);
  if (process.platform !== "win32") assert.equal((await stat(join(root, "References", `${image.id}.bin`))).mode & 0o777, 0o600);
  assert.ok(chatContextSize([{ ...part, image_url: { url: "data:image/png;base64," + "a".repeat(200000) } }]).chars < 200);
});

test("recorded audio references retain their waveform in the agent context", async t => {
  const { refs } = await rig(t);
  const bytes = encodeMonoWav([Float32Array.from([0, 0.25, -0.25, 0.5])], 48_000);
  const recording = await refs.add([{ name: "Recording.wav", bytes }]);
  const content = await refs.context([{ ...recording, entryId: randomUUID() }]);
  const audio = content.find(part => part.type === "audio");
  assert.ok(audio?.type === "audio");
  assert.equal(audio.format, "wav");
  assert.deepEqual(Buffer.from(audio.data), Buffer.from(bytes));
});

test("attached folders keep paths and offer filtered pages without reading every file into context", async t => {
  const { refs } = await rig(t);
  const folder = await refs.add([{ name: "ideas/verse.md", bytes: Buffer.from("First line\nSecond line") }, { name: "ideas/mood.png", bytes: png }, { name: "ideas/.env", bytes: Buffer.from("PRIVATE_KEY=secret") }], "ideas");
  const page = await refs.list(folder.id, "verse", 0, 1);
  assert.equal(page.files.length, 1);
  assert.equal(page.files[0]!.path, "ideas/verse.md");
  assert.equal(page.skipped, 1);
  const excerpt = await refs.read(page.files[0]!.id, 0, 5);
  assert.equal(excerpt.media.length, 0);
  assert.equal((excerpt.text as { text: string }).text, "First");
  const context = await refs.context([{ ...folder, entryId: randomUUID() }]);
  assert.equal(context.some(part => part.type === "image_url"), false);
  assert.equal(JSON.stringify(context).includes("PRIVATE_KEY"), false);
  await assert.rejects(refs.add([{ name: "../escape.md", bytes: Buffer.from("x") }]), /Choose/);
});

test("image-only sends retain structured references through acceptance and restart", async t => {
  const { root, refs } = await rig(t);
  const song = new SongStore(userPaths(root), () => undefined), entry = await song.create("Reference trial");
  const conversations = new ConversationStore(join(root, "conversations"), 6), audio = new LocalAudioFiles(root, join(root, "temp"));
  const composer = new ComposerStore(song, conversations, audio, refs), initial = await composer.read(entry.id);
  const linked = await composer.attachReference({ songId: entry.id, writerId: randomUUID(), entryId: randomUUID(), baseRevision: initial.revision, snapshot: initial.draft, files: [{ name: "mood.png", bytes: png }] });
  const prepared = await composer.prepare({ songId: entry.id, writerId: randomUUID(), writeId: randomUUID(), baseRevision: linked.composer.revision, snapshot: linked.composer.draft });
  assert.equal(prepared.pending!.payload, "");
  const selected = await composer.attachments(entry.id, prepared.pending!.requestId);
  assert.equal(selected[0]!.kind, "image");
  await conversations.log(entry.id).beginOnce("", prepared.pending!.requestId, selected);
  assert.equal((await composer.accepted(entry.id, prepared.pending!.requestId)).draft.attachments.length, 0);
  const reopened = new ComposerStore(song, conversations, audio, refs);
  assert.deepEqual(await reopened.attachments(entry.id, prepared.pending!.requestId), selected);
  assert.equal((await conversations.log(entry.id).all())[0]!.attachments?.[0]!.id, linked.id);
});
