# Ode

Ode is an AI co-writer and co-producer inside Ableton Live. It helps with every part of making a song — idea, lyrics, topline, chords, drums, bass, sounds, arrangement, vocals, mixing, mastering and release — in any order, while the musician stays the author. Right-click something in Live and choose **Ask Ode**: Ode changes the Set in place, checks the craft details with code, shows each step while it works, and keeps every version of the song so you can go back.

## Install
Ode is one Live extension. It needs Ableton Live 12 Suite on macOS or Windows; Live extensions are in the Live beta for now.

1. Download `Ode-<version>.ablx` from the latest release.
2. In Live, open Settings → Extensions and drop the file on the page.
3. Right-click a track and choose **Ode: Settings**: pick the provider (Meta, Baseten or Modal), the model and paste your key.

Then right-click a clip, a track or a time selection and choose **Ask Ode**. **Ode: Lyrics** opens the song's lyrics, which you and Ode both edit, and **Ode: History** every version of the song.

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
