# Make your first song with Ode

We are going to make **Night Walk**, a short electronic song about walking home with someone and not wanting the night to end. We will start with a sentence in Ode, develop it into lyrics, and sing them against a melody guide in Live. Then we will work with Ode to fix crowded wording, awkward accents and uncomfortable notes before building the accompaniment, arranging and exporting the song.

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

## Start the song in Ode

Open Ode's side panel with the button at the top right, then choose **Lyrics**. Keep the conversation visible beside it. You will use the chat to develop the song with Ode and the Lyrics panel to read and edit the resulting text.

![Ode's Lyrics panel](images/tutorial/11-ode-lyrics.jpg)

Click Ode's message box and send this sentence:

> I want to write a song about taking the long way home with someone because I don't want to say goodbye yet.

This gives Ode the situation and the feeling behind it. Read its reply, then add a detail that the lyrics can build on:

> We could have caught the last bus, but neither of us suggested it. Can you turn that into a first verse? Put it in Lyrics so we can work on it.

Now look in **Lyrics**. The first verse belongs in the document, where you can read its lines together while continuing the conversation. Read it aloud. Listen for whether it sounds like someone speaking to the person beside them, and whether the scene expresses the hesitation you started with.

## Develop the lyrics with Ode

Choose a detail from the verse that you want to develop. To keep the missed bus as a shared choice, send:

> I like the bit about the bus. Make it feel like we both let it go, rather than one of us being left behind.

Read the updated verse in Lyrics. The event can stay the same while the wording changes who wants to remain there. This is a lyric revision about meaning: you are giving Ode feedback on the story before deciding how to sing it.

Next, take a shorter phrase from your original sentence and suggest it as the chorus:

> Could “Take the long way home” be the chorus? I want that to be the part people remember.

The **chorus** is the returning section that carries the central idea; its recognisable phrase is the **hook**. Once Ode proposes a chorus, ask it to put the version you want to try in the document:

> Let's try that. Add it as the chorus in Lyrics, and keep the verse.

Read the two sections together in Lyrics. The verse should establish the walk and the missed opportunity to go home, while the chorus turns the feeling into something the narrator can say to the other person. To make the last line recall the bus, continue:

> Can the chorus end with “We just let the last bus go”? I like having that little moment come back.

Example chorus draft:

```text
[Chorus]
Take the long way home
Past the places that we know
We could keep on walking for another mile
We just let the last bus go
```

Read the chorus in Lyrics, then ask Ode for a melody so you can try singing the words.

## Create a vocal melody in Live

In the same conversation, ask:

> Can we find a tune for the chorus? Something warm and easy to remember. Put a simple guide on Live's timeline so I can sing along.

Ode can create a **MIDI clip**, which holds the pitches, starting times and lengths of the notes. An instrument on its track turns those notes into sound. The guide plays the melody for you to sing against; recording your own vocal comes later.

Select the guide clip in Live. Press **Shift+Tab** if the lower panel shows the instrument instead of the MIDI note editor. The rectangles are notes: their vertical position shows pitch, their horizontal position shows when they start, and their width shows duration. Click in Live and press **Space** to play or stop.

Back in Ode, send:

> Can you show which notes go with each syllable in Lyrics?

Ode associates the words with the actual MIDI notes in Live. In **Lyrics**, click inside a word and then click the **music-note button**, labelled **Edit melody**. Once its syllables are linked, their pitch and note-value controls become available. This lets you inspect the notes for the exact word you are working on while keeping the guide visible in Live.

Play the guide and sing the chorus aloud. Pay attention to where you run out of time, which words receive the strongest accents and whether the notes sit comfortably in your voice. Use what you hear to make the next request.

## Fit the words to the melody

For the example chorus, sing the third line, “We could keep on walking for another mile”. If you have to rush through it, return to Ode's chat and say:

> I'm running out of room on “We could keep on walking for another mile”. Can you shorten that line? I want to keep “another mile”, and I like the opening melody.

Ode can read the guide's actual notes and use their timing when proposing a shorter lyric. Review the proposed wording before applying it. One revision to try is “We can walk another mile”:

> Let's use “We can walk another mile”. Fit that into the third line, but leave “Take the long way home” as it is.

Look at the third line in Lyrics and play the guide again. You are checking both the changed text and how Ode fits it into the phrase. The chorus opening is the part you asked it to preserve.

To inspect the wording, open **View** in Lyrics and enable **Syllables** and **Syllable counts**. A **syllable** is a unit of pronunciation, usually centred on a vowel sound. After the text is checked, light dividers show its syllable boundaries and a count appears at the end of each line. The example revision removes four syllables:

| Wording | Syllables | Count |
| --- | --- | --- |
| We could keep on walking for another mile | We / could / keep / on / walk / ing / for / a / noth / er / mile | 11 |
| We can walk another mile | We / can / walk / a / noth / er / mile | 7 |

Sing the shorter wording against the revised guide. There should be enough space to say “another” clearly and finish “mile” without swallowing it. The syllable count helps explain the crowded line; singing it tells you whether the new phrasing works.

## Fix the melody while keeping the words

### Correct an awkward accent

Now keep the shorter text and listen to how the melody pronounces “another”. Its natural **word stress** is on the middle syllable, a-**NOTH**-er. A tune that gives too much weight to the last syllable can make the word sound unnatural. Tell Ode what you hear:

> The words fit now, but “another” sounds odd when I sing it. The tune leans on the last syllable. Can you put the weight on the middle one? Keep the words.

Here Ode needs to revise the musical phrase. Giving the middle syllable a more prominent note or changing its rhythmic placement can support the way the word is spoken. Play the updated MIDI guide and sing the line again, listening specifically to a-**NOTH**-er.

In Lyrics, click “another” and open **Stress** to inspect the pronunciation. The middle syllable should carry **Primary stress**. To inspect the musical change, open **Edit melody** for the same word and compare its linked pitches and note values with the notes in Live. Changing a stress mark alone does not change how the guide sounds; the correction must also reach the MIDI melody.

The fit between language, music and intended meaning is part of **prosody**. [Berklee's explanation of prosody](https://online.berklee.edu/takenote/prosody-in-music-and-songwriting/) describes how those elements work together in a song.

### Make a phrase comfortable to sing

If the end of the third line feels too high, send:

> The note on “mile” is too high for me. Can the end of that line come down a little? Keep the opening; I like that part.

Check “mile” in Lyrics and listen to the changed phrase in Live. This time the wording stays the same and Ode changes the **pitch**, how high or low the note sounds. Sing the whole chorus to hear how the revised ending connects to the next line.

If the whole chorus sits too high, ask instead:

> Can we move the whole chorus lower? I like the tune, but it's sitting too high for my voice.

Moving all its pitches by the same amount is **transposition**. It preserves the distances between the notes while moving the melody higher or lower. Sing it again to check that both its lowest and highest notes feel comfortable. When adding the accompaniment below, ask Ode to use the key you settled on for the vocal.

### Leave room to breathe

If “home” runs straight into the next line, ask:

> I need a breath after “home”. Can you leave a little space there without breaking up the chorus?

Ode can shorten the held note or move the next entrance to create a **rest**, a period when the melody is silent. Listen to the gap and sing through the transition. This is a change to **phrasing**: how the notes and words form a musical sentence, including its breathing spaces.

You can also make a small edit yourself. In Lyrics, select a linked word and open **Edit melody**. The first selector changes a note's pitch; the second changes its duration. In 4/4, a quarter note lasts one beat and a half note lasts two. Changing the duration leaves the next note's starting time in place, so ask Ode to adjust the surrounding phrase when the breath needs more room.

In [Live's MIDI editor](https://www.ableton.com/en/live-manual/12/editing-midi/), moving a note vertically changes its pitch, moving it horizontally changes its starting time, and dragging its right edge changes its duration. If an edit leaves **Review melody alignment** in Lyrics, ask Ode to read the current clip and reconnect the syllables to its notes.

## Write the verse melody

Once the chorus is comfortable, return to the chat:

> Give the verse a quieter, more conversational melody. Keep it lower than the chorus so “Take the long way home” feels like a lift when it arrives.

Play from the verse into the chorus, singing from the Lyrics panel. Check that the verse leads naturally into the chorus and that you have time to breathe between them. Ask Ode to revise any transition that makes you rush, then keep the vocal guide in the Set while you build the accompaniment.

## Create a bass line

In Ode, write:

> Let's build the backing around this vocal. I want a warm, late-night electronic feel. Can we start with a bass groove?

When Ode finishes, select the new bass clip in Live to inspect its notes. Keep the vocal guide playing while you listen to whether the bass supports the melody and leaves room for its phrases.

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
