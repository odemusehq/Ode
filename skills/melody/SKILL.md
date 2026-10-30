---
name: melody
description: Write, fix and vary toplines, hooks, riffs and countermelodies directly in the Set. Ode edits the notes of the melody clip the musician points at, checks key, the singer's range, chord tones on strong beats, leaps, breaths and, when words are set, syllable fit, prosody and singability, then reports in one line which bars changed, so the musician can play them. Use this skill whenever a melody, topline, lead or hook clip is selected, or the musician clicks a suggestion or types anything about a melody — "make the chorus lift", "catchier", "simpler", "higher", "fix the out-of-key notes", "set these words", "write something over these chords", a hummed idea to develop — whatever words they use.
---

# Melody

A good melody is easy to remember, comfortable to sing, agrees with the harmony, carries the words naturally, and goes somewhere: it rises to a high point and comes to rest. Most melodic problems come from losing one of those five. Ode works on the melody already in the Set: it changes the notes the musician points at, checks them, and the musician plays the result in Live straight away.

## Conventions

- Note names are scientific pitch: middle C is C4, MIDI 60. Live's piano roll shows MIDI 60 as C3, so its octave numbers are one lower. In a result line, use Live's names or skip octave numbers ("up a fourth", "peak on 'gold'").
- Lengths are beats of 4/4: 1 = quarter, ½ = eighth, ¼ = sixteenth, 1½ = dotted quarter, 2 = half, 4 = whole. `r` is a rest and `|` a barline: `r(½) G4(½) A4(1)` is an eighth rest, an eighth-note G4, a quarter-note A4.
- Scale degrees are numbers (1 = tonic, 5 = dominant, ♭3 = lowered third). Chords are symbols (Am7, F/A, G7sus4).

A hummed idea keeps estimated timing and chromatic pitches by default. `hum_to_midi` exposes its observed pitches and transformations; enable tuning correction, key snapping, fragment cleanup or quantization only when the musician requests that change. Preserve source audio for vibrato and expression that MIDI note numbers cannot represent. ASR speech-detection times are approximate and must not drive note edits or lyric replacement.

`melody_write` is a drafting helper, not the only way to write a melody. Give explicit `phrases` for unequal or sub-bar lyric spans; their starts are nonnegative clip beats, and `beatOffset` retains the actual metrical position. Place the clip early enough to include a pickup. Shared `motifId` values carry the chosen first phrase across lines with proportional timing; `motifBars` repeats a shared motif in whole statements. `hookId` with retained notes keeps the chosen hook exactly, including performance fields, and refuses lyrics that would require silently splitting it. Revise the words or hook deliberately when that is the musical choice. Output alignment names the actual returned notes, not an earlier discarded draft.

For continuing song work, use `hook_retain` after choosing the actual tagged MIDI performance: it reads back full notes and computes their source hash. Alternatively keep explicit chosen notes in `lead_sheet_update.composition.hooks`. Bind phrase spans to the existing section ID and exact lyric line/text/revision. `melody_write` can consume that section with `sectionId`; use `clipStartBeat` before the section for pickups. Read `compositionStatus` before using the plan: reconcile stale selected bindings with current lyrics; an unrelated stale phrase need not discard a good hook. A source tag/hash is content evidence to recheck, not durable Set identity. Keep deliberately chromatic or expressive hooks; use the note tools directly when a helper's drafting assumptions do not fit. An infeasible register remains an error unless the musician changes the bounds.

## How Ode works on a melody

### 1. Read

