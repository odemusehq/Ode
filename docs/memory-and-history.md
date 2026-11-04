# Memory and history

Ode retains several kinds of state because a musical collaboration needs more than the latest message. Artist memory describes preferences and observed habits. Song data holds the working brief, lyrics, and score associations. Conversations preserve what was requested and what happened during a run. History records supported project observations and the evidence available for recovery.

These stores serve different purposes. Remembering that a musician prefers a sparse verse does not establish the current bass notes. A saved plan does not establish that its steps were performed. A snapshot does not replace the Live project file or preserve every internal plug-in state. Ode combines stored context with fresh native reads before acting.

## Where data lives

The installed extension receives a persistent storage directory and a temporary directory from Live. Persistent storage holds settings, songs, memory, attachments, and conversations. Temporary storage holds renders and working files that Live may clear between sessions. During development, `ODE_USER_DIR` selects the folder that stands in for persistent extension storage.

The main persistent locations are:

| Location within storage | Contents |
| --- | --- |
| `settings.json` | Provider choices, credentials, lyrics settings, and configured sample folders. |
| `Preferences/preferences.json` | Interaction mode and typed artist preferences. |
| `Artist/` | Remembered facts, habits, and the artist's song index. |
| `Songs/songs.json` | Ode's song list and selected song identity. |
| `Songs/<id>/song.musicxml` | The authoritative song document, including lyrics, score associations, and Ode metadata. |
| `Songs/<id>/versions/` | Version entries and supported-state snapshots. |
| `.workspace/conversations/` | Ode's persisted conversations and activity. |
| `Audio/` and `References/` | Retained audio and reference material with metadata. |
| `Agent/` | Agent-runtime configuration and conversation workspaces. |

[userPaths](../src/mneme/paths.ts), [SongStore](../src/mneme/song-store.ts), and [OdeApp](../src/server/app.ts) establish the main layout. Ode's song identity is distinct from Live's `.als` project identity: selecting a song in Ode changes its stored context, while native tools act on the Set open in Live. Switching the stored song does not load another Live file.

## Remembering an artist without freezing their direction

Mneme is Ode's local artist-memory store. A fact can apply across the artist's work or only to one song. It also records whether the content is a preference or musical material, and whether it was explicitly **said** by the musician or tentatively **noticed**. Those distinctions let the agent use a past observation without treating it as a permanent instruction.

For example, “Use UK pronunciation for this song” is explicit song context. Hearing a restrained vocal in one passage is a narrower observation, whose evidence and authorship matter. A passage composed by Ode is not evidence that the musician has adopted that style. The store rejects an Ode-authored observation recorded as an artist preference, and does not allow a noticed fact to overwrite an explicit statement.

Facts can be corrected by identity or forgotten. Inferred confidence fades with age; the configured half-life is 180 days. Habits keep weighted counts of kept and rejected outcomes, with context and song scope. These records can help a later request, but current artistic direction remains authoritative. [Mneme](../src/mneme/artist.ts) implements storage and ranking; the [memory tools](../src/tools/mneme/memory.ts) provide agent access.

The whole database is not copied into each message. [ContextSummary](../src/mneme/summary.ts) selects relevant preferences, song information, and a small amount of earlier material within a character budget. The current defaults allow a 2,000-character summary, alongside a separate project map. More detail is available through reads when needed. This keeps memory useful as context without confusing it with a complete observation of the Set.

## Song documents and conversations

A song's authoritative document is `song.musicxml`. MusicXML is a structured format for musical notation; Ode uses it to retain lyric-to-note associations, measure information, and its own song metadata in one document. A legacy `song.json` can be read when no MusicXML document exists. If the MusicXML is damaged, the song reader reports the problem and leaves it intact rather than silently replacing it with empty data or an older JSON copy. [SongFile](../src/mneme/song-file.ts) owns that behaviour.

Conversation storage is separate from the song document. A request can retain its identity, attachments, reply, activity, and completion or interruption state. This supports request-delivery retries and recovery of public progress after the interface closes. The agent runtime also persists its own conversation transcript so an SDK session can resume when the selected model configuration still matches.

