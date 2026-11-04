# Make your first song with Ode

We are going to make **Night Walk**, a short electronic song about walking home with someone and not wanting the night to end. We will build a warm bass groove, add drums and chords, then write lyrics and fit them to a vocal melody before arranging and exporting the song.

If you have not installed Ode yet, follow [Getting started](getting-started.md), then come back here with Live and Ode open. That guide covers Live Beta, Max, the extension and your model settings.

## Create a new project

Choose **File → New Live Set**, then save it as **Night Walk**. A Set is Live's name for a project.

![A new Live Set with empty MIDI and audio tracks](images/tutorial/03-blank-live-set.jpg)

*A new Set in Session View. The empty slots will hold musical clips as you build the song.*

Load one `Ode.amxd` device on **Main**, the track that receives the combined sound from the other tracks, and click **Open Ode**. In Ode's song menu, choose **New song…** and call that **Night Walk** too. Live's Set and Ode's song context are separate: the matching names help you keep the music and its conversation together.

Keep Live on the left of your screen, with roughly sixty per cent of the space, and Ode on the right. You want enough room to see the notes and tracks while keeping the conversation readable. Close Live's Browser when you are not choosing a sound; that gives the music more room.

![Live on the left and Ode on the right, with the New song menu open](images/tutorial/06-live-and-ode.jpg)

*Live and Ode in a 60/40 split, with **New song…** open.*

Use Live's **Arrangement View** for the rest of the walkthrough. If you still see the vertical clip slots from the first screenshot, click in Live and press **Tab** to switch views. The Arrangement timeline runs from left to right, so you will be able to watch a short idea grow into a song. Each horizontal track holds a part, such as bass, drums or melody. The numbered divisions across the top are bars, the repeating groups of beats that help musicians keep their place.

## Create a bass line

In Ode, write:

> I want a warm, late-night electronic track. Let's start with a bass groove.

When Ode finishes, look for the new bass part in Live. A **MIDI clip** holds the notes that an instrument plays. Select the clip and press **Shift+Tab** if you need to switch the lower panel from the instrument to the note editor. The rectangles are notes: higher ones play higher pitches, and longer ones last longer. The instrument on the track turns those notes into sound.

Click in Live and press **Space** to play; press it again to stop. Listen for a pulse you could build a beat around. A bass line can be interesting without filling every gap; the spaces between its notes will matter when the other parts arrive.

If the bass feels too busy, try “Make it softer and less restless.” If there is a phrase you like, tell Ode to keep it while changing the rest.

