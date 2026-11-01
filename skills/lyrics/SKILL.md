---
name: lyrics
description: Read, draft, revise or discuss lyrics with the configured Lyricist and simple revision-aware text tools.
---

# Lyrics

Use `lyrics_read` for the current text/revision and optional inclusive line bounds. Discover `lyrics_write` in group `lyrics` and replace only the requested lines; preserve labels, linked copies and locks. Text storage does not judge the writing.

All wording, rhymes, syllables, stress, pronunciation and word-to-note interpretation go to `lyricist`. Supply the actual request, artist direction, accent and exact melody coordinates where relevant. It returns structured text/explanation/cautions; review-only returns no replacement. Save the chosen excerpt through the ordinary text writer, never by a hidden model edit.

Read only the relevant child or reference. Select child entries with `lyricist.skills` and forward needed files with `lyricist.references`, for example `{skill: "lyrics/prosody", file: "references/craft.md"}`. A reference read by the main agent is not automatically visible to Lyricist. Current artistic voice can deliberately use near rhyme, no rhyme, irregular metre, direct statements or an unfamiliar form. Craft is a set of options, not an acceptance test. A proposed rhyme pattern is not evidence that words rhyme: assess the intended sound first. Rhyme labels refer to sound identities across the whole song; a new sound gets a new letter, even in a new section.

- `lyrics/idea`: intention, title or perspective.
- `lyrics/rhymes`: rhyme sounds and emotional function; optional Pattison reference.
- `lyrics/syllables`: sung syllables and intended melodic fit.
- `lyrics/prosody`: meaning and delivery together.
- `lyrics/originality`: familiar phrasing and specific alternatives.
- `references/writing.md`: deeper writing and rewriting techniques.
- `lyrics/pop` or `lyrics/rap`: optional genre context when relevant; these are not the available limits on style.
