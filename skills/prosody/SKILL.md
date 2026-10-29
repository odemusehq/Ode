---
name: prosody
description: Make words and music agree in the Set — stressed syllables on strong beats, long notes on open vowels, simple consonants on fast notes, phrases that can be sung in one breath, and section shapes that feel settled or unsettled as they should. Ode fixes these in place, by moving the melody's notes or changing the words in the song's lyrics, and checks the result with its prosody and singability checks. Use this whenever words meet a melody — a "stress off" or "hard to sing" fix, a topline written or edited under existing words, words written for an existing melody, a line that "sounds wrong", "feels awkward" or "falls flat" — and before reporting any lyric that is sung on notes.
---

# Prosody

Prosody is the fit between what is said and how it is set. When it works, the words sound as if they could only be sung that way. When it fails, listeners hear words wrongly stressed ("TO-mor-row"), feel the music pulling against the words, or sense that something is off without knowing why. Most "this line feels awkward" problems are prosody problems, and most of them are fixed by moving a note, with the line's words left as they are.

## The loop

1. **Read.**
   - The line in the lyrics ("[Chorus] line 1") and the notes it is sung on: the lyrics-to-melody check splits the vocal melody in the section's bars into one phrase per line and reports each line's stress problems against its phrase (the syllables skill explains how to find the melody).
   - What is locked: everything the lead sheet's locked list names (a lyric line, a melody the musician loves, a recorded vocal).
   - The time signature established by the musician, the tempo, the song's key, and the vocal range from the settings (or a typical range when it is unset). The installed SDK cannot read the current Arrangement meter; a scene's launch meter does not establish it. Keep the meter unknown until established, and obtain it before running checks that use metrical stress.
   - The hand edits since the last request: if the musician just moved notes or retyped the line, start from what they did.
2. **Decide** the smallest change that puts the stress right, in this order:
   1. **Rhythm only:** shift a note, shorten or lengthen it, add or drop a pickup. Words and pitches stay as they are.
   2. **One word:** a word with its stress in the right place, or a different word order.
   3. **The whole line**, keeping its meaning and its rhyme.
   4. **Pitch:** make the stressed syllable the higher note, once rhythm has run out of options.
   Locked words mean you fix the notes. A locked melody means you fix the words. When both are locked, everything stays as it is: say in the result line what still fails.
3. **Change in place.** Edit the notes of the existing melody clip, or the line's words in the lyrics, saved against the revision you read. The fix always goes into what is already there: Again gives another take and the version history keeps the old one. Moved notes stay in the song's key and inside the singer's range.
4. **Verify** every line whose words or notes you changed:
   - **Prosody check** against the new notes: it comes back clean. That means every stressed syllable sits on a note at least as strong as its unstressed neighbours, the line's longest note carries a stressed syllable, and the melodic peak carries a content word.
   - **Syllable check:** one note per syllable, or a melisma only where you meant one, on an open, stressed vowel.
   - **Singability check:** treat vowel, consonant and breath findings as English-language heuristics. When tempo is known, the tool flags phrases longer than four seconds without a rest of at least 0.25 seconds; the singer's delivery decides whether a breath is needed.
   - **Key and range:** every moved note is in the key and inside the singer's range.
   Fix and check again, up to three rounds; if a problem remains, the result line says which.
5. **Let them hear it.** The result line says where the change is, so the musician can play it: moved notes by their bars, from a bar earlier when the change is at the start of a section; changed words by the line's label, which names the locator to play from.
6. **Report in one line**: what moved or changed · what was checked. For example:
   - "Verse 2, line 1: 'for' now comes in on the 'and' of 4, so 'forget' lands on GET (beat 1) · stresses fit, same pitches."
   - "Bridge line 3: the long note moved from 'the' to 'far' · stresses fit, open 'ah' on the held note."
   - "Chorus line 2: the high note moved from 'to' to 'away' · stresses fit, words and rhythm unchanged."

## Asking

