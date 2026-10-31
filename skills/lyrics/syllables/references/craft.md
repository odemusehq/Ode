# Syllables and stress

Use `lyricist`, the model selected in Settings, for all lyric writing, rewriting, analysis and word-to-note alignment described here. Give it the current text, actual melody notes, relevant artist memory and the musician's directions. The main agent reads and saves the chosen result; it does not supply its own wording or run local language rules. These craft ideas are optional guidance for Lyricist, and the artist's intentional choices take priority.

A melody is a row of notes with a rhythm; a lyric line is a row of syllables with a stress pattern. A one-syllable-per-note setting often aligns speech stresses with musical weight; melismas, extra rhythmic attacks and deliberate stress shifts offer other settings. The count is only half the fit: "BEAU-ti-ful" and "to-MOR-row" both have three syllables, and they fit different three-note rhythms.

Ask `lyricist` to assess counts, stress and the intended pronunciation from the actual words and notes. Words like "every", "fire", "family" and "really" can have different sung readings. These are model assessments; Ode has no pronunciation dictionary, syllable counter or local rule engine. The musician's own delivery takes precedence.

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
- **Some words change stress with their job**, such as "record" (a RE-cord, to re-CORD) or "present". Ask Lyricist to interpret the word's role in this line; the musician's chosen delivery takes priority.

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

The musician types "fit verse 1, line 2". Lyricist's alignment review gives *I can't remember what you said to me* 10 syllables on a phrase of 8 notes in a da-DUM da-DUM da-DUM da-DUM rhythm.

- The words that matter: "can't remember" and "what you said".
- Smallest change: cut "to me". *I can't remember what you said* is 8 syllables, stressed on CAN'T, -MEM-, WHAT and SAID, which lands every stress on a beat; Lyricist's prosody review passes it.
- Passed over: *What did you say? I can't recall* is also 8 syllables, and it starts on a stressed syllable where the rhythm has an unstressed one, so Lyricist's prosody review flags it. Same count, wrong pattern.
- The line is rewritten in place and the result line reads: "Verse 1, line 2 now 'I can't remember what you said' · 8 syllables on its 8 notes, stress on the beats."

## UK and US differences

The check follows the accent in the settings; expect these kinds of difference when choosing words.

- **Some words change count.** Words ending in -ary, -ery and -ory keep a secondary stress on the ending in US English (CEM-e-ter-y, FEB-ru-ar-y), so the ending is a full syllable that can take a beat. In UK English the ending is weak and often shortened (CEM-e-try), so the UK form may have one syllable fewer.
- **Some words change stress:** garage (UK GA-rage, US ga-RAGE), ballet (UK BAL-let, US bal-LET), address (UK ad-DRESS; US often AD-dress as a noun), laboratory (UK la-BOR-a-to-ry, US LAB-ra-to-ry). A stress shift moves which syllable wants the strong beat.
- **"R" after a vowel** is pronounced in US English and silent in UK English. It usually keeps the count; it changes how "fire", "hour" and "heart" sound on held notes, and it changes rhymes (the rhymes skill covers that).
- **Vowel differences** (the "a" in "dance", "bath", "can't") keep the count; they change rhymes and how a held note sounds.

Related skills: prosody (stress against the beat, vowels on long notes), lyrics, rhymes.
