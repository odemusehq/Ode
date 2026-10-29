# Ode

Ode is an AI co-writer and co-producer for Ableton Live. Right-click something in Live and choose **Ask Ode**: its chat opens in your browser, and its musical changes happen in the DAW. Replies carry compact change entries. Ode stores its supported snapshots and song data; these are not saved Live Sets or complete plug-in checkpoints, and restoration can refuse changes it cannot recover safely.

## Install
Ode is one Live extension for macOS or Windows. It targets the bundled Ableton Extensions SDK `1.0.0-beta.1` and requires a compatible Live beta with the Extensions settings page.

1. Download `Ode-<version>.ablx` from the latest release.
2. In Live, open Settings → Extensions and drop the file on the page.
3. Right-click a track and choose **Ode: Settings**: pick the provider (Meta, Baseten or Modal), the model and paste your key.

Then right-click a clip, a track or a time selection and choose **Ask Ode**. Keep the browser chat open beside Live. If the operating system cannot open the browser, Ode shows an address to copy into it. The address belongs to the current extension session; reopen it from Live after a restart. **Ode: Lyrics**, **Ode: History** and **Ode: Settings** open auxiliary views.

## Audio and host limits

Attach audio files in chat to make managed copies available to Ode. It can search those copies by filename and the source description you supply, then analyse supported WAV/AIFF files or import samples into the Live project. The catalogue contains explicitly uploaded files, not an inventory of Live's Browser, Packs or arbitrary folders. A known external audio path can also be imported through Live's `importIntoProject`; Ode does not read that external path directly.

For processed listening, export the required track, bus or Main range in Live and attach that bounce with its source description. Ode preserves the exact supplied bytes and file hash. Its effects, routing, range, tails and relationship to the current Set remain your declaration. A file hash proves file identity; it does not prove that the file reflects later edits. WAV/AIFF can be measured locally; other formats need a compatible WAV/AIFF export for analysis.

The installed SDK renders only pre-effects Arrangement audio tracks. It cannot render MIDI instruments, processed buses/returns/Main or the delivered master. It also has no transport/recording controls, automation-envelope authoring, arbitrary preset/plugin loading, project Save/Collect All or final master/stem export. Device settings do not verify their audible outcome. Save and export in Live, then supply the final file for measurement and release preparation. Current global meter is unavailable through this SDK; a scene's launch override does not establish it, so bar-based tools need an explicit meter.

The SDK exposes modal webviews, progress dialogs and context menus; it has no docked or nonmodal panel API. Ode's browser page uses its existing authenticated loopback server, and remains available while the extension is running. The operating-system browser opener is separate from the SDK UI contract. The SDK also limits extension filesystem access to its storage and temp directories, including code launched in child processes. Uploaded copies stay within those directories. See the bundled SDK guides `docs/essentials/interface/2-user-interface-with-webviews.html` and `docs/essentials/concepts/6-resources-and-filesystem.html`.

Existing-object batches can share one native Live Undo entry. Creating objects and subsequently setting their names or notes uses a second transaction; `apply_as_one_undo_step` reports `nativeTransactions` for that distinction. Live owns the actual undo history, including no-op edits. Ode's snapshot reconstruction is separate from native Live Undo.

## Develop
- Node.js 24.16 or later.
- The Ableton Extensions SDK: copy its `ableton-extensions-sdk` and `ableton-extensions-cli` packages (.tgz) into `vendor/`, a git-ignored folder that keeps the SDK on your machine.
- In Live beta, turn on Developer Mode (Settings → Extensions).

```bash
cp .env.example .env     # where Live is, and your development folder
npm install
npm run build:ui         # the dialogs' pages
npm run live:extension   # builds the extension and runs it in Live
```

`npm run release:package` builds `release/Ode-<version>.ablx`; a version tag (`npm version <x.y.z>`) makes the release on GitHub.

## Project layout
- `skills/` — songwriting and production skills the agent reads when a task calls for them
- `src/agents`, `src/harness` — the main agent, its subagents and Ode's agent loop
- `src/tools` — every tool the agent uses, including one per Live operation
- `src/music` — pronunciation, rhyme, prosody, melody, harmony, rhythm and audio analysis
- `src/services` — model providers and the bundled provider list
- `src/mneme` — memory of the artist and the songs, and Settings
- `src/server` — Ode's local server inside the extension, which the dialogs load from
- `src/live/extension` — the Live extension: Live's right-click menus and the SDK operations
- `src/ui`, `src/ui-kit` — the dialogs: Ask Ode, Lyrics, History and Settings

## License
This project is licensed under the PolyForm Strict License 1.0.0.
See [LICENSE](LICENSE) for details.

## Disclaimer
OdeMuse and Ode are independent and are not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc. or Ableton AG.

The "Muse" in OdeMuse is part of our brand, inspired by the Muses of Greek mythology. It was chosen before Meta released its Muse models and has no connection to them. Ode is not tied to any model provider and can use Meta's Muse models alongside others.

Meta is a trademark of Meta Platforms, Inc., and the Muse models are its products. Ableton and Ableton Live are trademarks of Ableton AG.