Prosody fixes almost always go ahead without a question: locked lines and locked notes tell you what you may change. Ask only before rewriting a whole section outside what the musician pointed at. In Manual, Ode shows the change for Apply or Skip, and you work the same way.

## Stressed syllables on strong beats

Every word of two or more syllables has a fixed stress (to-MOR-row, a-FRAID, BEAU-ti-ful), and every line has a natural speech rhythm. The music has its own pattern of strong and weak positions. Prosody starts with lining the two up.

**Where the weight is:**
- In 4/4, beat 1 is strongest, then beat 3, then beats 2 and 4 (although the snare's backbeat accents them in pop, rock and hip-hop), then the "and" between beats, then the sixteenths.
- In 3/4, beat 1 is strong and beats 2 and 3 are weak. In 6/8 there are two main beats, 1 and 4, each divided into three.
- A note also gains weight from being longer than its neighbours or from being a melodic high point.

**The test:** each stressed syllable should feel at least as strong as the unstressed syllables next to it, by beat position, length or pitch. A stressed syllable on a weak, short, low note next to an unstressed syllable on a strong, long, high one sounds wrong. The prosody check measures exactly this.

**Syncopation is fine.** A stressed syllable that arrives just before the beat and is held through it (an anticipation) is heard as strong; it is everywhere in pop and R&B. What matters is that the stressed syllable stands out; its exact place on the grid matters less.

### Worked example

The line *Forget the way we said goodbye* is stressed on -GET, WAY, SAID and -BYE. In the musician's draft every syllable sits an eighth note late against those stresses:

| | "and" before 1 | 1 | & | 2 | & | 3 | & | 4 | & |
|---|---|---|---|---|---|---|---|---|---|
| Draft | | for | GET | the | WAY | we | SAID | good | BYE (held) |
| Fixed | for | GET | the | WAY | we | SAID | good | BYE (held) | |

In the draft, every stressed syllable falls on a weak "and" and every unstressed one on a beat, so it sounds like "FOR-get THE way…"; the prosody check flags "forget". Starting "for" as a pickup on the "and" of 4 moves every stress onto a beat without changing a word or a pitch. The notes move in place in the same clip, the prosody check comes back clean, and the result line reads: "Verse 2, line 1: 'for' now comes in on the 'and' of 4, so 'forget' lands on GET (beat 1) · stresses fit, same pitches."

**Ways to fix a stress that lands weak,** smallest first:
1. Add or remove a pickup so the line shifts against the beat.
2. Move the note: shift the stressed syllable onto a stronger position, or lengthen it.
3. Change the words: a word with its stress in the right place, or a different order.
4. Change the pitch: make the stressed syllable the higher note.

## Natural speech rhythm

- Say the line aloud at a natural speed. Its rhythm (which syllables are long, which are quick, where the pauses fall) is the best first draft of its musical rhythm.
- Long, stressed syllables want longer notes; unstressed syllables want short ones. Function words (a, the, of, to, and) on long notes or melodic peaks sound oddly important.
- Conversational styles follow speech closely; anthemic styles stretch words over long notes. Both still need the stresses in the right places.
- Breathing is part of the rhythm. A long phrase needs a natural place to breathe, usually where a comma would go.

## Note length and vowels

Only vowels can be sustained, so a long note is a held vowel. Choose words whose vowel suits the note:

- **Long and high notes:** open vowels such as "ah" (far), "aw" (saw), "oh" (go), "ay" (day) and "eye" (night) bloom. "Oo" (you) is fine in the middle of the range; "ee" (free) and "oo" get harder very high, and singers often have to modify them.
- **Short notes:** short vowels such as "ih" (sit), "eh" (bed), "uh" (cup) and the "oo" in "book" are naturally short and sound best on quick notes.
- **Diphthongs:** on a held "ay" or "eye", the singer sustains the first part and closes at the end ("night" is held as "naaah-eet"), so the first part has to suit the note.
- **Endings:** words ending in t, k, p, d, g or b stop the sound dead, which suits punchy short notes and cuts a long one short. Words ending in m, n, ng, l, v or z can be sung through.
- **"R" after a vowel:** in US English the singer usually holds the vowel and adds the "r" at the end of the note; in UK English the "r" is silent. Either way, hold the vowel and keep the "r" short.

## Singability

- **Consonant clusters** ("strengths", "sixths", "texts", "asked") are hard to say on fast notes. Keep fast passages to light words with simple consonants.
- **Sibilants** ("s", "sh") hiss on held notes; put them at the ends of phrases or on short notes.
- **Word boundaries blur when sung.** "A nice man" can be heard as "an ice man". Hear the line in your head at tempo and listen for a different phrase appearing (a mondegreen), above all in the title line.
- **Breath:** a phrase has to fit in one breath at the song's tempo, with time to breathe before the next.
- **Range:** keep important words out of the extremes of the singer's range unless the strain is the point (an emotional climax). The melody skill covers range itself.

`references/singability.md` has more on vowels and consonants, with words that work well and badly on held notes.

## Structural prosody

The shape of a section carries feeling before anyone hears a word. When you write or rework a section, match its shape to what it should feel like.

- **Line count:** an even number of lines (2, 4) feels settled; an odd number (3, 5) feels unsettled and leans forward.
- **Line lengths:** matched lengths feel balanced; a short line after long ones lands like a punch; lines that get shorter build urgency; lines that get longer can feel like spilling over.
- **Rhyme closure:** a perfect rhyme at the end of a section feels resolved; a near rhyme or an unrhymed line leaves it open; withholding a rhyme the listener expects creates tension (the rhymes skill covers schemes).
- **Phrase starts and ends:** a phrase starting on the downbeat feels grounded and declarative; starting with a pickup feels conversational and forward-moving; starting after the beat feels laid-back. Phrases that end early leave space; phrases that run over the bar line feel urgent.

**Matching sections to feelings:**
- **Verse:** settled enough to tell the story; slightly unsettled if it hands over to a pre-chorus.
- **Pre-chorus:** unsettled and building: shorter lines, odd counts, open rhymes.
- **Chorus:** usually settled and resolved, because it is the arrival. A song about doubt or something unfinished can keep the chorus open on purpose.
- **Bridge:** different from both: new line lengths, a new scheme, a different phrase rhythm.

**Example (original), a pre-chorus before a nervous night out:**

> *I've changed my shirt three times tonight* (8)
> *The taxi's at the door* (6)
> *My hands won't stop* (4)

The lines shrink from 8 to 6 to 4 syllables and all three stay unrhymed, so the section tightens and stays open, pushing into the chorus the way nerves do. The structure says "nervous" before the words do.

## Melody shape and meaning

- **Rising lines** suit hope, questions, reaching and building intensity; **falling lines** suit resolution, statements, letting go. "I'm not coming back" falling to a low final note sounds like a decision; rising, it sounds like a question or a threat.
- **Leaps** suit outbursts and surprise; **steps and repeated notes** suit intimacy and conversation.
- **Give the highest note to the most important word,** often the title or the emotional turn. In *I never wanted you to leave*, the peak belongs on "never" or "leave", with "you to" kept lower.
- **Register:** low sounds intimate and private; high sounds public, urgent or strained.
- **Word painting** (rising on "rise") is lovely in small doses; done literally and often, it sounds naive.
- **Harmony** colours meaning too, case by case: a minor key can sound tender or defiant as well as sad, and bright music under bittersweet words is an established, powerful contrast.

## Working order

- **Lyric first:** mark the stresses and the most important word in each line, decide which words should be peaks and which should be held, then write or adjust the notes to fit.
- **Melody first:** map the strong beats, the long notes and the high notes, then choose words whose stresses land on the strong positions and whose vowels suit the long and high notes.
- **Fixing a mismatch:** see what is locked, then make the smallest change: a pickup or a note shift first, a word swap next, a rewrite last.

Related skills: syllables (counts and stress), rhymes (closure), lyrics, melody.
