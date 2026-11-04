# Live integration

Ode changes the same musical objects the musician edits in Live. It uses Ableton's Extensions SDK for most Set inspection and editing, and a Max for Live device for the floating interface, processed audio capture, and additional native controls. Understanding that division explains both the installation and the operations that still need a musician's hand.

This guide describes the integration in Ode `0.3.1`, targeting Extensions SDK `1.0.0-beta.1`. Ableton currently makes Extensions available in Live 12 Suite Beta, version 12.4.5 or later. SDK capabilities can change independently of Ode. [Ableton's compatibility requirements](https://www.ableton.com/en/live/extensions).

## The project and its signal path

A Live **Set** contains tracks. A MIDI track holds note instructions and normally uses an instrument device to turn them into sound. An audio track holds recordings or incoming audio. Both can have effect devices, such as an equaliser or compressor, followed by mixer controls for level and panning.

Clips can live in two views. **Arrangement View** places them on the song's timeline, where a clip has a start time. **Session View** places them in slots for launching and looping; a row of slots is a **scene**. Ode therefore needs more than a clip name to address material: a reference can identify a track and slot, or a track and Arrangement position. A **take lane** holds an alternate recorded passage beneath a track's main Arrangement lane.

Tracks can feed a **group**, which combines related parts, and send some signal to **return tracks**, often used for shared reverb or delay. The **Main** track receives the overall mix. Because several parts can pass through the same processing, changing or capturing one part can depend on tracks outside it.

Two useful terms describe where a recording comes from. **Pre-FX** means before effects, so it omits processing that changes the sound. **Post-mixer** means after the source's mixer controls. A recording from the Main device's input can precede the Main mixer; it should not automatically be described as the final output.

## What the extension does

An extension is a JavaScript application loaded by Live. Ode's [entry point](../src/live/extension/extension.ts) starts the application using the storage and temporary folders supplied by the host. It also registers Ask Ode on supported right-click targets, including clips, tracks, scenes, and Arrangement selections. The clicked object becomes explicit context for the next request.

The Extensions SDK exposes native objects and operations. Ode wraps those operations with typed tool inputs and returns plain data to the agent. [InProcessLive](../src/live/extension/in-process-live.ts) connects the application directly to the [operation registry](../src/live/extension/ops/index.ts) inside the extension process. This path does not use screen coordinates or simulated mouse actions to edit a note.

The implementation can inspect supported Set state, create and change tracks and clips, edit MIDI notes, insert supported native devices, and adjust exposed parameters. A native instrument executes the notes and produces audio. Ode's model chooses the performance; Ode does not hide a separate local melody or chord generator behind a native tool call.

## Why Ode uses both programming environments

The extension gives Ode a Node.js host for its HTTP server, stores, model adapters, and agent runtime. In the same application, the Extensions SDK supplies typed project objects and operations for tracks, clips, notes, and devices, plus context menus and native transactions. This makes a musician's right-click target and the subsequent edit part of one explicit application path.

Ode also needs to keep a companion window open while the musician works in Live, hear the actual output of instruments and effects, and access controls beyond the pinned SDK. Those requirements determine the role of Max. The following table describes Ode's implemented routes; it does not imply that the two Ableton APIs never overlap or that Max could not host more application logic in a different design.

| Requirement | Extensions SDK route in Ode | Why Max is used |
| --- | --- | --- |
| Read and edit project objects | SDK objects, references, operations, and transactions form the main editing path. | Additional native controls are implemented through the Max Live API where the SDK path does not expose them. |
| Keep the interface beside the Set | The pinned SDK exposes modal webview dialogs rather than Ode's persistent nonmodal window. | Max hosts a floating patcher window containing the React interface in `jweb`. |
| Inspect source audio | `renderPreFxAudio` renders supported Arrangement audio tracks before effects and faders. | No Max capture is needed merely to read that source audio. |
| Hear instruments, processing, or the mix | The source-audio renderer does not capture those signal stages. | The Max device records actual offered native routes through its signal graph. |
| Read and set displayed parameter units | The SDK tools expose raw parameter values. | Max uses native display values and formatted text, avoiding a guessed conversion to Hz or dB. |
| Control rehearsal and inspect further native state | Ode's pinned SDK operation set does not supply the needed transport and other controls. | Explicit Max bridges implement playback, routing, native note edits, and other listed operations. |

The modal-webview and filesystem contracts are documented in the SDK distribution's *User Interface with Webviews* and *Resources and Filesystem* guides. Ode's actual SDK audio route is implemented in [AudioOperations](../src/live/extension/ops/audio.ts); its Max routes are assembled by the [device builder](../src/live/max/device.ts). These version-specific sources matter more than assuming that every capability of Live is available through every API.

## What is inside the Max device

Max for Live is an environment for building devices that run inside Live. Ode packages its device as `Ode.amxd`. The [device builder](../src/live/max/device.ts) assembles the Max patch and embeds the scripts that provide its connection, window, audio capture, and controls. The device passes its main stereo audio through while making supported capture routes available.

The extension SDK's webview interface does not supply the persistent nonmodal panel Ode needs beside the Set. The Max device supplies that window through a `jweb` object, Max's embedded web browser, which loads Ode's React interface from the local server. Closing or opening that window does not require moving the agent application into a separate hosted website.

On macOS, this embedded browser needs Max 9.2 or later for ordinary Command-key editing. Cycling '74's [Max 9.2.0 release notes](https://cycling74.com/releases/max/9.2.0) identify the fix for command-key handling in Max for Live web views. Ode's message and settings fields use standard HTML controls, while its lyric text editor uses CodeMirror. Their editing behaviour therefore depends on the native browser delivering the keyboard commands. The [runtime setup](getting-started.md#select-the-max-runtime-on-macos) explains how to choose a newer Max when Live's bundled version is older.

The device also accesses the **Live Object Model**, a hierarchy of native objects such as the Set, tracks, clips, and device parameters. Ode's embedded JavaScript uses Max's `LiveAPI` object to read properties and invoke the specific functions implemented by its bridges. The official [Live API overview](https://docs.cycling74.com/userguide/m4l/live_api_overview/) explains that hierarchy and its access limits. Ode uses it for rehearsal playback, routing observations and edits, native MIDI-note controls, and displayed parameter values. These are explicit bridges; loading Max for Live does not expose every possible Live action to the agent.

The device contains four embedded script areas. [window.js](../src/live/max/window.js) handles pairing, command polling, and the floating webview. [audio.js](../src/live/max/audio.js) chooses native routes and controls a Max recording buffer. [parameters.js](../src/live/max/parameters.js) reads and sets native displayed parameter values. [daw.js](../src/live/max/daw.js) implements the enumerated transport, routing, clip, instrument, and other controls. The audio patch connects input signals to `record~` and a `buffer~`; the extension validates the returned samples and writes the retained file. Max handles native interaction and signal capture, while the agent and persistent application stores remain in the extension.

Pairing is automatic. The extension finds a single device with the expected native control signature and supplies a short-lived connection capability through its parameters. The bridge checks the current Set and device identity, and invalidates the connection when they change. A duplicate device is refused because the application cannot choose a unique partner. [MaxWindow](../src/live/extension/max-window.ts) owns discovery, while [MaxWindowBridge](../src/server/max-window.ts) owns the server side of the session.

The native scripts share one HTTP helper for this connection and for audio, parameter, and DAW replies. It explicitly supplies the loopback host and port in the `Host` header because Max 9.2.1's native client omits the port from its default header. This lets the request satisfy Ode's existing local-server guard; the private connection capability and session checks still apply. [The transport regression test](../src/tests/max-device.test.ts) runs the helper against the actual server guards and pairing code.

## From a native edit to a checked result

For existing MIDI replacement, the agent first reads the actual notes. The read provides a recovery token that the replacement writer can check against the current material. If the musician has changed it meanwhile, a stale replacement can be refused and must be reconciled with another read. Small native edits can address existing notes by their native IDs, preserving fields outside the requested change.

Large note collections can also travel as temporary MIDI material references. These references preserve the exact stored notes without requiring the model to copy a long array into every call. They are scoped to the current song and request, expire when it ends, and are resolved before an ordinary native writer runs. They do not generate or transform music on their own. [MIDI material handling](../src/harness/midi-materials.ts) and the [tool adapter](../src/tools/midi-material-adapter.ts) implement this path.

Parameters need a similar distinction between raw values and musical units. A raw control value does not necessarily map linearly to a frequency in hertz or a level in decibels. The Max-backed `parameter_read_display` and `parameter_set_display` tools use Live's actual display and native conversion, carrying read information so the target can be checked before writing. Setting an equaliser frequency this way establishes its setting; it does not establish the resulting audible balance. [Displayed parameter tools](../src/tools/daw/state/parameter-display.ts) expose the read side.

Compatible operations on existing objects can be grouped with `apply_as_one_undo_step`. Creating an object and then naming it or filling it with notes can require two native transactions. The tool reports `nativeTransactions`, and Live owns the resulting Undo history. The [batch tool](../src/tools/daw/actions/batch.ts) documents this distinction rather than promising one Undo press for every batch.

## How listening works

The SDK can render supported Arrangement audio tracks before their effects and faders. That route is useful for reading source recordings, but does not render the sound of a MIDI instrument, a processed group, or the final mix. For those questions, Ode uses its Max device.

The agent first requests `processed_audio_sources`, which returns the routes actually available in the current Set and their signal stages. It then calls `processed_audio_capture` with a source from that catalogue and a requested passage. Both tools declare `changes: "set"`: source discovery briefly changes auxiliary routing, and capture can change routing and playback. They therefore require Manual Apply and participate in the harness's change scheduling even though their functional group is `daw_read`. The Max device records the native audio, and the extension retains the resulting file with source and timing information. [Processed audio tools](../src/tools/daw/state/processed-audio.ts) connect that recording to the model's next turn.

To hear selected parts together, the capture path can use an existing group or supported Main post-mixer capture. For a selected Main capture, the device temporarily adjusts native audibility and excluded sends, then restores them. Shared Main processing and sidechain inputs can still affect the result. A sidechain is a signal another device uses to control its processing, such as the kick driving compression on the bass; preserving it can be essential to hearing the real passage.

With Meta selected, the recording arrives as audio content in the main conversation. The model can compare it with the brief and make another native edit. Retained recordings can be reopened later, including after context compaction. Source hashes establish which file was supplied, while the capture metadata records what the host reported; neither proves that the recording reflects edits made afterward.

Capture timing is approximate. Pre-roll, or playing a short lead-in before the requested passage, cannot recreate every plug-in's prior state. A short capture can also miss effect tails, such as reverb continuing after the last note. Ode preserves recording levels rather than loudness-matching comparisons. Its file code decodes, selects, and packages supported audio; it does not compute a certified loudness, true-peak, or mix-quality assessment. [MusicAudio](../src/services/music-audio.ts) defines the payload preparation.

## Files and operations that need a handoff

Audio attached in the interface becomes a managed local copy. The agent can search and reopen that catalogue. The separate sample-folder tools implement file searches under roots configured in Settings, using Node's filesystem API rather than Live's Browser. A result is a discovered file, not a Browser tag or proof of the sound's musical properties. [Sample-folder tools](../src/tools/daw/state/sample-folders.ts) distinguish discovery from opening a managed copy for listening.

Those tools remain subject to the extension host's filesystem contract. The pinned SDK's resources and filesystem guide defines extension storage and temporary directories as the supported boundary, including for child processes, and says stricter OS sandbox enforcement is planned. The installed host tested in Live beta 12.4.25b1 already enforces Node's Permission Model; for example, it rejects `fsync` even for a file Ode is allowed to write. Configuring an external folder does not grant SDK-supported access to it. Explicit file attachment instead supplies a managed copy. A known external audio path can also be passed to the SDK's `importIntoProject`, which lets Live perform the import on the host side without granting Ode arbitrary filesystem access.

Native default-device insertion differs from loading a Browser preset, which may include multisamples, layers, or internal state. Ode cannot generally browse and load arbitrary presets or third-party plug-ins. An already-loaded plug-in can expose reported programs and its editor through supported native tools, but that is a narrower operation. When a required loader is unavailable, the musician performs the specific Browser action and Ode rereads the result.

Recording a performance, converting a hummed recording through Live's native melody conversion, drawing unsupported automation, saving the Set, and final song export also require musician actions in Live. Ode can prepare and inspect supported surrounding state. It has no voice-cloning or singing-generation tool, and its History cannot reconstruct every native control or plug-in state. The [main agent instructions](../src/agents/ode.md) describe these handoffs; [Memory and history](memory-and-history.md) explains their recovery implications.
