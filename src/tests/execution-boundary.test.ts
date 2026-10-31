import assert from "node:assert/strict";
import { test } from "node:test";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";

test("Ode offers execution adapters without its own music or audio engines", () => {
  const registry = new ToolRegistry({} as ToolContext);
  for (const name of ["hum_to_midi", "audio_analyze", "mix_check", "library_audio_excerpt", "melody_write", "melody_vary",
    "drum_groove_write", "bassline_write", "harmonize", "voice_chords", "song_form_plan", "harmony_vocals_write",
    "syllables", "stress", "rhyme_find", "rhyme_scheme", "lyrics_analyze", "prosody_check", "singability_check",
    "set_lyrics_to_melody", "lyrics_fit_melody", "originality_check", "notes_check", "notes_edit", "notes_transform"]) {
    assert.equal(registry.find(name), undefined, `${name} must not run a bespoke domain algorithm`);
  }
  for (const name of ["midi_clip_get_notes", "midi_clip_set_notes", "track_create_midi_clip", "audio_describe", "lyricist"]) {
    assert.ok(registry.find(name), `${name} must remain available`);
  }
});
