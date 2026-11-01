---
name: prosody
description: Review how words and musical delivery serve the artist's meaning.
---

# Prosody

Ask lyricist with the real words, exact melody and intended delivery. Consider meaning, stress, rhyme and musical setting together. Preserve recognisable lexical stress and the intended semantic emphasis by default. Identify unintended mismatches; an explicit artistic direction can choose another delivery. Balanced form is one option, not a requirement.

When fitting a vocal guide, supply tempo/meter, lyric revision, phrase origin and exact note starts/durations. Ask for a word/syllable-to-note plan that considers lexical and intended semantic stress, metric placement, pitch peaks, relative durations/intensity, vowels, consonant transitions and breaths. Review the meaning against the gesture as well: direction/register words can expose an unintended contradiction. Honour a requested descent or other contour explicitly, and verify the MIDI readback. Emphasis can come from duration or placement without a higher pitch. Counting syllables alone cannot establish whether a phrase can be sung naturally. Singing may stretch a vowel, compress a weak syllable, use melisma or deliberately stress a function word; interpret the artist's meaning rather than applying one fixed rule. State pronunciation or placement uncertainty and do not describe an unheard singer as verified.

Use the tool schemas exposed by the SDK; discover missing schemas with `ToolSearch` when available. Read only the references needed for the current task; the artist's current direction overrides stylistic advice.

- `references/craft.md`: word-to-note review, semantic contour, sung time and Pattison's structural prosody. For a detailed fit/correction, forward it in `lyricist.references` with this skill name; reading it in the main conversation does not forward it automatically.
