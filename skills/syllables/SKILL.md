---
name: syllables
description: Make lyric lines fit the notes they are sung on. Counts and stress come from Ode's pronunciation check in UK or US English, including words with more than one sung count (every 2|3, fire 1|2). Ode rewrites the line in place in the lead sheet until one of its counts equals its notes, and makes verse 2 sit where verse 1 sits. Use this whenever a count matters — a red count like "9/8" in the Lyrics tab, "Fit to the melody", "Set to melody", a line that feels cramped, rushed or one note short, new words for an existing topline or MIDI clip, and every time you write or change a line that is sung on notes, even if nobody says "syllables".
---

# Syllables and stress

A melody is a row of notes with a rhythm; a lyric line is a row of syllables with a stress pattern. They fit when the line has as many syllables as the notes it is sung on and its stressed syllables land where the music puts its weight. Count alone is not enough: "BEAU-ti-ful" and "to-MOR-row" both have three syllables, and they don't fit the same three notes.

Never count by eye. Words like "every", "fire", "family" and "really" trip up people and models alike; the syllable check doesn't, and it knows the musician's accent.

## The notes a line is sung on

- **Find the melody.** The vocal melody is a MIDI clip: the lead sheet's links name it when Ode made it; otherwise it is on the MIDI track named for the vocal or topline (Lead vocal, Vocal melody, Topline, Melody). Take the clip that covers the section's bars (the section's position in the lead sheet, or its locator).
- **Split it into phrases at the rests.** Line 1 of the section is sung on the first phrase, line 2 on the second, and so on.
- **Count the notes.** Each note is a place for one syllable. One syllable may stretch over several notes (a melisma), best on an open, stressed vowel; two syllables can't share one note.
- **No melody yet:** the matching line in the matching section is the reference (verse 1, line 3 for verse 2, line 3): its count and its stress pattern.
- **Only a recorded vocal, no MIDI melody:** use the matching line as the reference, and say in the result line that the count wasn't checked against notes.

## The loop

1. **Read.** The line in the lead sheet, the notes it is sung on, the matching line in the matching section, and the Pronunciation setting (the song's, else the artist's). Check whether the musician has said how they sing a word, and whether the hand edits since the last request changed the melody: their newest notes are the ones that count.
2. **Decide.** Change the words by default: the melody is the musician's. First find the words that carry the meaning (the image, the rhyme word, the title) and protect them. Then make the smallest change that fits: the other count of a variable word, a contraction that really saves a syllable, cutting filler, a shorter word with the same meaning, a restructured phrase. Change the notes instead only when the words are locked or the musician picked that fix ("Split a note"). "Merge two syllables" means singing two syllables as one: the shorter count of a variable word, or a sung elision ("ev'ry"); the lead sheet keeps the normal spelling unless the musician writes the apostrophe.
3. **Change in place.** Rewrite the line's text in the lead sheet: the same line, in the same section. When the fix is in the notes, edit the existing melody clip: split one note into two of the same pitch, merge two notes into one, or add a pickup, keeping everything else as it was. Never add a line, a clip or a take to offer an alternative; Again gives another take and the version history keeps this one.
4. **Verify** every line you changed:
   - **Syllable check.** The line fits when one of its counts equals the number of notes it is sung on (with no melody, the matching line's count). "10|11" means the line can be sung either way; the melody decides which.
   - **Stress.** Run the prosody check on the line against its notes: no stressed syllable should sit on a weaker note than its unstressed neighbours. With no melody, the stress check's pattern should match the matching line's.
   - **One pronunciation throughout.** When a line fits because "every" counts as two syllables, it is sung "ev-ry" when set to the notes, and the same in the matching verse.
   - **Rhyme.** If you changed a line's last word, run the rhyme check again in the musician's accent: the rhyme it had must still be there.
   - **Uncertain words.** A name, slang or an invented word may have no confirmed pronunciation. The check marks it; never report that line as checked, and say so in the result line.
   Fix and check again, up to three rounds; if the line still doesn't fit, the result line says what fails.
5. **Let them hear it.** After your turn Ode plays the bars where the changed line is sung, so the musician can sing it over the track. You don't start playback.
6. **Report in one line**: what changed · what was checked. Write counts the way the check gives them, with every possible count and the variable word:
   - "Verse 2, line 3 now 'I kept the ticket from the train' · 8 syllables on its 8 notes, stress on the beats."
   - "Chorus line 1, 'Every window's lit tonight', already fits its 7 notes with 'every' sung 'ev-ry' (7|8) · left as written, stress on the beats."
   - "Verse 1, line 2 now 9|10 on its 9 notes ('fire' as one syllable) · 'Marisol' pronunciation not certain."

## Asking

A count fix never needs a question: the request says which line, and the history keeps the old one. If the musician tells you they sing a word differently, believe them and use their count. In Let me hear it, never ask; in Manual, Ode shows the change for Apply or Skip, and you work the same way.

## Why counts matter

- **Each syllable needs a note.** A line with fewer syllables than notes can hold some syllables over two notes; a line with more syllables than notes needs extra notes or fewer words.
- **Melodies repeat.** Verse 2 is sung to verse 1's melody, so matching lines need the same count and a similar stress pattern, or the melody has to change.
- **Stress drives rhythm.** Stressed syllables want strong beats and longer notes; unstressed ones want weak beats and shorter notes (the prosody skill covers this). A line with the right count and the wrong stress pattern still sounds wrong.
- **Density sets the feel.** More syllables per bar sounds urgent or conversational; fewer sounds spacious or anthemic. Match the density to the section's job.

## Reading stress

- **Every word of two or more syllables has a fixed main stress:** to-MOR-row, BEAU-ti-ful, a-LONE, YES-ter-day. Singing a word against its stress ("TO-mor-row") is the most noticeable fit problem a line can have.
- **Long words also carry a secondary stress** (UN-der-STAND, CON-ver-SA-tion), which can take a medium beat.
- **Content words** (nouns, main verbs, adjectives, adverbs, and negatives such as "not" and "can't") normally carry the stress in a line. **Function words** (a, the, of, to, and, in, my, your, is) are usually unstressed and weakened: "to" sounds like "tuh". Keep function words off long and high notes.
- **Stress can move for meaning.** "I didn't say YOU did it" and "I didn't SAY you did it" are different lines. Decide which word the line is really about and give it the strongest beat.
- **Some words change stress with their job**, such as "record" (a RE-cord, to re-CORD) or "present". The check gives the usual one first; when the line means the other, say which stress the line needs.

## Words with more than one sung count

Many words can be sung with different numbers of syllables. The check lists all of them; the melody decides which is used.

- **A weak vowel that drops:** every (2|3), different (2|3), family (2|3), history (2|3), memory (2|3), favourite/favorite (2|3), evening (2|3), heaven (1|2).
- **A vowel before "r" that can merge into one syllable or stay as two:** fire, hour, our, power, flower (1|2), desire (2|3).
- **Others:** "real" (1|2), "quiet" (1|2 in UK English); in British English, an unstressed "-ia" or "-ual" ending, as in "India" or "actual", can be one syllable or two.

How to use them:
- When a line is one syllable over, a variable word may already make it fit: say "fits with 'every' sung 'ev-ry'" and change nothing.
- When matching verses, make sure both lines use the same choice.
- Prefer the count the musician would naturally sing. Stretching "fire" into two full syllables in a fast line, or squeezing "family" into two in a slow, exposed one, can sound unnatural.

`references/words-to-watch.md` has longer lists: variable words, words that are easy to miscount, contractions and UK–US differences.

## Elisions and contractions

- **Contractions often save a syllable and sound conversational:** I am → I'm, do not → don't, will not → won't, you are → you're, it is → it's, let us → let's.
- **Not every contraction saves one.** "Should've", "could've" and "would've" are still two syllables, and "didn't", "isn't" and "couldn't" are usually sung as two, like the full forms. Check the line again after contracting.
- **Informal forms:** going to → gonna saves one (3 → 2); want to → wanna and got to → gotta keep the count but smooth the sound. Dropping the g ("runnin'") doesn't change the count. Use these only if they're in the musician's register.
- **Sung elisions:** a weak vowel can drop when sung ("ev'ry", "heav'n", "fam'ly"). Keep the normal spelling in the lead sheet unless the musician writes the apostrophe, and use that count when setting the line to notes.
- **Un-contracting** adds a syllable and adds weight: "I do not care" puts the stress on "not".
- **Running words together** ("I'm-a", "what'cha") belongs to some styles and some singers; follow the musician's habits.

## Matching verse 2 to verse 1

1. Run the syllable and stress checks on the reference lines (usually verse 1, or the melody itself).
2. Run them on the new lines, line by line.
3. Where they differ, change the words of the new line. Changing the melody (splitting a note, tying two, adding or dropping a pickup) is the musician's call: do it when they ask or when the words are locked.
4. Fix stress as well as count: the stressed syllables in the new line should land where the reference line's do.

Easy to absorb: an extra unstressed pickup syllable before the downbeat ("and", "but", "so"), which singers fit in with a quick note all the time. Hard to absorb: anything at the end of a line, where the long notes and the rhyme usually are.

## Changing a line's count without losing its meaning

**To remove syllables:** cut filler (just, really, so, oh) and articles where the line still sounds natural; contract where it really saves a syllable; swap a long word for a shorter one that means the same and suits the register; use the shorter count of a variable word; restructure ("the door of the car" → "the car door").

**To add syllables:** un-contract for emphasis; add a detail that means something (a colour, a name, a time) rather than filler; add a natural pickup word ("and", "but", "so", "now"); choose a longer word that says the same thing; repeat a word for emphasis if the style allows it.

After any change, run the checks again and read the line aloud: it must still sound like something a person would say.

### Worked example

The verse melody's phrase has 8 notes in a da-DUM da-DUM da-DUM da-DUM rhythm. The musician taps the red count on *I can't remember what you said to me*: 10 syllables on 8 notes.

- The words that matter: "can't remember" and "what you said".
- Smallest change: cut "to me". *I can't remember what you said* is 8 syllables, stressed on CAN'T, -MEM-, WHAT and SAID, which lands every stress on a beat; the prosody check reports no problems.
- Not chosen: *What did you say? I can't recall* is also 8 syllables, but it starts on a stressed syllable where the rhythm has an unstressed one, and the prosody check flags it. Same count, wrong pattern.
- The line is rewritten in place and the result line reads: "Verse 1, line 2 now 'I can't remember what you said' · 8 syllables on its 8 notes, stress on the beats."

## UK and US differences

The check follows the accent in the settings; expect these kinds of difference when choosing words.

- **Some words change count.** Words ending in -ary, -ery and -ory keep a secondary stress on the ending in US English (CEM-e-ter-y, FEB-ru-ar-y), so the ending is a full syllable that can take a beat. In UK English the ending is weak and often shortened (CEM-e-try), so the UK form may have one syllable fewer.
- **Some words change stress:** garage (UK GA-rage, US ga-RAGE), ballet (UK BAL-let, US bal-LET), address (UK ad-DRESS; US often AD-dress as a noun), laboratory (UK la-BOR-a-to-ry, US LAB-ra-to-ry). A stress shift moves which syllable wants the strong beat.
- **"R" after a vowel** is pronounced in US English and silent in UK English. It doesn't usually change the count, but it changes how "fire", "hour" and "heart" sound on held notes, and it changes rhymes (the rhymes skill covers that).
- **Vowel differences** (the "a" in "dance", "bath", "can't") don't change the count, but they change rhymes and how a held note sounds.

Related skills: prosody (stress against the beat, vowels on long notes), lyrics, rhymes.