- From the project map: key and scale, tempo, meter, the selected clip and its bars, the sections around it, what else plays.
- The melody's notes, and the chords under them: the chord part's notes or the lead sheet's chord chart, with how long each chord lasts.
- The neighbouring sections' melodies. "Higher", "busier" and "lift" are relative: a chorus lifts only against its verse.
- The words sung on these notes (the section's lines in the lyrics), when there are any.
- The singer's comfortable range: the song's settings, then the musician's settings, then what memory knows from their own sung parts. When the musician tells you their range, store it as their setting. These are the only sources of the range. When it is unknown, keep to about A3–D5 and say so in the result line.
- What is locked, and the groove: where the kick and snare fall.

### 2. Decide

Plan in words before placing notes: the motif, the contour, the range, the rhythmic feel, where the high point falls, how each phrase ends. Keep what makes the melody recognisable, usually the motif's rhythm and the hook, and change what the request is about; write something new only when that is what was asked. The craft sections below give the rules.

### 3. Change it in place

- Edit the notes of the clip the musician pointed at; keep its position, length and loop.
- Leave the words as they are. When a line fits its notes badly, change the melody: split a long note, merge two short ones, add or drop a pickup.
- A melody still to be written (a topline over an empty section, a countermelody) is new material: write it into a clip on the lead or instrument track at that section's bars.
- New clips, tracks and takes hold only new material; alternatives come from Again, which asks for another take with the Set back as it was: make it clearly different (another contour, rhythm or register); the history keeps the old one.
- Change only the bars that need it.

### 4. Verify

Run the checks that apply and report their coverage. Explicit range and preservation constraints are hard requirements. Chromatic notes, suspensions, syncopation, melismas and deliberate stress departures are musical choices: inspect their intention/resolution before changing them. A passed note check is not a listening or artistic-quality verdict. English pronunciation tools are heuristic and do not establish multilingual lyric expertise.

| Check | Correct when |
|---|---|
| Key | every note is in the song's scale, or is a chromatic note placed on purpose: a passing or neighbour note on a weak beat that resolves by step, or a note of a borrowed chord sounding at that moment |
| Range | every note is inside the singer's range; the highest notes are brief and leave a little room below the top |
| Chord tones | every note starting on beat 1 or 3, or where the chord changes, is a chord tone (root, 3rd, 5th, or the 7th of a seventh chord) or a colour tone the chord part also plays; weak-beat non-chord tones resolve by step |
| Leaps | each leap of a fourth or more inside a phrase is followed by a step the other way; tritone, major-seventh and augmented-second leaps only where the style asks for them |
| Breath | a beat or more of rest between phrases at medium tempos, and every phrase within one comfortable breath (about eight beats without a rest) |
| Lift | when the request is about lift or contrast: the chorus's tessitura (where most notes sit) is a third to a fifth above the verse's, and its peak is the highest so far |
| Syllables | with words: the lyrics-to-melody check, which splits the melody into one phrase per line, finds each line's phrase with as many notes as one of its syllable counts, or a melisma you chose on a key word |
| Prosody | with words: the prosody check finds every stressed syllable on a note at least as strong as its unstressed neighbours |
| Singability | with words: the singability check finds high held notes free of closed vowels ("ee", "oo") and very short notes free of consonant clusters |
| Clashes | every long note stays clear of a half-step clash with any note the chord part, the bass or a countermelody holds at the same time in the same octave |

Locked parts must be exactly as they were.

### 5. Let them hear it

When your turn ends, the musician presses play in Live: say in the result line which bars changed, so they know where to listen. That is why the change should cover only the bars that need it.

### 6. Report in one line

What changed, then " · ", then what was checked:

- "Chorus topline up a fourth on the same rhythm, peaking on 'gold' · in key, inside your range, every stress on a strong beat."
- "Bars 5–6, which repeated the opening motif, now answer it · chord tones on 1 and 3, both leaps recovered."
- "Two out-of-key notes in bar 3 moved into the scale · the rest as it was."

When a take is outside the artist's usual style (judged from their own songs and what they have said), the line says "outside your usual style".

## When to ask

Act without asking. The one question, a single line with buttons, comes only when the answer changes what Ode does:

- the melody can fit the singer only by changing the song's key, which moves every part: "Chorus peaks above your range — move the song down a tone? · Move it · Keep the key";
- a muted lead or instrument track decides which melody to work on, and the hand edits and version history leave it unexplained. Muted long ago and untouched since means parked; muted a moment ago while something else was soloed means it is still part of the song.

The mode decides the rest: in Manual, Ode shows each change for Apply or Skip.

## Motif: the seed

A motif is a short, recognisable idea, usually two to six notes over one or two beats to a bar. Its identity lives more in its rhythm and its main interval than in exact pitches. Listeners remember melodies through repetition, so build phrases from one or two motifs and bring them back bar after bar.

Keep the motif and develop it:

- **Repetition** — exactly the same; the strongest glue, used most in choruses.
- **Sequence** — the same shape starting on another degree, often a step or a third away; keeps identity while the harmony moves. Adjust intervals so strong-beat notes stay chord tones (a modified sequence).
- **Changed ending** — same start, new last note; turns a statement into a question or an answer.
- **Rhythmic displacement** — start it half a beat or a beat later; sounds fresh without new material.
- **Augmentation and diminution** — longer or shorter note values; augmentation makes a chorus feel broad, diminution adds urgency.
- **Fragmentation** — repeat only the first two or three notes; builds tension in a pre-chorus.
- **Inversion** — flip the direction of the intervals; subtle, use sparingly.

A dependable phrase plan: state the motif, repeat it (exactly or in sequence), then answer with something that resolves. Repeat, repeat, contrast keeps it familiar without becoming boring.

## Contour

- Give each phrase, and each section, one clear high point. Put it on an important word or on the hook. Approach it by step or a small leap and leave it by step; repeating the peak note too often stops it being a peak.
- Common shapes: arch (rise then fall, natural and satisfying), rising (builds; good for pre-choruses), falling (relaxes; good for endings), wave (gentle; good for verses), and repeated notes (chant-like; works when the rhythm is strong).
- Across the song: verse lower and narrower, pre-chorus rising, chorus highest, bridge somewhere new (another register or shape). If the chorus peak is at or below the verse's, the chorus feels flat: raise its tessitura or bring the verse down.

## Range and tessitura

- **Range** is lowest to highest note; **tessitura** is where most notes sit. Singers tire from a high tessitura far more than from one high note.
- Stay inside the singer's comfortable range and keep a little room below their top note. Hold the highest notes only briefly, ideally on open vowels.
- Rough guides, adjusted to the singer and genre: verse range about a fifth to a sixth in the lower middle of their range; chorus up to an octave, with its tessitura a third to a fifth above the verse's; the whole song within about an octave and a half.
- Moving the whole song to another key is a key change: it is the question above.

## Steps and leaps

- Use mostly stepwise motion; thirds are almost as easy. Keep larger leaps (a fourth or more) for emphasis: phrase starts, key words, the lift into the hook.
- After a leap of a fourth or more, move by step in the opposite direction. The ear hears the gap and wants it filled.
- Two leaps in the same direction should outline a chord (C4–E4–G4); otherwise they sound random.
- Tritones, major sevenths and augmented seconds are hard to sing in tune. Use them only when the style wants that tension, and recover by step.

## Chord tones and non-chord tones

- Put chord tones (root, third, fifth, and the seventh of seventh chords) on strong beats: beat 1, beat 3, and wherever the chord changes. That is what makes melody and harmony agree.
- Use non-chord tones on weak beats to connect them:
  - **passing tone** — steps between two chord tones (C–D–E over C);
  - **neighbour tone** — steps away and back (E–F–E over C);
  - **suspension** — held over from the previous chord, then resolving down by step (C held over G, falling to B);
  - **appoggiatura** — a non-chord tone on a strong beat, often leapt to, resolving by step; expressive, so save it for the emotional word;
  - **anticipation** — a note of the next chord arriving early, typically on the "and" of 4; the heart of syncopated pop and R&B toplines.
- Colour tones (6th, 9th, 11th, 13th) on strong beats are fine when the style uses them — pop often rests on the 9th, jazz on extensions — especially when the chord voicing includes them.
- Watch for clashes: a long note a half step above a chord tone (F held over C major, which contains E) sounds wrong unless it resolves; a note that contradicts the chord's quality (E♭ over C major) clashes unless it is a deliberate blue note.
- Chords still to come? Write strong-beat notes that clearly imply a harmony, so chords can follow.

## Rhythm and syncopation

- Rhythm makes a melody memorable more than pitch does: people recognise a tune tapped on a table. Give each section its own rhythm.
- Mix long and short notes and leave rests. Unbroken eighths or quarters sound mechanical.
- Syncopation — notes on off-beats, especially arriving on the "and" before a strong beat and holding through it — adds push and a conversational feel. Keep some notes on the beat so the pulse stays clear.
- A pickup (notes before the barline) gives momentum into the downbeat. Starting a phrase after beat 1 sounds conversational; starting on beat 1 sounds declarative.
- Relate the rhythm to the groove: let some accents meet the snare or kick and others fall between them. A melody that copies the hi-hat subdivision sounds busy.
- Contrast sections: if the verse is busy and speech-like, make the chorus broader with longer notes and more space, or the reverse. What matters is that the rhythm changes.

## Phrases and breath

- Phrases are usually two or four bars. Pair them as question and answer: the first ends open (on 2, 4, 5, 6 or 7, or over a non-tonic chord), the second ends closed (on 1 or 3 over the tonic).
- Leave room to breathe between phrases — at least a beat at medium tempos, more after long or high lines. At slow tempos, long phrases run out of air quickly.
- Vary phrase lengths now and then (2 + 2 + 4, or extend the last phrase by repeating its end) so the section feels less square.
- The gaps are useful: backing vocals, ad-libs and instrumental answers live there.

## Hooks

- The hook is the part people remember and sing back; it usually carries the title.
- Keep it short (one or two bars), rhythmically distinctive and repeated, and place it where it lands hard: the start of the chorus, the end, or both. Put it at or near the melodic high point, or give it a distinctive interval.
- A hook can be melodic, lyrical (the title phrase), rhythmic or instrumental (a riff or post-chorus line). A song can have several, but one should lead.
- If it is still hard to sing back after two listens, simplify its rhythm or repeat it more.

## Cadence points

- Stable degrees (1, 3, sometimes 5 over the tonic) close a phrase; unstable degrees (2, 4, 6, 7) or endings over the dominant leave it open.
- Verses and pre-choruses usually end open, pulling into the next section. Choruses usually close at their end, after open endings earlier on.
- End only some phrases on the tonic; ending every one there makes the song sound finished too early.
- Make the song's final cadence the strongest: the tonic, on a long note, often reached by step from 2 or 7.

## What each section's melody usually does

| Section | Melody usually | Why |
|---|---|---|
| Verse | lower, narrower range, more words, conversational rhythm | tells the story and leaves room to rise |
| Pre-chorus | rises; shorter phrases or a fragmented motif; ends open | builds tension into the chorus |
| Chorus | highest tessitura, longer notes, the hook repeated, closes | the arrival; the part people sing |
| Bridge | new contour, rhythm or register; often avoids the tonic | contrast before the last chorus |
| Post-chorus | short, repetitive hook, often on vowels or a chant | extends the chorus energy |

## Words and melody

**Notes for existing words** (the prosody skill covers this in depth):

1. Mark each line's stressed syllables.
2. Put stressed syllables on strong beats (1 and 3, or a strong syncopated position) and unstressed ones on weak positions; let speech rhythm suggest the melody's rhythm.
3. Give the important words — the title, the image, the turn — length, height or the downbeat.
4. Put open vowels (ah, oh) on long or high notes; keep narrow vowels (ee) and consonant clusters off the highest held notes and off fast notes.
5. Default to one syllable per note; save melisma for a few key words.
6. Match phrase length to the line, and leave a breath between lines.

Example line: "the kettle's still warm on the stove", stresses on KET, WARM and STOVE.

- Good: `the(½) | KET(½) tle's(½) still(1) WARM(1) on(½) the(½) | STOVE(2)` — "the" is a pickup, and KET, WARM and STOVE land on beat 1, beat 3 and the next beat 1.
- Poor: `| the(1) KET(1) tle's(1) still(1) | WARM ...` — "the" takes beat 1 and "tle's" takes beat 3, so the line is heard as "the KET-TLE'S".

Some words have more than one sung syllable count (*fire*, *every*). Let the melody choose, and use the same reading the syllable check used.

**Melody first, words later.** Keep the rhythm simple and repeatable so several verses can fit it. The note count and the strong notes of each phrase (long, high, or on strong beats) are the lyric's brief: write them into the lead sheet's notes for that section so the lyrics skill can fit lines to them.

## Varying and fixing

- Keep what makes the melody recognisable (usually the motif's rhythm and the hook) and change one thing at a time: first one or two pitches or the ending; then a rhythm displacement or embellishment; then a new contour or register.
- On Again, move further along that ladder than the last take did.
- Name the bars that changed in the result line when the change covers only part of the clip.
- More development techniques, later choruses, countermelodies and a table of common problems and fixes are in `references/development-and-fixes.md`.

## Worked example: "make the chorus lift"

The musician selects the chorus topline (C major, 96 BPM, chords `| C | Am | F | G | C | Am | F G | C |`, bar 7 split two beats each) and types "make the chorus lift". The verse sits around C4–G4 and the singer's range is A3–E5. The chorus has a good motif rhythm but sits in the verse's register; its first two bars:

```
| C  | r(½) C4(½) D4(½) E4(1½) C4(1) |
| Am | E4(1) D4(1) C4(2) |
```

Decision: keep the rhythm, which is the hook, and raise the tessitura by a fourth, with the peak at the end of the first half and a close on C5. Ode rewrites the clip's notes:

```
| C  | r(½) G4(½) A4(½) C5(1½) G4(1) |
| Am | A4(1) G4(1) E4(2) |
| F  | r(½) A4(½) B4(½) C5(1½) A4(1) |
| G  | B4(1) C5(1) D5(2) |
| C  | r(½) G4(½) A4(½) C5(1½) G4(1) |
| Am | A4(1) G4(1) E4(2) |
| F G| A4(1) C5(1) B4(1) D5(1) |
| C  | C5(3) r(1) |
```

Checks: every note in C major; range E4–D5 and tessitura G4–C5, a fourth above the verse and inside A3–E5 with a tone to spare; a chord tone on every beat 1 and 3 (the C5 that arrives on the "and" of 2 is held across beat 3, an anticipation); leaps inside phrases are thirds and one fourth (C5 down to G4), each followed by a step back; a rest before each phrase. Bar 3 is a modified sequence of bar 1, so its long note stays a chord tone of F; the first half ends open on D5 over G and the second closes on C5.

Result line: "Chorus topline up a fourth on the same rhythm, peaking just before the close · in key, inside your range, chord tones on 1 and 3."

On Again, take another direction: a broader chorus starting on the downbeat with half notes and its peak near the end, or a low, chant-like hook on repeated notes whose interest is all in the rhythm — outside the usual style for an artist who belts their choruses, so the result line says so.

## Original material

Write only original melodies: translate "in the style of" a specific song or artist into general qualities (range, rhythm, density, mood). If a melody resembles one you know, change it; the originality skill covers this.

## Reference files

| File | Read when |
|---|---|
| `references/development-and-fixes.md` | You need more motif development, how to build a section from one motif, how to vary later choruses and verses, countermelodies and riffs, or the table of common melody problems and their fixes. |

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds only the genre detail beyond this file.

| Path | Read when |
|---|---|
| `pop/SKILL.md` | The song or the topline is pop or pop-leaning (dance-pop, synth-pop, pop ballad, indie-pop, pop R&B), or the musician asks for something catchier, a bigger chorus, a post-chorus hook, or verse and chorus that contrast over the same chord loop. |
