import assert from "node:assert/strict";
import { test } from "node:test";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SimplerOperations } from "../live/extension/ops/simpler";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

test("Ode offers execution adapters without its own music or audio engines", () => {
  const registry = new ToolRegistry({} as ToolContext);
  for (const name of ["hum_to_midi", "audio_analyze", "mix_check", "library_audio_excerpt", "melody_write", "melody_vary",
    "drum_groove_write", "bassline_write", "harmonize", "voice_chords", "song_form_plan", "harmony_vocals_write",
    "syllables", "stress", "rhyme_find", "rhyme_scheme", "lyrics_analyze", "prosody_check", "singability_check",
    "set_lyrics_to_melody", "lyrics_fit_melody", "originality_check", "notes_check", "notes_edit", "notes_transform",
    "cover_art_create", "cover_art_choose", "release_prepare", "demo_vocal_render", "voice_reference_set", "voice_reference_clear",
    "sound_generate", "sample_from_recording", "vocal_transcribe", "audio_delivery_add", "audio_delivery_list", "audio_delivery_read"]) {
    assert.equal(registry.find(name), undefined, `${name} must not run a bespoke domain algorithm`);
  }
  assert.equal(registry.group("parameter_set_display"), "daw_write");
  assert.equal(registry.group("import_into_project"), "daw_write");
  assert.equal(registry.group("processed_audio_capture"), "daw_read");
  assert.equal(registry.group("memory_record"), "mneme");
  assert.equal(registry.group("lyrics_write"), "lyrics");
  assert.equal(registry.group("ask_musician"), "operations");
  for (const name of ["midi_clip_get_notes", "midi_clip_set_notes", "track_create_midi_clip", "audio_read", "lyricist"]) {
    assert.ok(registry.find(name), `${name} must remain available`);
  }
});

test("loaded samples survive removal of the temporary audition file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ode-sample-"));
  try {
    const source = join(dir, "audition.wav"), project = join(dir, "Project", "kick.wav");
    await mkdir(join(dir, "Project"));
    await writeFile(source, "sample bytes");
    let loaded: string | undefined;
    const operations = new SimplerOperations({
      live: { resources: { importIntoProject: async (path: string) => { await copyFile(path, project); return project; } } },
      refs: { simpler: () => ({ replaceSample: async (path: string) => { loaded = path; return { filePath: path }; } }) },
    } as never).table();
    const result = await operations.simpler_replace_sample.prepare({ device: { track: { index: 0 }, index: 0 }, filePath: source }, {} as never)();
    await rm(source);
    assert.equal(await readFile(result.filePath, "utf8"), "sample bytes");
    assert.equal(loaded, project);
    await assert.rejects(operations.simpler_replace_sample.prepare({ device: { track: { index: 0 }, index: 0 }, filePath: source }, {} as never)(), /ENOENT/);
    assert.equal(loaded, project, "A failed import must leave the playing sample intact.");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
