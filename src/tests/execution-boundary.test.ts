import assert from "node:assert/strict";
import { test } from "node:test";
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
  assert.equal(registry.group("processed_audio_capture"), "daw_read");
  assert.equal(registry.group("memory_record"), "mneme");
  assert.equal(registry.group("lyrics_write"), "lyrics");
  assert.equal(registry.group("ask_musician"), "operations");
  for (const name of ["midi_clip_get_notes", "midi_clip_set_notes", "track_create_midi_clip", "audio_read", "lyricist"]) {
    assert.ok(registry.find(name), `${name} must remain available`);
  }
});
