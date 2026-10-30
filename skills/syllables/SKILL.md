---
name: syllables
description: Make lyric lines fit the notes they are sung on. Counts and stress come from Ode's pronunciation check in UK or US English, including words with more than one sung count (every 2|3, fire 1|2). Ode reviews the intended setting and rewrites the requested line in place when needed, using verse 1 as a reference when verse 2 is meant to share its melody. Use this whenever a count matters — "Fit to the melody", "fit verse 2, line 3", a line that feels cramped, rushed or one note short, a count the musician doubts, new words for an existing topline or MIDI clip, and every time you write or change a line that is sung on notes, even when the word "syllables" goes unsaid.
---

# Syllables and stress

A melody is a row of notes with a rhythm; a lyric line is a row of syllables with a stress pattern. A one-syllable-per-note setting often aligns speech stresses with musical weight; melismas, extra rhythmic attacks and deliberate stress shifts offer other settings. The count is only half the fit: "BEAU-ti-ful" and "to-MOR-row" both have three syllables, and they fit different three-note rhythms.

Always count with the syllable check. Words like "every", "fire", "family" and "really" trip up people and models alike. The check supplies pronunciation candidates for the selected UK or US setting; the musician's sung pronunciation takes precedence.

## The notes a line is sung on

- **Find the line.** Lines are found by their label and number in the lyrics: "[Verse 2] line 3" is the third sung line under the [Verse 2] label. Labels and blank lines go unsung.
- **Find the melody.** The vocal melody is a MIDI clip: the lead sheet's links name it when Ode made it; otherwise it is on the MIDI track named for the vocal or topline (Lead vocal, Vocal melody, Topline, Melody). Take the clip that covers the section's bars (the section's position in the lead sheet, or its locator).
- **Fit the lines to it.** The lyrics-to-melody check takes the section's lines and the melody's notes in its bars, splits the melody into one phrase per line (line 1 on the first phrase, line 2 on the second, and so on), and gives each line its syllable counts, its phrase's note count and any stress problem.
- **Count the notes, then inspect the setting.** One syllable per note is a common starting point. One syllable may span several notes (a melisma); several syllables may require rhythmic articulation not represented in a sustained MIDI note. A count mismatch can expose a missing mapping rather than a lyric fault.
- **Without a melody yet:** when the sections will share a setting, the matching line is a useful reference (verse 1, line 3 for verse 2, line 3): its count and its stress pattern.
- **Only a recorded vocal, without a MIDI melody:** use the matching line as the reference, and say in the result line that the count was checked against that line alone.

## The loop

1. **Read.** The line in the lyrics, the notes it is sung on, the matching line in the matching section, and the Pronunciation setting (the song's, else the artist's). Check whether the musician has said how they sing a word, and whether the hand edits since the last request changed the melody: their newest notes are the ones that count.
2. **Decide.** For a words-only request, keep the melody; otherwise follow which material the musician wants to preserve or change. First find the words that carry the meaning (the image, the rhyme word, the title) and protect them. Then make the smallest change that fits: the other count of a variable word, a contraction that really saves a syllable, cutting filler, a shorter word with the same meaning, a restructured phrase. Change the notes when that is within the request ("Split a note", setting locked words, or adapting the melody to new words). "Merge two syllables" means singing two syllables as one: the shorter count of a variable word, or a sung elision ("ev'ry"); the lyrics keep the normal spelling unless the musician writes the apostrophe.
3. **Change in place.** Rewrite the line in the lyrics: the same line under the same label, saved against the revision you read (the lyrics skill explains the text). When the fix is in the notes, edit the existing melody clip: split one note into two of the same pitch, merge two notes into one, or add a pickup, keeping everything else as it was. Keep one version of each line, clip and take: Again gives another take and the version history keeps this one.
4. **Verify** every line you changed:
   - **Lyrics-to-melody check.** Compare counts with the actual intended setting, allowing melismas and deliberate articulation. "10|11" means the check offers two counts; choose the sung reading. Without a melody, matching-line counts are a reference only when that setting is wanted.
   - **Stress.** Run the prosody check on the line against its notes: inspect which syllables receive emphasis and whether any flagged difference is intended. A different stress pattern can be a musical choice.
   - **Chosen pronunciation.** When a line uses "every" as two syllables, set that phrase as "ev-ry". Other phrases may use another reading when the musician intends it.
   - **Rhyme.** If you changed a line's last word, run the rhyme check again in the musician's accent: retain or change the rhyme according to the request, including a near rhyme or no rhyme.
   - **Uncertain words.** A name, slang or an invented word may have an unconfirmed pronunciation. The check marks it; that line counts as unchecked, and the result line says so.
   Fix unintended mismatches and check again, up to three rounds; name any remaining warning or deliberately retained departure.
5. **Let them hear it.** The result line says where the change is, so the musician can play it and sing it over the track: moved notes by their bars; a changed line by its label, which names the locator to play from.
6. **Report in one line**: what changed · what was checked. Write counts the way the check gives them, with every possible count and the variable word:
   - "Verse 2, line 3 now 'I kept the ticket from the train' · 8 syllables on its 8 notes, stress on the beats."
   - "Chorus line 1, 'Every window's lit tonight', already fits its 7 notes with 'every' sung 'ev-ry' (7|8) · left as written, stress on the beats."
   - "Verse 1, line 2 now 9|10 on its 9 notes ('fire' as one syllable) · 'Marisol' pronunciation uncertain."

## Asking

A count fix goes ahead without a question: the request says which line, and the history keeps the old one. If the musician tells you they sing a word differently, believe them and use their count. Keep pronunciation for this song in lead_sheet.settings; use an artist preference only when they explicitly make it enduring. In Manual, Ode shows the change for Apply or Skip, and you work the same way.

## Why counts matter

- **Counts describe one possible mapping.** A line with fewer syllables than notes can use melisma; extra syllables may call for rhythmic articulation, additional notes or fewer words. Inspect what the singer actually intends before changing it.
- **When melodies repeat,** review the new words against their intended phrase. Matching counts and stress patterns make a syllabic setting easier; varied phrasing, melismas or an authorised melody change can also work.
- **Stress drives rhythm.** Stressed syllables want strong beats and longer notes; unstressed ones want weak beats and shorter notes (the prosody skill covers this). A matching count can still hide an unintended stress problem; deliberate stress displacement can be expressive.
- **Density sets the feel.** More syllables per bar sounds urgent or conversational; fewer sounds spacious or anthemic. Match the density to the section's job.

## Reading stress

- **Every word of two or more syllables has a fixed main stress:** to-MOR-row, BEAU-ti-ful, a-LONE, YES-ter-day. Singing a word against its stress ("TO-mor-row") is the most noticeable fit problem a line can have.
- **Long words also carry a secondary stress** (UN-der-STAND, CON-ver-SA-tion), which can take a medium beat.
- **Content words** (nouns, main verbs, adjectives, adverbs, and negatives such as "not" and "can't") normally carry the stress in a line. **Function words** (a, the, of, to, and, in, my, your, is) are usually unstressed and weakened: "to" sounds like "tuh". Long or high function words draw attention; keep that emphasis when it is intended.
- **Stress can move for meaning.** "I didn't say YOU did it" and "I didn't SAY you did it" are different lines. Decide which word the line is really about and give it the strongest beat.
- **Some words change stress with their job**, such as "record" (a RE-cord, to re-CORD) or "present". The check gives the usual one first; when the line means the other, say which stress the line needs.

## Words with more than one sung count

Many words can be sung with different numbers of syllables. The check lists all of them; the melody decides which is used.

- **A weak vowel that drops:** every (2|3), different (2|3), family (2|3), history (2|3), memory (2|3), favourite/favorite (2|3), evening (2|3), heaven (1|2).
- **A vowel before "r" that can merge into one syllable or stay as two:** fire, hour, our, power, flower (1|2), desire (2|3).
- **Others:** "real" (1|2), "quiet" (1|2 in UK English); in British English, an unstressed "-ia" or "-ual" ending, as in "India" or "actual", can be one syllable or two.

How to use them:
- When a line is one syllable over, a variable word may already make it fit: say "fits with 'every' sung 'ev-ry'" and leave the line as it is.
- When matching a repeated setting, check which reading each phrase needs rather than imposing one pronunciation on the whole song.
- Prefer the count the musician would naturally sing. Stretching "fire" into two full syllables in a fast line, or squeezing "family" into two in a slow, exposed one, can sound unnatural.

`references/words-to-watch.md` has longer lists: variable words, words that are easy to miscount, contractions and UK–US differences.

## Elisions and contractions

- **Contractions often save a syllable and sound conversational:** I am → I'm, do not → don't, will not → won't, you are → you're, it is → it's, let us → let's.
- **Some contractions keep the count.** "Should've", "could've" and "would've" are still two syllables, and "didn't", "isn't" and "couldn't" are usually sung as two, like the full forms. Check the line again after contracting.
- **Informal forms:** going to → gonna saves one (3 → 2); want to → wanna and got to → gotta keep the count but smooth the sound. Dropping the g ("runnin'") keeps the count. Use these only if they're in the musician's register.
- **Sung elisions:** a weak vowel can drop when sung ("ev'ry", "heav'n", "fam'ly"). Keep the normal spelling in the lyrics unless the musician writes the apostrophe, and use that count when setting the line to notes.
- **Un-contracting** adds a syllable and adds weight: "I do not care" puts the stress on "not".
- **Running words together** ("I'm-a", "what'cha") belongs to some styles and some singers; follow the musician's habits.

## Matching verse 2 to verse 1

1. Run the syllable and stress checks on the reference lines (usually verse 1, or the melody itself).
2. Run them on the new lines, line by line.
3. Where they differ unintentionally, change the requested material: words for a words-only edit, notes when melody adaptation is authorised.
4. Review stress as well as count, retaining a different pattern or delivery when that is the musician's choice.

Easy to absorb: an extra unstressed pickup syllable before the downbeat ("and", "but", "so"), which singers fit in with a quick note all the time. Hard to absorb: anything at the end of a line, where the long notes and the rhyme usually are.

## Changing a line's count without losing its meaning

**To remove syllables:** cut filler (just, really, so, oh) and articles where the line still sounds natural; contract where it really saves a syllable; swap a long word for a shorter one that means the same and suits the register; use the shorter count of a variable word; restructure ("the door of the car" → "the car door").

**To add syllables:** un-contract for emphasis; add a detail that means something (a colour, a name, a time), so every added syllable carries meaning; add a natural pickup word ("and", "but", "so", "now"); choose a longer word that says the same thing; repeat a word for emphasis if the style allows it.

After any change, run the checks again and read the line aloud: it must still sound like something a person would say.

### Worked example

The musician types "fit verse 1, line 2". The lyrics-to-melody check gives *I can't remember what you said to me* 10 syllables on a phrase of 8 notes in a da-DUM da-DUM da-DUM da-DUM rhythm.

- The words that matter: "can't remember" and "what you said".
- Smallest change: cut "to me". *I can't remember what you said* is 8 syllables, stressed on CAN'T, -MEM-, WHAT and SAID, which lands every stress on a beat; the prosody check passes it.
- Passed over: *What did you say? I can't recall* is also 8 syllables, and it starts on a stressed syllable where the rhythm has an unstressed one, so the prosody check flags it. Same count, wrong pattern.
- The line is rewritten in place and the result line reads: "Verse 1, line 2 now 'I can't remember what you said' · 8 syllables on its 8 notes, stress on the beats."

## UK and US differences

The check follows the accent in the settings; expect these kinds of difference when choosing words.

- **Some words change count.** Words ending in -ary, -ery and -ory keep a secondary stress on the ending in US English (CEM-e-ter-y, FEB-ru-ar-y), so the ending is a full syllable that can take a beat. In UK English the ending is weak and often shortened (CEM-e-try), so the UK form may have one syllable fewer.
- **Some words change stress:** garage (UK GA-rage, US ga-RAGE), ballet (UK BAL-let, US bal-LET), address (UK ad-DRESS; US often AD-dress as a noun), laboratory (UK la-BOR-a-to-ry, US LAB-ra-to-ry). A stress shift moves which syllable wants the strong beat.
- **"R" after a vowel** is pronounced in US English and silent in UK English. It usually keeps the count; it changes how "fire", "hour" and "heart" sound on held notes, and it changes rhymes (the rhymes skill covers that).
- **Vowel differences** (the "a" in "dance", "bath", "can't") keep the count; they change rhymes and how a held note sounds.

Related skills: prosody (stress against the beat, vowels on long notes), lyrics, rhymes.
