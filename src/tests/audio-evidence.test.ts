import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { encodeWav } from "../audio/wav";
import { LocalAudioFiles } from "../live/local-audio-files";
import { TempFolder } from "../mneme/paths";
import { MusicAudio, audioHash } from "../services/music-audio";
import { TOOL_AUDIO, type ToolContext } from "../tools/define";
import { listeningTools } from "../tools/daw/state/listening";

test("native audio reads and retained captures attach stable bytes before the temporary render disappears", async () => {
  const root = await mkdtemp(join(tmpdir(), "ode-capture-context-"));
  try {
    const folder = new TempFolder(root), bytes = encodeWav({ sampleRate: 8_000, channels: [Float32Array.of(0.1, -0.2)] });
    let rendered = "";
    const ctx = { config: { userDir: root, tempDir: root }, temp: folder,
      live: { extension: { call: async (op: string) => {
        if (op === "song_get") return { tracks: [{ index: 0, kind: "audio", name: "Voice", tag: "voice" }], returnTracks: [] };
        rendered = await folder.file("wav"); await writeFile(rendered, bytes); return { path: rendered };
      } } } } as unknown as ToolContext;
    const read = listeningTools.find(tool => tool.name === "audio_read")!;
    const result: any = await read.run({ track: { tag: "voice" }, start: 0, end: 4 }, ctx);
    assert.equal(result.source.retained, false);
    assert.equal("path" in result.source, false);
    assert.equal(await stat(rendered).then(() => true, () => false), false);
    assert.deepEqual(Buffer.from(result[TOOL_AUDIO][0].content.data), Buffer.from(bytes));

    const capture = listeningTools.find(tool => tool.name === "audio_capture")!;
    const retained: any = await capture.run({ track: { tag: "voice" }, start: 0, end: 4 }, ctx);
    assert.equal(retained.retained, true);
    assert.equal(retained.audioAttached, true);
    assert.equal(retained.sha256, audioHash(bytes));
    assert.equal(await stat(rendered).then(() => true, () => false), false);
    const opened = await new LocalAudioFiles(root, root).open(retained.id);
    assert.deepEqual(await readFile(opened.path), Buffer.from(retained[TOOL_AUDIO][0].content.data));

    const frozen = retained[TOOL_AUDIO][0].content.data;
    await writeFile(opened.path, encodeWav({ sampleRate: 8_000, channels: [Float32Array.of(0.8)] }));
    assert.equal(audioHash(frozen), retained.audioPayload.sha256, "Later file edits cannot change the material in context.");
    const stop = new AbortController(), freeze = MusicAudio.freeze;
    try {
      MusicAudio.freeze = async path => { const value = await freeze(path); stop.abort(); return value; };
      await assert.rejects(read.run({ track: { tag: "voice" }, start: 0, end: 4 }, { ...ctx, signal: stop.signal }), /abort/i);
    } finally { MusicAudio.freeze = freeze; }
  } finally { await rm(root, { recursive: true, force: true }); }
});
