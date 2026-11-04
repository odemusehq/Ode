# Tools and permissions

A model can describe a bass edit in words without changing a single note. Ode's tools provide the executable connection: each has a name, documented arguments, an input schema, and application code that performs a particular operation. The agent requests a tool call, Ode checks and runs it, and the resulting data returns to the conversation so the model can decide what to do next.

The tools cover more than Live editing. Some read artist context, ask a lyric model for a proposal, reopen a reference, or ask the musician a question. Keeping those operations explicit lets the application report what actually happened and apply different access and scheduling rules. [ToolRegistry](../src/tools/index.ts) assembles the registry, while [AgentTools](../src/harness/agent-tools.ts) exposes it to the agent runtime through MCP, the Model Context Protocol.

## The five functional groups

The reviewed Ode `0.3.1` registry contains 119 tools in five groups. The counts below cover tools registered by `ToolRegistry`; runtime additions and SDK-provided tools are explained separately. The groups describe the purpose of a capability, rather than the programming interface it uses or the permissions it receives.

| Group | Registered tools | Purpose | Examples |
| --- | --- | --- | --- |
| `daw_write` | 54 | Create or edit native project material and controls through SDK or Max routes. | `midi_clip_set_notes`, `track_insert_device`, `parameter_set_display`, `song_set_transport`. |
| `daw_read` | 37 | Inspect the project, find and open material, or obtain audio for listening. Some operations change temporary native state or retain an asset. | `midi_clip_get_notes`, `project_map_get`, `processed_audio_capture`, `sample_files_search`. |
| `mneme` | 19 | Read or maintain artist context, song data, production checkpoints, history observations, and the retained audio catalogue. | `memory_recall`, `lead_sheet_update`, `production_task_patch`, `library_audio_open`. |
| `lyrics` | 6 | Read and write lyrics, request model interpretation, and retain explicit pronunciation, emphasis, and melody associations. | `lyrics_read`, `lyricist`, `lyrics_write`, `lyrics_bind_melody`. |
| `operations` | 3 | Ask the musician or read explicitly attached references. | `ask_musician`, `reference_list`, `reference_read`. |

The DAW groups are assembled in [src/tools/daw/index.ts](../src/tools/daw/index.ts). Their contents include both SDK-backed operations and Max-backed tools. The persistent-context group is assembled in [src/tools/mneme/index.ts](../src/tools/mneme/index.ts); its name does not mean every tool in it changes memory. For example, `version_get` inspects a saved version. History restore and Ode Undo are separate application actions reached through the HTTP API, rather than model tools hidden inside that group.

The grouping also does not prescribe a sequence. A bass request might combine a project read from `daw_read`, a song-context read from `mneme`, and a note edit from `daw_write`. A lyric request can call `lyricist` for a proposal and then `lyrics_write` to apply chosen words. The model chooses the combination required by the musician's request.

## Mutation policy is a separate declaration

Every registered tool declares `changes: "none"`, `"set"`, or `"memory"`. The harness uses this metadata when deciding which calls can overlap, whether a producer subagent can use the tool, and whether Manual mode must wait for Apply. The functional group is not used as a replacement for this declaration.

`"set"` classifies native state changes, including temporary routing and transport changes. `"memory"` classifies persistent application updates such as lyric text, artist preferences, or a retained audio asset. `"none"` is the application's observation or computation classification. It does not guarantee a pure function, no filesystem writes, or no provider request: opening an audio asset can create a temporary copy, and a lyric interpretation can contact a model.

The distinction is visible in the listening path:

| Tool | Group | Declared change | Consequence |
| --- | --- | --- | --- |
| `processed_audio_sources` | `daw_read` | `set` | Briefly changes native auxiliary routing to discover sources; follows Manual Apply. |
| `processed_audio_capture` | `daw_read` | `set` | Can change routing, audibility, and playback while recording; follows Manual Apply. |
| `audio_capture` | `daw_read` | `memory` | Retains an SDK pre-effects source capture in the persistent audio catalogue; follows Manual Apply. |
| `sample_file_open` | `daw_read` | `none` | Opens selected bytes as a temporary copy without retaining a catalogue asset. |
| `library_audio_open` | `mneme` | `none` | Reopens an already-retained recording as context without making a new capture. |
| `lyricist` | `lyrics` | `none` | An ordinary call returns a proposal; `analyse: true` instead saves annotations without rewriting words or notes. |

The last row is a material qualification to the classification. `lyricist` can persist annotation state despite its `none` declaration, and `lyrics_read` can refresh stored melody observations. The current policy follows those declared values. It should not be described as a guarantee that observation tools leave every piece of local song state untouched.

