---
name: sound-design
description: Choose and shape actual instruments, samples and effects.
---

# Sound Design

Read track_get, device_get and rack_get_chains. Choose a source for the desired sound and performance. Insert native defaults with track_insert_device or chain_insert_device; suitable licensed samples/Packs and already-loaded plug-ins are welcome. Use Simpler sample loading only for actual available files. Read parameter_read_display before parameter_set_display for native units; parameter_set uses SDK raw units. Audition a short contextual Max capture before extending an unfamiliar sound across the song. Missing Browser/preset access is a concrete host step, never permission to substitute an unrelated default synth.

Reuse an already-loaded preset through song_duplicate_track when that suits the part: native duplication carries its instrument setup. Give the copy its own tag/name, prepare it muted and unarmed, inspect its copied devices/routing, and replace only the copy's musical material before auditioning. Preserve the original guide/track, compare the candidates in context, then deliberately keep or retire the unused candidate. A failed insert into an occupied chain does not establish that the instrument or native preset reuse is unavailable.

For each needed role, decide the intended attack, sustain, register, articulation and relationship to the other parts. Discover actual candidates before settling on a generic band or synth template. `sample_folders_get` and filtered `sample_files_search` explore configured folders; `library_audio_search` finds retained recordings. Narrow by path/query/format/kind facets and inspect a small useful result window. These are file facts, not Live Browser tags or proof of how a sample sounds. For audition, open a selected audio result with `sample_file_open`: supported audio is attached directly to your own next turn. Use `audio_read` to revisit a selected excerpt. Import chosen audio with `import_into_project`, then use the returned path in `simpler_replace_sample` or `track_create_audio_clip` as appropriate. Preset/device/groove files require their own supported native loader or an explicit Browser handoff.

Judge source and performance together in a representative musical passage. Compare another candidate when that resolves a real sound choice; additional layers or effects are not an improvement by count. If the source is wrong, reconsider it before spreading the part through the song. A preset name, varied velocity or successful note write does not establish convincing articulation or an audible production judgement.

Read `production/live-controls` for loaded-plugin preset selection/editor opening and native Simpler/Drum Rack controls. A plugin's reported program list differs from Live Browser presets. When a required source is inaccessible, reveal the target device where useful, explain exactly what the musician should load and why, then inspect the resulting native device and audition it.

Use the tool schemas exposed by the SDK; discover missing schemas with `ToolSearch` when available. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: optional detailed techniques and examples.

Optional sub-skills:
- `production/sound-design/drums`: Shape drum sounds in place in Live — choose, swap, layer, tune, trim and process the kick, snare, clap, hats, percussion and 808 in the Drum Rack or Simpler already on the track, b.
- `production/sound-design/synths`: Recipes for turning the synth on the selected track into a specific sound, in place — sub, synth, reese, acid and wobble basses, plucks, FM keys, organs, bells, pads, supersaws, br.
