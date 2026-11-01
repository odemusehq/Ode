# Prosody: words, music and intention

Ask `lyricist` to interpret the actual words and notes. Forward this file with `references: [{skill: "lyrics/prosody", file: "references/craft.md"}]` when the task needs this detail. The model proposes; ordinary guarded text/MIDI tools apply the chosen edit. There is no local prosody engine.

## Review the setting that exists

Begin with what the passage means, who says it and what the listener should feel. Read the current lyric revision, exact note starts/durations/pitches, phrase origin, tempo, meter, harmony and the artist's delivery directions. Identify protected words, notes and linked phrases before proposing changes.

Have Lyricist return a compact, explicit plan for the affected phrase:

- word and sung syllable, including the chosen pronunciation;
- corresponding note or note run at the actual beat coordinates, with rests/breaths;
- normal lexical stress and intended semantic emphasis;
- the weight created by the groove, onset, duration, register, contour and articulation;
- any unintended mismatch, the proposed correction and what it preserves.

Do not accept matching syllable/note counts as a completed review. Check every affected word in context, then the entry from the previous phrase and the exit to the next. Save the chosen mapping with the existing phrase/lead-sheet notes; do not invent a separate analysis document or product panel.

## Natural stress and musical weight

For an intelligible sung line, preserve the recognisable stress of the intended pronunciation and give the intended meaning audible emphasis. A function word acquiring the longest or highest note accidentally is a reason to revise. If the artist explicitly wants a displaced stress or emphasis on that word, develop that intention instead.

Lexical stress concerns the shape of a word; semantic stress concerns what this speaker means. In "I didn't say YOU did it", emphasising YOU changes the accusation. A pronunciation can also depend on dialect, grammatical role or the singer's chosen reading. Ask Lyricist to distinguish these rather than treating one dictionary-like stress pattern as universal.

Musical strength is not a beat-number ranking. In 4/4 the downbeat matters, but the backbeat, accompaniment, anticipations, held notes, leaps, register and phrase position can move the perceived accent. A syllable on an offbeat can be emphatic when it leads into or sustains across a stronger event. Do not move every offbeat stress onto the grid.

Choose the smallest useful correction among onset, duration, rest, articulation, pitch, accompaniment or wording, within the authorised scope. A words-only task preserves the melody; a melody-only task preserves the words. Reassess the complete phrase after the change.

## Meaning and contour

Review direction, register and movement words against the musical gesture: low/high, falling/rising, holding/leaving, certainty/doubt. Ask whether the setting supports the intended sense or creates an unintended contradiction. This is a check on meaning, not a keyword-to-pitch algorithm.

When the musician requests a descending gesture on "low", the note carrying that word must fall from the specified preceding note; verify the actual MIDI after writing. Do not explain away the requested gesture as artistic freedom. Without that request, decide from the phrase's intended meaning: literal word painting, indirect emotional support and intentional contrast are all possible. Name the reason for a contrasting setting when proposing it rather than inventing an intention after a mismatch is noticed.

Emphasis does not require the highest pitch. A low word can carry weight through a longer note, exposed placement or harmonic arrival. The title or emotional pivot should be perceptible, but need not receive every peak. A rise can reach, question or resist; a fall can settle or collapse. Harmony, groove and surrounding phrases decide the effect, not those associations alone.

## Sung time and articulation

Use tempo and exact durations to assess the available sung time. Singing can sustain a vowel, delay a consonant, elide a weak syllable or spread one syllable over several notes. Conversely a dense cluster may need more articulation time even when the count matches. There is no universal syllable duration or one-note-per-syllable requirement.

Review consonant transitions, intelligibility, sustainable vowels/diphthongs, breaths, range and tessitura for the actual singer and delivery. Do not ban a vowel from a high/long note or assume a final consonant must cut it short: singers can hold the preceding vowel and release later. Accent and vocal technique matter. If range, pronunciation or performance is unknown, identify that specific uncertainty and use a provisional guide.

A MIDI instrument audition verifies the guide's played timing and contour. It cannot establish that the singer pronounces the line naturally. Listen to the singer's actual recording when available; do not call an unheard performance verified.

## Structural prosody

Pat Pattison's *Writing Better Lyrics*, second edition, chapters 14-21, examines how five interacting choices support meaning: number of lines, their lengths, their rhythms, rhyme placement and rhyme type. In this structural analysis, compare lengths by **stressed events and perceived musical phrases**, not raw syllable totals or printed line breaks. Common meter is one useful longer/shorter stress pattern, not a target for every song.

Establish what the listener is led to expect, then decide where to confirm, delay or redirect it. Matched lengths and close rhyme can create local stops; lengthening/shortening a final phrase, delaying a rhyme or adding a meaningful line can spotlight a thought or sustain motion. Repeated couplets may need a larger phrase arc so every two lines do not stop identically.

Even/odd line count alone cannot tell you whether a section closes. Six lines can stop in local pairs yet leave a larger unit open; a five-line section can close through its rhyme, rhythm and final arrival. Consider the existing grouping and the music, including the transition into the next section.

Contrast verse, chorus or bridge where their functions differ, using the dimensions that help: thought, phrase length, rhythm, density, rhyme, register or arrangement. A doubtful chorus can stay unresolved; a pre-chorus need not rise or have an odd line count. Structural momentum can increase at the same tempo.

## Working sequence

1. Clarify intended meaning and current artistic directions; inspect the actual phrase.
2. Ask Lyricist for the word-to-note plan and concrete mismatches, using only the references needed.
3. Propose a setting that supports that meaning and respects protected material.
4. Apply the chosen notes/words, read them back, and listen to the affected span in context.
5. Revisit the neighbouring phrase, repeated setting and chorus meaning where the edit changes them.

The structural guidance above is paraphrased from Pattison; the exact MIDI review and semantic-contour checks are Ode's application of intention-led prosody, not a claim that the book mandates literal pitch painting for every word.