For longer work, a song can hold a production checkpoint with a brief, steps, blockers, and evidence references. Updating this checkpoint records a plan and progress; it does not execute stored operations or schedule a future run. The active request must authorise execution, and the agent must reconcile the checkpoint with the current project. [ProductionTaskStore](../src/mneme/production-task.ts) and [ProductionRun](../src/harness/production-run.ts) connect that continuity to the live request.

## What History records

Before an ordinary agent request, Ode reads the supported Set state and compares it with the latest recorded version. Changes since the earlier observation can be stored as musician edits. After the run, it reads again and records the observed result. History can also refresh when the interface regains focus and the session is idle. It is therefore a record of observations at these boundaries, not a recording of every gesture in Live.

Versions store state differences, with periodic full snapshots to make reconstruction practical. The current default writes a full snapshot every 20 versions. The recorded data includes supported tracks, clips and MIDI notes, exposed device parameters and mixer values, and the associated song document. [VersionHistory](../src/mneme/version-history.ts) handles the version log, while [SetDiff](../src/mneme/set-diff.ts) describes changes between observations.

Attribution needs more evidence than a before/after difference. For supported writers, mutation receipts capture the affected material and its actual before/after state. [VersionRecorder](../src/server/version-recorder.ts) compares their combined effect with the final observation before labelling a version as Ode's work. A mismatch or an unsupported writer can leave the version attributed as observed, preserving the change without claiming that Ode caused every difference.

If a run is interrupted before its result can be observed reliably, a durable pending marker preserves that uncertainty. Ode attempts to resolve it before treating later differences as hand edits. This matters when a native call completed just before the agent or host stopped: replaying it or assigning the result to the musician would both misrepresent what happened.

## Native Undo, Ode Undo, and History restore

**Live's Undo** belongs to the host. Ode can group compatible native edits, but Live decides the actual Undo entries, and creation followed by setup may span more than one transaction.

**Ode's Undo and Again** use guarded mutation receipts. Undo attempts to invert the covered writes while preserving other material. Again performs that inverse before requesting another take. If the necessary receipts are absent, unverified, already used, or incompatible with the current state, Ode can refuse instead of rolling back the whole observed Set. [VersionActions](../src/server/version-actions.ts) implements these actions.

**History restore** reconstructs supported observed state. Its planner compares current and target state and prepares native operations. It can block reconstruction that would remove material it cannot safely recreate, and reports unsupported or failed restoration steps. A preset's hidden sample layers, a plug-in's internal state, automation envelopes, and native controls outside the snapshot are not covered merely because their device or track appears in History. [RestorePlanner](../src/server/restore-planner.ts) and [RestoreRunner](../src/server/restore-runner.ts) define that boundary.

Saving the Set in Live remains necessary. Ode's local history and retained attachments do not constitute a saved `.als` file, a complete plug-in checkpoint, or Live's Collect All and Save operation.

## Files, credentials, and model requests

Attached audio and references are retained with identities and metadata so the agent can reopen them deliberately. A source description, tempo, or key supplied by the musician remains a declaration unless an actual supported observation establishes it. A file hash establishes identity, not whether a recording is current or musically suitable.

JSON stores validate their input and publish updates through a temporary file, close, and rename, so a reader sees a complete old or new file. Ode also syncs the staged file to disk where the host allows it. Live's installed extension host disables `fsync` through Node's Permission Model, so that specific restriction is tolerated; other sync failures still abort the write. Atomic replacement remains available, but a successful save under that restriction does not guarantee that the data has reached physical storage before a power loss. Updates to an individual store are serialised. The generic JSON reader can set a malformed document aside under an unreadable filename and use a default; this differs from the authoritative MusicXML reader, which reports damaged song data. [JsonFile](../src/mneme/json-file.ts) implements the shared mechanism.

Credential files request owner-only permissions, and the UI receives key-presence flags instead of saved key values. Selected context, audio, lyrics, and references can still leave the machine when they are required for a model call. The provider connection is described in [Architecture](architecture.md); local paths and credential import for source development are covered in [Development](development.md).
