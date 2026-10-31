import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { audioHash, MusicAudio } from "../services/music-audio";
import { OpenAiCompatibleAudioUnderstander } from "../services/adapters/openai-compatible-audio";
import { encodeWav } from "../audio/wav";
import { AudioFileDecoder } from "../audio/decode";
import { LocalAudioFiles } from "../live/local-audio-files";
import { TempFolder } from "../mneme/paths";
import { JsonFile } from "../mneme/json-file";
import { listeningTools as mediaTools } from "../tools/daw/state/listening";
import type { ToolContext } from "../tools/define";

test("listening evidence stays bound to sent bytes, and only explicit Arrangement captures persist", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-audio-evidence-"));
  const temp = join(root, "tmp");
  await mkdir(temp);
  const originalFetch = globalThis.fetch;
  try {
    const pcm = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 12) * 0.2);
    const bytes = encodeWav({ sampleRate: 48_000, channels: [pcm] });
    const altered = encodeWav({ sampleRate: 48_000, channels: [pcm.map((value) => -value)] });
    const supplied = join(temp, "supplied.wav");
    await writeFile(supplied, bytes);
    let sent: any;
    globalThis.fetch = async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      await writeFile(supplied, altered); // A later disk edit must not repoint the captured observation.
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ audioAvailable: true, observations: "A short tone." }) } }] });
    };
    const listener = new OpenAiCompatibleAudioUnderstander({ provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "audio" });
    const folder = new TempFolder(temp);
    let rendered = "";
    const ctx = { config: { userDir: root, tempDir: temp }, temp: folder,
      services: { describeAudio: listener.describe.bind(listener) },
      live: { extension: { call: async (op: string) => {
        if (op === "song_get") return { tracks: [{ index: 0, kind: "audio", name: "Voice", tag: "voice" }], returnTracks: [] };
        rendered = await folder.file("wav"); await writeFile(rendered, bytes); return { path: rendered };
      } } } } as unknown as ToolContext;
    const tool = mediaTools.find((candidate) => candidate.name === "audio_describe")!;
    const input = await tool.run({ path: supplied, question: "Describe its attack" }, ctx) as any;
    assert.equal(input.source.sha256, audioHash(bytes));
    assert.equal(input.answer, "A short tone.");
    assert.equal(input.evidence.sources[0].sha256, audioHash(bytes));
    const payload = Buffer.from(sent.messages[0].content.find((part: any) => part.type === "input_audio").input_audio.data, "base64");
    assert.equal(input.evidence.payload.sha256, audioHash(payload));
    assert.notEqual(input.source.sha256, audioHash(await readFile(supplied)));
    const transient = await tool.run({ track: { tag: "voice" }, start: 0, end: 4, question: "Describe it" }, ctx) as any;
    assert.equal(transient.source.retained, false);
    assert.equal("path" in transient.source, false);
    assert.equal(JSON.stringify(transient).includes(rendered), false);
    assert.equal(await stat(rendered).then(() => true, () => false), false);
    assert.deepEqual(await readdir(join(root, "Audio")).catch(() => []), []);
    const capture = mediaTools.find((candidate) => candidate.name === "audio_capture")!;
    assert.equal(capture.changes, "memory");
    assert.equal(capture.mainAgentOnly, true);
    const retained = await capture.run({ track: { tag: "voice" }, start: 0, end: 4 }, ctx) as any;
    const kept = { source: retained };
    assert.equal(kept.source.retained, true);
    assert.equal(kept.source.provenance, "sdk-pre-fx-capture");
    assert.equal(await stat(rendered).then(() => true, () => false), false);
    const reopened = await new LocalAudioFiles(root, temp).open(kept.source.id);
    assert.deepEqual(await readFile(reopened.path), Buffer.from(bytes));
    assert.equal(reopened.sha256, audioHash(bytes));
    assert.equal(reopened.currentness, "unknown");
    await assert.rejects(tool.run({ path: supplied, track: { tag: "voice" }, start: 0, end: 4, question: "Describe it" }, ctx), /one source|mixed/i);
    const persisted = (await readdir(join(root, "Audio"))).sort(), stopRead = new AbortController();
    const freeze = MusicAudio.freeze;
    try {
      MusicAudio.freeze = async (path) => { const frozen = await freeze(path); stopRead.abort(); return frozen; };
      await assert.rejects(capture.run({ track: { tag: "voice" }, start: 0, end: 4 }, { ...ctx, signal: stopRead.signal }), /abort/i);
    } finally { MusicAudio.freeze = freeze; }
    assert.equal(await stat(rendered).then(() => true, () => false), false);
    assert.deepEqual((await readdir(join(root, "Audio"))).sort(), persisted, "Stop during capture reading must not retain another asset.");
    const stopPublish = new AbortController(), publish = JsonFile.writeAtomically;
    try {
      JsonFile.writeAtomically = async (...args) => { stopPublish.abort(); return publish(...args); };
      await assert.rejects(new LocalAudioFiles(root, temp).add({ name: "Stopped.wav", bytes, purpose: "reference" }, stopPublish.signal), /abort/i);
    } finally { JsonFile.writeAtomically = publish; }
    assert.deepEqual((await readdir(join(root, "Audio"))).sort(), persisted, "Stopped publication must remove its staged binary too.");
  } finally { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); }
});

test("a completed provider response without audio access is not a listening result", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = encodeWav({ sampleRate: 8_000, channels: [Float32Array.of(0.1, -0.1)] });
  const source = { bytes, source: { ...new AudioFileDecoder().inspect(bytes, "source.wav"), sha256: audioHash(bytes), bytes: bytes.length, capturedAt: new Date().toISOString() } };
  try {
    for (const content of [JSON.stringify({ audioAvailable: false, observations: "I cannot access the attached recording." }), "I cannot listen to attached recordings.", JSON.stringify({ audioAvailable: true, observations: "" })]) {
      globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
      const listener = new OpenAiCompatibleAudioUnderstander({ provider: "meta", baseUrl: "https://example.invalid/v1", apiKey: "offline", model: "audio" });
      await assert.rejects(listener.describe(source, "Describe the sound"), /Audio listening is incomplete/);
    }
  } finally { globalThis.fetch = originalFetch; }
});
