---
name: melody
description: Compose or edit a melody, hook, riff or countermelody.
---

# Melody

Read actual notes, harmony and current brief. Make explicit model decisions and use guarded MIDI writes. Preserve selected hooks with hook_retain or exact MIDI material references. Send all word writing/interpretation and word-to-note fit to lyricist. There is no humming/audio-to-MIDI tool; do not invent one.

For a sung melody, matching the number of notes to the number of syllables is not a phrasing plan. Give Lyricist the exact lyric lines, note starts/durations, tempo, meter, harmony and phrase origin. Ask for the intended word/syllable-to-note mapping, meaningful stresses, sustainable vowels, consonant transitions and breath spaces. Use that interpretation to choose rhythm, contour, duration and intensity together. Check semantic fit, including any requested direction on words such as "low" or "rise". An important word can be low and sustained; emphasis is not synonymous with pitch height. Read `lyrics/prosody` and forward its craft reference through `lyricist.references` for a detailed word-to-note review. An article can carry deliberate emphasis, but an accidental peak on a weak syllable needs reconsideration; do not impose a universal ban or a fixed duration per syllable.

Rehearse the proposed words against the actual beat coordinates before extending the melody. Keep the chosen mapping with the existing phrase/lead-sheet notes, and update phrase spans when their timing changes. Audition the MIDI guide in context and compare it with that plan. A piano audition establishes the guide's musical timing and contour, not verified sung pronunciation; only a singer's actual performance can establish that.

For a hummed or sung sketch, read `production/live-controls`: help the musician record an isolated monophonic clip, reveal it and guide them through Live's Convert Melody to New MIDI Track. Then read the actual created MIDI and discuss any corrections. Live performs conversion; a model audio description is not an exact transcription.

Discover the named tools with `tool_search` using `names` and the appropriate group before calling them. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: optional detailed techniques and examples.

Optional sub-skills:
- `production/melody/pop`: Pop topline options on top of the melody skill — early hooks, prominent titles, contrast over loops, rising or open pre-choruses, narrow post-chorus hooks and sub-style tendencies .
