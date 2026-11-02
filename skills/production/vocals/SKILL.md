---
name: vocals
description: Work on actual vocal recordings or explicit MIDI guide parts.
---

# Vocals

Distinguish a sung recording from a MIDI guide. Edit supplied audio through exposed native tools, or write requested guide/harmony notes through SDK writers. Lyricist handles words. Ode has no singing renderer, voice-cloning or vocal-generation service; do not treat a synth as a finished singer.

Compare vocal ranges using actual MIDI pitches. Middle C is MIDI 60: Live calls it C3, while scientific vocal references call it C4. Convert both ranges to the same convention before choosing a register or transposing; a difference in octave labels is not a reason to move the melody. Use the singer's comfortable tessitura rather than a reference artist's reported extreme notes. State the convention when reporting a range.

Read `production/live-controls` to prepare the real input/track, guide the singer while they operate Live's Record controls. Ode cannot record or manufacture a sung performance. Work with their actual performance. Native clip pitch/markers and explicit warp-marker edits are available; complete comping, phrase fades and detailed automation can require a musician-performed native step. Reveal the clip/device, explain that specific action and inspect the result afterwards.

Use the tool schemas exposed by the SDK; discover missing schemas with `ToolSearch` when available. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: optional detailed techniques and examples.

Optional sub-skills:
- `production/vocals/harmonies`: Write and fix vocal harmony lines and stacks on top of the vocals skill, as MIDI guides placed in the Set — choosing the interval (thirds, sixths, fourths, fifths, octaves) from th.

For a topline, create a dedicated MIDI track named Vocal melody guide. Prefer a clean, dry, pitch-stable piano/electric-piano sound, or another simple sound the singer finds easy to follow; use a real available source and guide any missing preset load. Keep it separate from the instrumental lead. Bind phrases to the actual lyric lines and Arrangement positions. Use lyricist with the exact notes and text to assess intended word stress, syllable placement and delivery, then revise MIDI as appropriate while preserving chosen hooks. Listen and explain the musical reason; a deliberate expressive stress or non-chord tone is not automatically a mistake. Ask about comfortable range rather than inventing it.

Before handing the song to a singer, compare the visible lyric sections and lines with the actual guide phrases, including repeated choruses and the ending. Resolve accidental duplicate or unplaced lines in the lyric editor and bindings; instructions to skip ambiguous text do not fix the sheet. Check the backing with the guide muted as well as the guide in context. Restore the agreed rehearsal state afterwards and distinguish listening judgements from measured levels or a singer's actual delivery.

Audition short phrases with the singer, optionally set a rehearsal loop, and explain entries/rests/held notes in plain language. Mute the guide through track_set when the singer wants to record; they start/stop recording in Live. Preserve the guide for later rehearsal and harmonies. Editing its MIDI does not change an already-recorded vocal.