## What a tool definition contains

[OdeTool](../src/tools/define.ts) is the shared definition. Its `name` identifies the operation; its `description` explains when and how to call it. `input` is a Zod schema, used to validate and normalise arguments and expose the corresponding JSON shape to the model. `run` is the application implementation, supplied with a context containing the active song, native bridges, stores, services, request identity, and cancellation signal.

The remaining fields refine behaviour:

| Field | Role in the implementation |
| --- | --- |
| `changes` | Declares the mutation treatment used by access checks, approvals, and scheduling. |
| `mainAgentOnly` | Excludes the tool from the producer's registry access even if it declares `none`. |
| `backgroundMemory` | Allows designated artist-memory maintenance to remain quiet in Manual mode. |
| `consent` | If set, requests approval in every mode. The flag is supported by the contract; no current registered tool declares it, and it does not imply a voice-synthesis feature exists. |
| `alwaysLoad` | Marks a schema for early availability; it grants no execution permission. |
| `describe` | Produces a public activity or approval description using the latest available object names. |
| `observationTargets` | Supplies target information for a saved tool observation when the tool needs more precise attribution. |

Native target identities are separate from these public labels. A label such as “Bass” helps the musician recognise an action, but the writer uses a structured clip or device reference and the relevant native guards. A displayed name alone does not establish that the target is unique or unchanged.

## Main agent, producer, and runtime tools

The main agent can request every registered tool, subject to the application gate. The producer subagent's registry access is defined by `changes === "none" && !mainAgentOnly`. In this version that admits 47 registry tools. It excludes the declared Set and persistent-memory writers, as well as main-only observations such as processed-source discovery. `ask_musician` is main-only despite its `none` declaration, so a producer cannot hand control to the musician directly.

This is the precise meaning of the producer's “read-only” role. It can inspect material, request an interpretation, and return proposals, but cannot invoke the explicit native or lyric-text writer tools. The annotation and cache effects described above still apply. A runtime hook also restricts delegation to Ode's `producer` type, prevents producers from delegating again, rejects background delegation, and limits the number of producer calls within the request. The producer inherits the selected main model.

Some tools sit outside the five registry groups. `AgentTools` adds `skill_read` for bundled workflow guidance and adds `production_execute` when a request has production-run handling. The latter checks a declaration of current execution intent; it does not replay a saved operation list. The SDK supplies `Agent`, `WebSearch`, and `WebFetch`, with their handling defined by [AgentLoop](../src/harness/loop.ts). MCP tools have internal names prefixed with `mcp__ode__`, and runtime aliases map Ode's plain tool names to those registrations.

The code retains schema-discovery metadata and registry search helpers, but [AgentEnvironment](../src/harness/agent-environment.ts) currently sets `ENABLE_TOOL_SEARCH=false` for the supported gateways. Tool registration must therefore not be presented as a guarantee of deferred, on-demand schema loading. Reading relevant skill text on demand remains a separate mechanism.

## From a model call to an implementation

For registry tools, the SDK's `PreToolUse` hook supplies the caller and tool-call identity. `AgentTools.authorize` checks the requested tool against that caller's available set, validates its arguments, and invokes the session gate. When permitted, it retains a one-use permit tied to that exact call identifier, tool name, and validated argument representation. The subsequent MCP invocation must match the permit before it can run. The runtime additions described above have separate handlers rather than automatically using this same permit path.

The session gate handles the interaction mode and the relevant approvals. Manual mode waits for Apply or Skip on changing calls. The three artist-memory maintenance tools can use the background-memory exception, while production checkpoint update and patch tools have an explicit exception. A deletion that the application judges outside supported recovery requires approval in either mode. Removing a lead-sheet lock also requests approval before the change proceeds. [OdeSession](../src/harness/session.ts) implements these rules.

Auto mode's instructions also tell the model to ask when the intended musical change is unclear. That is an agent-behaviour rule; the gate does not semantically prove that the musician's sentence authorises each proposed edit. The documentation therefore distinguishes prompt guidance from checks implemented in application code.

After permission and scheduling, `ToolRegistry.run` validates again and resolves transport representations into actual inputs. For example, it expands a temporary MIDI material reference into exact notes, or resolves a revision-bound lyric excerpt into the intended full text. Relevant lock checks run against current song and snapshot data before the implementation is invoked. Native writers then apply their own target, state, or read-token guards. Validation and comparison serve different purposes: a well-formed argument can still refer to stale material.

## Dispatch and concurrency