![A bass clip in Live's Arrangement timeline, with its notes open in the lower editor](images/tutorial/09-generated-midi-clip.jpg)

*A bass clip on the first track, with its individual notes open in Live's MIDI editor.*

To make a revision about a particular part, right-click its clip in Live and choose **Extensions → Ode: Ask Ode**. This gives Ode the clip as context along with your message. You can then describe what you want to change in ordinary musical terms.

![Ode's entries in Live's Extensions context menu](images/tutorial/05-ode-context-menu.jpg)

## Add drums

Once you want to keep the bass groove, give it something to move against:

> Add a relaxed drum groove around this. I want it to move, but still feel unhurried.

Ode can write the drum notes, but those notes need drum sounds. If it asks you to load a kit in Live's Browser, load the kit it names before continuing.

Play the bass and drums together. The kick is the low drum that gives the beat its weight. The snare or clap often marks the second and fourth beats of a bar, giving the groove its backbeat. Listen to whether the bass and kick feel connected.

If the kick obscures the bass, ask Ode to give them more space. If the rhythm works but the drums feel too heavy, ask for a lighter sound while keeping the pattern.

Save the Set before adding the next part.

## Add chords

The bass gives the song a foundation, but you may still want a sense of mood and movement above it. Ask:

> Add some soft chords. Keep them out of the bass's way and leave plenty of space.

A chord is a group of notes played together. A sequence of chords can make the same bass groove feel settled, tense, hopeful or unresolved. Listen to a complete pass of the sequence before deciding whether it fits the late-night idea.

Look at the new track in Live as you listen. You can select its clip to see how its notes line up with the bass and drums. Watch where the chords change, and listen to how that changes the feeling of the groove.

If the chords make the track feel too sweet, too dramatic or too crowded, tell Ode that. Keep the part of the original idea you still want. A message such as “Keep the warmth, but make the chords a little more melancholy” gives it a direction to revise towards.

## Write the lyrics

Give Ode the story behind the track:

> I want to sing over this. It's about walking home with someone and taking the long way because I don't want the night to end. Keep the words conversational, with little details from the walk.

Open Ode's side panel with the button at the top right, then choose **Lyrics**. You and Ode edit the same lyric document here.

![Ode's Lyrics panel](images/tutorial/11-ode-lyrics.jpg)

Paste this starting draft into the editor. The bracketed labels mark the song's sections.

```text
[Verse 1]
The corner shop is closing
You stop to tie your shoe
I could be home by now
But I keep pace with you

[Chorus]
Take the long way home
Past the places that we know
We can walk another mile
There's no hurry; let's go slow
```

The verse describes a moment on the walk. The chorus returns to the central idea, “Take the long way home.” That repeated, recognisable phrase is the song's **hook**.

Try revising one line with Ode while preserving the rest:

> Keep the verse and the first three lines of the chorus. “There's no hurry; let's go slow” sounds too much like an instruction. Can you find a more personal last line that still rhymes with “know”?

Review the replacement in Lyrics and read the chorus aloud over the groove. “Know” and “slow” share the same ending vowel sound and form a **perfect rhyme**; the replacement can keep that rhyme without repeating the same wording. In **View → Rhyme scheme**, matching letters identify the endings Ode thinks rhyme. The **Perfect rhymes** control beside a section name sets that section's rhyme preference.

## Check syllables and emphasis

A **syllable** is a unit of pronunciation, usually centred on a vowel sound. “Take the long way home” has five syllables, while “We can walk another mile” has seven because “another” has three. The longer line does not necessarily need more bars: some syllables can use shorter notes while an important word is held.

In the Lyrics **View** menu, enable **Syllables**, **Syllable counts** and **Emphasis**. After the text has been checked, light dividers show syllable boundaries, a count appears at the end of each line, and dots mark strongly emphasised syllables. You can also enable **Line details** to read the analysis for each line.

There are two different choices to check:

- **Word stress** is part of pronunciation. In “another”, the middle syllable has the main stress: a-**NOTH**-er. Click inside that word and choose **Stress**. If the split needs correcting, open **Syllable division** and enter `a noth er`; the pieces must retain the word's spelling. Set the middle syllable to **Primary stress** and the other two to **Unstressed**, then click **Save**.
- **Sung emphasis** expresses what matters in the phrase. Select the line “We can walk another mile”, choose **Emphasis**, then select “mile” and choose **Emphasised**. Click **Save**. This marks the word you want the performance to bring forward.

These choices describe how you intend to sing the words. To hear that intention, the melody must also support it: a longer note, a prominent pitch or a rhythmic accent can bring “mile” forward. This relationship between the words, music and intended meaning is part of **prosody**. [Berklee's explanation of prosody](https://online.berklee.edu/takenote/prosody-in-music-and-songwriting/) describes how those elements work together in a song.

## Create a melody

Ask Ode to set the chorus to music:

> Write a simple vocal melody for this chorus. I want “Take the long way home” to be the part people remember. Keep it comfortable to sing, start with one note per syllable and leave a breath between the lines. Put a guide in Live and link the notes to the words in Lyrics.

Ode creates the guide as MIDI notes played by an instrument in Live. Sing the words along with that part. The guide lets you hear the **pitch** of each note, how long it lasts and when each syllable enters; it does not record or synthesise a sung vocal.

One note per syllable is a **syllabic** setting. The first line therefore starts with five syllables assigned to five notes. The notes can repeat the same pitch, and they need not all have the same length. Sing “Take the long way home” and notice whether “home” has enough time to settle before the next line begins.

Now sing “We can walk another mile”. Listen for the stress on a-**NOTH**-er. If the tune gives the last syllable more prominence and makes the pronunciation awkward, describe the problem:

> “Another” sounds awkward when I sing it. Let the middle syllable carry the word, then give “mile” a little more room. Keep the opening line as it is.

Here you are revising **phrasing**: the way the words and notes form a musical sentence, including accents and breathing spaces. A seven-syllable line can fit comfortably if its rhythm supports the way you say it. Merely matching the number of syllables to the number of notes does not guarantee that fit.

## Edit the melody

You can change a linked note directly in Lyrics. Click inside a word, then click the **music-note button**, labelled **Edit melody**. It becomes available when Ode has linked the lyric to MIDI notes. Each linked syllable shows a pitch selector and a note-value selector; a syllable with several notes shows controls for each one.

Try these edits while listening to the chorus:

1. **Change a pitch.** Select “mile” and choose a lower pitch in its first selector if the phrase feels too high to sing. This changes the height of the note while keeping its starting position and duration. To lower the whole phrase, ask Ode to **transpose** it: move all its notes down by the same amount, preserving the melody's shape.
2. **Change a note length.** Select “home” and use the second selector to hold its note longer. The choices show note symbols and durations. In 4/4, a quarter note lasts one beat and a half note lasts two. Changing this value changes the note's duration; it leaves the next note's starting position in place.
3. **Change the rhythm of a phrase.** If the longer note leaves too little room before the next line, ask: “Let me hold ‘home’ longer, then leave a breath before the next line.” Ode can adjust the surrounding timing as well as the held note.

These selectors edit the actual MIDI notes in Live. You can also select the guide clip in [Live's MIDI editor](https://www.ableton.com/en/live-manual/12/editing-midi/): moving a note vertically changes its pitch, moving it horizontally changes its starting time, and dragging its right edge changes its duration.

If you change the words, their syllable divisions or the MIDI in Live and see **Review melody alignment**, ask Ode to read the current melody and reconnect the syllables to the notes. Then continue editing from those updated associations.

Finish by asking for a verse melody that leads into the chorus:

> Give the verse a quieter, more conversational melody. Keep it lower than the chorus so “Take the long way home” feels like a lift when it arrives.

Sing both sections back to back. Check the **vocal range**, the distance from the lowest to the highest note, as well as the individual leaps and breathing spaces. When the guide fits your voice, you can record the vocal on an audio track in Live.

## Arrange the song

A loop repeats the same passage. An arrangement decides when each part enters, how the energy changes and where the music comes to rest. Once the parts work together, ask:

> Arrange this into a short song. Start quietly, build from the verse into a fuller chorus, then bring the chorus back once more before the ending.

The **verse** develops the story, while the **chorus** returns to the hook. The opening can introduce the accompaniment before the first verse.

Watch the Arrangement timeline as Ode works. Instead of a single group of clips, you should be looking for passages that do different jobs. Play from the beginning rather than judging only the fullest section. The important change is what it feels like to arrive there after the opening.

If the chorus feels too similar to the section before it, explain the effect you want:

> I want the chorus to feel like it opens up, without just getting louder.

Ode can revise which parts enter, their rhythms or their sounds. Afterwards, play the transition again to hear whether the chorus has the lift you wanted.

To give the returning chorus a small variation, ask:

> On the last chorus, let “home” move through two notes before it settles. Keep the earlier chorus simple.

Singing one syllable across several pitches is a **melisma**. Holding “home” on a single pitch for longer is a sustained note; moving through two pitches on the same syllable makes it melismatic. The distinction between syllabic and melismatic settings is also covered in the [College Board music theory guide](https://apstudents.collegeboard.org/sites/default/files/2019-05/ap-music-theory-course-and-exam-description.pdf).

## Listen and revise

Stop editing for a moment and play the song through. Pay attention to the point where your interest drops, a part gets in the way or the ending arrives too suddenly. Pick the thing that most affects the song and talk about that first.

For example, if the drums obscure the vocal guide, say “The melody disappears when the drums come in.” If the final note ends too abruptly, try “The ending feels cut off; let it settle.”

With Meta configured, Ode can also listen to a recording from Live. You might ask:

> Listen to it as a whole. Do the parts feel balanced, or is anything getting in the way?

Give it time to capture and assess the actual sound, then listen to any changes yourself. The conversation helps you decide what to try; the music playing from Live is what you are making decisions about.

You can press **Stop** while Ode is working if you need to interrupt it. Changes already made may remain, so look at the Set before deciding what to do next. **History** can help you inspect retained changes and recover supported state, but keep saving the project in Live as well.

![Ode's History panel showing an initial version and changes observed during a bass request](images/tutorial/10-ode-history.jpg)

*History with the initial version and changes to the bass.*

## Save and export

When the song reaches a point you want to keep, save the Set. If you are about to try a larger change, use **Save Live Set As…** to keep a separate version first. That gives you a clear way back to the arrangement you liked.

To make an audio file you can play outside Live, select the whole song on the Arrangement timeline, allowing room for sounds that continue after the last note. Open **File → Export Audio/Video**. Choose **Main** under **Rendered Track** to export the combined mix, and **WAV** under **File Type** for a lossless audio file. Check the start, length and destination, then export. Ode leaves this final step to you. [Ableton's export guide](https://www.ableton.com/en/manual/managing-files-and-sets/#exporting-audio-and-video) explains the remaining options.

Play the exported file once before sharing it to check that the whole song is included, from its opening through its ending.
