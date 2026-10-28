# Ode

Ode is an AI co-writer and co-producer inside Ableton Live. It helps with every part of making a song — idea, lyrics, topline, chords, drums, bass, sounds, arrangement, vocals, mixing, mastering and release — in any order, while the musician stays the author. Select something in Live, tap a suggestion or type a few words: Ode changes the Set in place, checks the craft details with code, plays what it changed, and keeps every version of the Set so you can go back.

## Requirements
- macOS, Node.js 24.16 or later
- Ableton Live 12 Suite; Live extensions currently need the Live beta with Developer Mode turned on (Settings → Extensions)
- The Ableton Extensions SDK, unpacked next to this folder as `../extensions-sdk-1.0.0-beta.1` (it is not redistributed here)
- Model provider keys, described in `.env.example`

## Setup
```bash
cp .env.example .env    # then add your keys
npm install
npm run build           # UI, Live extension and Ode device
npm run bridge:install  # Python bridge for loading plug-ins, presets and samples
```

In Live:
1. Settings → Link, Tempo & MIDI → choose **Ode** as a Control Surface.
2. Put the **Ode** device (User Library → Presets → Audio Effects → Max Audio Effect) on the Master track.

Run:
```bash
npm start                # Ode's local server
npm run live:extension   # loads the Ode extension into the Live beta (Developer Mode)
```

## Project layout
- `skills/` — songwriting and production skills the agents load when a task calls for them
- `src/agents`, `src/harness` — the main agent, its subagents and the agent runtime
- `src/tools` — every tool the agents use, including one per Live operation
- `src/music` — pronunciation, rhyme, prosody, melody, harmony, rhythm and audio analysis
- `src/services` — model providers by role
- `src/mneme` — memory of the artist and the song, and settings
- `src/server` — the local server
- `src/live` — the Live extension, the Max for Live device and the Python bridge
- `src/ui`, `src/ui-kit` — the interface shown inside Live

## License
This project is licensed under the PolyForm Strict License 1.0.0.
See [LICENSE](LICENSE) for details.

## Disclaimer
OdeMuse and Ode are independent and are not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc. or Ableton AG.

The "Muse" in OdeMuse is part of our brand, inspired by the Muses of Greek mythology. It was chosen before Meta released its Muse models and has no connection to them. Ode is not tied to any model provider and can use Meta's Muse models alongside others.

Meta is a trademark of Meta Platforms, Inc., and the Muse models are its products. Ableton and Ableton Live are trademarks of Ableton AG.
