---
name: production
description: Operate on the real Live Set: instruments, MIDI, arrangement, sound design, mixing and processed-audio listening.
---

# Production

Start from the musician's request, fresh DAW state and applicable artist memory. Load only the child needed now. Its entry point names relevant tools and optional craft references. Find exact schemas with `tool_search` using `names` or a concise query and group `daw_read` or `daw_write`.

The Extension SDK reads and writes supported Set objects: tracks, MIDI/audio clips, devices, racks and parameters. Max adds processed-audio capture, displayed parameter units, loaded-plugin programs/editors, routing, native meters, transport and additional clip/sample controls. Neither API exposes every Live menu command or the installed-plugin/Browser inventory. A configured model decides the music; native devices and plug-ins produce/process it. No local composition, pitch, linguistic or DSP engine exists.

Choose the source and performance together. A suitable licensed kit, sample library or loaded plug-in can serve the song better than a default synth. Before extending an unfamiliar sound across the arrangement, audition a representative passage in context using the available Max capture and listener. Ask for a specific host loading step when a required preset is inaccessible; do not silently turn a guitar or singer into a synth guide.

For a new song or substantial production revision, begin with `production/sound-design` and the actual available material. Use `production/song-form` when the form is open, then `production/arrangement` to develop the music. Follow a relevant genre child when the musician has specified that genre. These are working decisions you make from the brief, not categories the musician must fill in.

Develop a representative hook and verse-to-chorus passage before extending a palette across the full duration. Choose its tempo, performance, timbres and contrast provisionally; revise choices that do not serve the song. Preserve a chosen hook while developing its surroundings. A complete timeline is not by itself a finished production. If listening is unavailable, keep musical assessment explicitly provisional and report what still needs review rather than treating native readback as an audition.

Own the musical decisions. A musician or test operator loading an inaccessible asset performs the exact choice you requested; they should not have to design the palette or arrangement for you. Distinguish the artist's chosen constraints from unapproved earlier Ode drafts.

Children:
- `production/live-controls`: Native device/plugin/preset access, sample controls, routing, recording and musician-assisted host steps.
- `production/arrangement`: Build or revise section activity and transitions in the Arrangement.
- `production/song-form`: Develop and place the song structure.
- `production/sound-design`: Choose and shape actual instruments, samples and effects.
- `production/drums`: Program or edit drums on an actual kit.
- `production/bass`: Compose or edit bass and its relationship to the other parts.
- `production/harmony`: Compose or revise chords and voicings.
- `production/melody`: Compose or edit a melody, hook, riff or countermelody.
- `production/vocals`: Work on actual vocal recordings or explicit MIDI guide parts.
- `production/mixing`: Balance and process the real tracks for the requested sound.
- `production/mastering`: Build or adjust the actual Main processing chain when requested.
