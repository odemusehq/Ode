---
name: live-controls
description: Use when setting up native devices, loaded plugins, samples, routing, recording or clip edits, or guiding the musician through an unexposed Live command.
---

# Native Live workflow

Read the actual Set before choosing an operation. Discover only the tool schemas needed for this step with `tool_search`; named tools below are adapters to SDK/Max operations, not independent music engines. Native reads return request-scoped tokens; read again between writes and after any stale-state refusal. Inspect actual readback and listen to relevant processed audio.

## Instruments and presets

- `track_get`, `device_get` and `rack_get_chains` identify devices already in the Set and their exposed parameters. This is not an inventory of everything installed on the computer. The APIs expose neither the full Live Browser nor arbitrary plugin feature descriptions.
- `device_get_native_info` reads the actual LiveAPI object metadata, including its native class and exposed properties/functions. This describes Live's interface to that loaded device. Discover an existing named adapter for the operation; metadata does not create a new tool or reveal every plugin-internal feature.
- `track_insert_device` and `chain_insert_device` insert native Live defaults. Native instruments/effects can make the music; choose the source and its performance for this song. A loaded acoustic kit or sampled instrument may be the appropriate source.
- `plugin_get_presets` reads programs reported by an already-loaded PluginDevice. `plugin_set_preset` selects an actual returned index. This does not cover every plugin's internal preset browser or Live's `.adg`/`.adv` files.
- `device_show` reveals an existing device; `editor:true` opens a loaded plugin's own editor. Exposed controls use `parameter_read_display`/`parameter_set_display` or SDK raw parameters. An open editor does not give Ode access to every control inside it.
- For missing presets/Packs/plugins, name the desired source, track and purpose, then ask the musician to load it through Live's Browser or the plugin editor. Do not claim an installation, load or preset choice succeeded until fresh Set/device reads establish it. Audition a representative passage before extending the source through the song.

## Samples and drums

`groove_pool_get` reads grooves already loaded in this Set's native Groove Pool. To assign or clear one, read `clip_get_native`, then use `clip_set_groove` with its current token and the returned groove id/name, or null. Live performs the groove processing. This does not load `.agr` files, extract grooves or commit them into notes. If the pool lacks the intended groove, request its precise loading step in Live, then read it again. Native groove assignment is outside Ode's saved-state restoration.

- `simpler_replace_sample` loads an actual available file using the SDK. Native sample loading is not sample generation, source separation or automatic discovery of the factory library.
- `simpler_get_native`/`simpler_set_native` expose playback, voice, sample-region and slicing controls. Simpler itself performs transient/beat/region slicing. Manual slices use `simpler_slice` with actual sample-frame positions. Do not invent precise transient positions from a model's broad listening description.
- `drum_chain_get_native`/`drum_chain_set_native` expose choke groups and output notes. Input-note mapping uses `drum_pad_set_note`. Use real chain indices and mappings; a Drum Rack is not necessarily GM.
- Multisample instruments can contain layers and articulations that are inaccessible as a simple sample replacement. Preserve their setup and use exposed controls; guide the musician through any required editor work.

## Routing, recording and vocals

- `track_get_routing` returns current input/output choices and available identifiers. `track_set_routing` changes one choice; reread after selecting a type before selecting its channels.
- `song_create_return_track` creates an actual return. Then read its reference, insert effects and set actual SDK mixer sends. For Live's Compressor sidechain, use `compressor_get_sidechain`/`compressor_set_sidechain`, then the device's real sidechain enable/EQ controls.
- `song_get_transport` observes playback/recording, loop/punch and metronome state. `song_set_transport` controls rehearsal playback and loop/metronome setup. Prepare the requested input/track when useful, but the musician starts/stops vocal recording using Live's controls. Ode cannot enable Record or start playback while Record is active. Never interrupt a performance.
- A singer records the actual vocal in Live. Confirm audio-interface/microphone setup with the musician when it is outside the APIs. Inspect playback and Record state before rehearsal. The MIDI guide can be audible while practising, then muted with track_set for the real take; keep its notes and lyric/phrase bindings.
- `clip_get_native`/`clip_set_native` expose clip gain, pitch and markers. `clip_warp_marker` uses Live's own warp-marker edits. These are not pitch correction, automatic vocal alignment or a complete comping API. For unavailable comping/fades/automation, point to the exact clip, phrase or parameter and guide the musician through the native edit.

## A hummed melody

Live has **Convert Melody to New MIDI Track**, a clip conversion command rather than a separate humming plugin. It can convert an isolated monophonic sung, whistled or hummed recording. This command is not exposed by the checked Extension SDK or Max tools.

1. Prepare an audio track and guide the musician through recording the isolated idea themselves, or locate their existing recording.
2. `clip_show` reveals that clip. Ask them to right-click its clip header and choose **Convert Melody to New MIDI Track** (also in Live's Create menu). Availability depends on their Live edition and content.
3. After they finish, read `song_get`/`track_get` and `midi_clip_get_notes` on the created material. Audition and discuss corrections; the converted MIDI is a starting point, not the singer's actual audio performance.

There is no local pitch detector, model-to-MIDI transcription substitute or hidden invocation of this menu command.

## Mixing and limits

`track_get_meters` reads native 0..1 peak/hold meters during playback. It does not yield LUFS, true peak or gain reduction. Use actual accessible analyser/plugin readings when available; otherwise open the relevant device and ask the musician to read it. Do not infer measured loudness from limiter settings or an LLM answer. Use actual processed captures and `audio_describe`/`audio_compare` for musical decisions.

Timed automation curves, general Browser/preset loading, arbitrary plugin UI operations and full comping remain musician-performed where no tool exposes them. State the specific step and purpose, let the musician do it, then reread the result and continue. Use the existing chat/question flow; no extra workflow panel or pretend tool is needed.

Native routing, plugin programs, sample/clip controls and transport are not all represented in Ode's saved-state History. Keep before/after observations and explain a relevant restoration limit; never promise complete restoration. Native Undo coverage also depends on Live and the plugin. The musician saves/exports the finished Set in Live.

Official references: [audio-to-MIDI](https://www.ableton.com/en/manual/converting-audio-to-midi/), [PluginDevice](https://docs.cycling74.com/apiref/lom/plugindevice/), [Track](https://docs.cycling74.com/apiref/lom/track/), [Clip](https://docs.cycling74.com/apiref/lom/clip/), [SimplerDevice](https://docs.cycling74.com/apiref/lom/simplerdevice/).
