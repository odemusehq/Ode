---
name: lyrics
description: Read, draft, revise or discuss lyrics with the configured Lyricist and simple revision-aware text tools.
---

# Lyrics

Use `lyrics_read` for the current text/revision and optional inclusive line bounds. Discover `lyrics_write` in group `lyrics` and replace only the requested lines; preserve labels, linked copies and locks. Text storage does not judge the writing.

Lyricist supplies linguistic interpretation: wording, rhymes, initial syllables, lexical stress and pronunciation. Ode uses the shared annotations to decide musical pitch, rhythm and placement through native Live tools. Supply the actual request, artist direction, accent and exact melody coordinates where relevant. Ordinary requests return structured text/explanation/cautions; review-only returns no replacement. Save the chosen excerpt through the ordinary text writer, never by a hidden model edit.

Read only the relevant child or reference. Select child entries with `lyricist.skills` and forward needed files with `lyricist.references`, for example `{skill: "lyrics/prosody", file: "references/craft.md"}`. A reference read by the main agent is not automatically visible to Lyricist. Current artistic voice can deliberately use near rhyme, no rhyme, irregular metre, direct statements or an unfamiliar form. Craft is a set of options, not an acceptance test. A proposed rhyme pattern is not evidence that words rhyme: assess the intended sound first. Rhyme labels refer to sound identities across the whole song; a new sound gets a new letter, even in a new section.

- `lyrics/idea`: intention, title or perspective.
- `lyrics/rhymes`: rhyme sounds and emotional function; optional Pattison reference.
- `lyrics/syllables`: sung syllables and intended melodic fit.
- `lyrics/prosody`: meaning and delivery together.
- `lyrics/originality`: familiar phrasing and specific alternatives.
- `references/writing.md`: deeper writing and rewriting techniques.
- `lyrics/pop` or `lyrics/rap`: optional genre context when relevant; these are not the available limits on style.

Use `lyricist` with `analyse:true` when `lyrics_read` reports missing/stale annotations or the musician asks to review pronunciation. This branch saves only annotations on the exact current text, not words or notes. Relevant skills, references and exact notes are forwarded in both modes. A longer note or melisma sustains a syllable; it does not require another syllable check. Recheck changed words, dialect or intended pronunciation.

Save an explicit pronunciation through `lyrics_choose_syllables` against the current text and notation revisions. It preserves the musician's choice across model checks; joined pieces retain the exact written word. A changed count marks its existing melody associations stale without deleting MIDI. Do not impose a preferred pronunciation on the artist.

For word-to-note placement, read the actual tagged clip with `midi_clip_get_notes`, then use `lyrics_bind_melody` with its `notesHash` and the exact `lyrics_read` word/syllable indices. A syllable may span notes; syllables may share a note. Existing native MIDI tools edit music. `lyrics_read` refreshes bound notes from Live and identifies stale associations; cached notes are not proof of the current performance when `melodyVerified` is false.
