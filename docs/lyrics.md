# Lyrics

Ode keeps the song's words in an editable document shared by the musician and the agent. A model can propose a new line or interpret the text's pronunciation, rhythm, and rhyme, while the application preserves revisions and links those interpretations to actual MIDI notes. This lets the musician work on words and melody together without treating an annotation as an automatic musical edit.

The current lyric path uses a separately configured model role named `lyrics_check`. Both lyric proposals and annotation checks use this role. The main agent decides when lyric work is needed and supplies its context; it does not substitute a local syllable counter, rhyme dictionary, or rule engine for that model.

## Writing and interpretation

When a request needs a draft, rewrite, or detailed interpretation, the main agent calls the [Lyricist tool](../src/tools/lyrics/lyricist.ts). It passes the actual task, relevant skill guidance, artist preferences, song context, and any supplied melody information. An ordinary draft or review call returns a structured proposal containing text, an explanation, and material cautions. A review can return no replacement text.

A proposal is not a saved edit. The main agent reviews the result and uses the ordinary lyric writer if it chooses to apply it. The proposal carries the song identity and lyric revision so a response for an earlier document cannot silently become an edit to another song. If the configured service is unavailable, the intended behaviour is to preserve the text and report the missing setup.

The same tool has an `analyse: true` path that performs and saves an annotation check against the exact current text. This changes stored interpretation without rewriting the words or native notes. The tool is nevertheless declared `changes: "none"`, which is why the runtime's “read-only” classification should not be interpreted as a guarantee that no annotation or cached observation is stored. [Tools and permissions](tools.md) explains the distinction between declared mutation policy and these implementation effects.

The editor also requests annotation checks after a typing pause. [LyricsChecker](../src/services/lyrics-checker.ts) sends the song's sung lines, selected UK or US English pronunciation, and relevant saved choices or score context to the model. Its result describes each word's syllables, stress, phonetic reading, and rhyme information, together with any review notes.

The response must satisfy a schema. Local validation checks the number of lines, whether the returned words cover the actual source text, whether syllables rejoin to the original spelling, and whether the annotation arrays align. These checks reject malformed data, but cannot prove a pronunciation or musical interpretation is correct. The pronunciation, stress, and rhyme claims remain model assessments that the musician can revise.

## Word stress and sung emphasis

A word can have its own lexical stress and take a different role in a particular phrase. In “I wanted you to stay,” the singer might emphasise “you” to contrast that person with someone else. The word's pronunciation and its prominence in the sentence are related, but they are separate choices.

Ode stores this distinction explicitly. `wordStress` describes stress within a word; `stress` describes phrase or sung emphasis. Both use levels from 0 to 2, while a `null` phrase-stress value means it has not yet been interpreted. An unknown value must not be read as an instruction to sing the syllable without emphasis.

The musician or agent can change pronunciation divisions without overwriting phrase emphasis, and can patch emphasis without replacing the pronunciation. Saved choices retain the literal line and word they apply to. If that source text changes, the application can mark the old choice stale instead of guessing its new meaning. [LyricsDocument](../src/shared/lyrics-document.ts) defines these values, while [LyricsStore](../src/mneme/lyrics-store.ts) handles their updates.

Rhyme annotations include the intended sound, its letter within the song's pattern, and whether the model interprets the rhyme as perfect, near, or absent. These labels describe an interpretation rather than a mandatory composition rule. The artist may intentionally use repeated words, an imperfect rhyme, or an irregular rhythm.

## Concurrent text edits

Every lyric save names the revision it started from. If the musician and Ode edit different passages from the same base, the store can merge those changes line by line. When both edit the same lines, it keeps the musician's version and reports the conflict. If the agent's base revision is no longer available, its stale write is refused so it can read the current text first.

The agent can write a specific inclusive line range with its base revision. Section labels and blank lines count as lines, so an excerpt's coordinates are tied to the actual document. Repeated sections sharing a section name are linked by the lyric-document logic; a change to one linked copy reaches the others. Locks also apply to protected text.

Annotation requests can finish after another text edit or song switch. Before saving their result, the store checks the source text, song identity, and relevant notation state. This prevents an older response from annotating a different draft. Exact matching checks can be reused from a cache whose identity includes the model configuration, instructions, pronunciation setting, text, and supplied performance context.

## Connecting syllables to notes

The melody remains native MIDI in Live. To associate a lyric with it, Ode reads the actual clip and records a binding from a particular line, word, and syllable to one or more note indices. Multiple notes for one syllable support a **melisma**, where the singer extends a syllable across several pitches. Unfinished lyrics and partially assigned melodies can remain unbound.

A binding records what it was based on. Editing the words, changing a syllable division, or changing the native melody can make an association stale. Ode preserves the notes and requires an explicit review and rebind; a background annotation check cannot silently rewrite the performance. A focused patch can repair one association while retaining the rest of the phrase.

The stored score uses **MusicXML**, a structured notation format. Live remains the source of the native note values; the score preserves the lyric and melody associations, measure information, and Ode's song metadata. Initial measure layout needs an observed time signature, because a beat coordinate alone does not tell the application where a bar begins. [LyricMelody](../src/server/lyric-melody.ts) coordinates native edits, and [MusicXml](../src/mneme/musicxml.ts) handles the document representation.

Octave labels need care when comparing the two interfaces. Ode's score uses the MusicXML convention in which MIDI note 60 is C4 and 69 is A4. Live can display those same pitches as C3 and A3. The numbers describe the same MIDI pitches; only the naming convention differs.

For where these documents are stored and how their changes enter History, continue with [Memory and history](memory-and-history.md).