Calls declared `none` can be admitted concurrently by the harness, up to a limit of six. A call declared `set` or `memory` waits for earlier tracked calls, and later reads wait for that change. This is an application-level ordering policy, not a promise of six simultaneous native operations.

An SDK-backed tool normally uses `ctx.live.extension.call`, which reaches [InProcessLive](../src/live/extension/in-process-live.ts) and the native [OperationRegistry](../src/live/extension/ops/registry.ts). Operations dispatched through that registry execute in its serial queue and resolve their references after earlier work has settled. It also asks Live for a callback-based connection confirmation before and after an operation. A failed final confirmation can leave an issued edit unconfirmed, so a failed response is not an instruction to repeat the edit blindly.

Max-backed tools use the paired window bridge's specific control channels. [MaxAudioCapture](../src/server/max-audio.ts) permits one current audio job; [MaxParameterControl](../src/server/max-parameters.ts) and [MaxDawControl](../src/server/max-daw.ts) have separate bounded pending queues. The device polls for commands and returns results authenticated to its session and job. These channel policies do not form one universal transaction lock across every possible background activity in Live.

`apply_as_one_undo_step` is another distinct mechanism. It accepts the native operation subset defined by the [batch tool](../src/tools/daw/actions/batch.ts), validates the member calls, and passes them to the SDK batching path. It is not a wrapper for an arbitrary list of all 119 tools, so a Max-backed display-value write or a lyric-service request cannot be inserted just because it has a tool name. Creation followed by setup can still require two native transactions, reported in the result.

## Data identities and stale material

Coordinates depend on the operation. MIDI note starts and durations use quarter-note beats relative to the clip's start; Arrangement ranges use positions in the Set. A bar groups beats according to the time signature, so a beat count alone does not establish a bar position. The SDK snapshot can leave the current global time signature unknown. A scene's launch override does not establish that global value; the agent needs an actual available native observation before interpreting bar coordinates. The [shared note schemas](../src/shared/live-schemas.ts) and [snapshot types](../src/shared/set-snapshot.ts) make these representations explicit.

`midi_clip_get_notes` returns exact supported note fields, a `notesHash`, and a `recoveryToken`. The hash identifies the observed note list, for example when associating lyric syllables with it. The recovery token binds an existing-note replacement to the native clip and its observed state during the extension's lifetime. `midi_clip_set_notes` expects that token in `expected.token` and consumes it on a successful write. A refused token requires a fresh read and a new decision about the current notes.

Max controls have their own read tokens and request scopes. A display-value or transport write checks its native target and relevant state rather than reusing the SDK note token. Lyrics use text and notation revisions, together with literal line and word anchors. These identities are not interchangeable simply because they all help detect stale input.

Large MIDI arrays can be held as request-scoped material references with an identifier, count, and hash. The registry resolves them before invoking the ordinary writer, preserving exact notes and their source restrictions without asking the model to copy every field repeatedly. Ending the request invalidates those temporary references. [MIDI material handling](../src/harness/midi-materials.ts) and the [input adapter](../src/tools/midi-material-adapter.ts) define this transport representation.

## Results, audio, and recovery evidence

The registry returns whether a call succeeded, its structured text result, any media, and available mutation receipts. The SDK-facing layer formats those into a tool result and emits public progress. A tool can also provide an observation record containing its validated inputs, outcome, and target information. A saved observation records what the tool reported at that time; it does not establish later currentness or artistic quality.

Audio and images travel as media, rather than becoming large JSON fields in History or artist memory. For Meta, captured audio is retained in request media handling and translated into actual audio input for the next model turn. A returned filename alone would not provide the waveform. The current Baseten and Modal agent transports cannot perform that attachment step, even if a selected model advertises audio support elsewhere.

Scoped recovery has narrower coverage than successful execution. The registry recognises covered receipts for `midi_clip_set_notes`, `midi_clip_modify_notes_native`, `lyrics_write`, `lead_sheet_update`, and `hook_retain`, including covered calls within a native batch. Other declared Set writers are marked unverified for this scoped-recovery purpose. An operation can therefore succeed and appear in observed History while Ode Undo refuses to invert it through a guarded receipt. [Memory and history](memory-and-history.md) explains how that differs from native Live Undo and History reconstruction.

Stop cancels the calling request and invalidates temporary MIDI material. The harness drains its tracked promises, but that does not certify that every dispatched native action was reversed or completed. The next observation must reconcile any uncertain host outcome. This is why exact results, recorded scope, and fresh reads matter throughout the [workflow](workflow.md).
