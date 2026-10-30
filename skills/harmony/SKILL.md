---
name: harmony
description: Choose, fix, reharmonize and voice chords directly in the Set. Ode rewrites the chord part's notes in place, keeps the bassline and the lead sheet's chord chart in agreement with the new chords, and reviews the intended melody–chord relationship, voice movement and low register, and checks chord-symbol spelling, then reports in one line which bars changed, so the musician can play them. Use this skill whenever a chord, keys, pad or guitar part is selected, or the musician clicks a suggestion or types anything about chords — "fresher chords", "less predictable", "darker", "brighter", "jazzier", "smoother voicing", "what goes under this melody", "this chord sounds wrong", a key change or a chord chart — whatever words they use.
---

# Harmony

Chords give a song its colour, its tension and rest, and its forward motion, and they decide how every melody note feels. Functional motion towards a cadence is one approach. Static harmony, independent lines, clusters and unresolved tension can also serve the song; the musician's direction decides. Ode changes the chords where they are, keeps every part that states them in agreement, and checks the result against the melody before the musician hears it.

## Conventions

- Chord symbols: C, Cm, C7, Cmaj7, Cm7, Cm7♭5 (half-diminished), Cdim7, Csus2, Csus4, Cadd9, C6, C/E (C major with E in the bass). Roman numerals show function: I, ii, V7, ♭VII, V/V.
- Note names are scientific pitch: middle C is C4, MIDI 60; Live's piano roll shows it as C3. Result lines use chord symbols, and Live's note names if a note must be named.
- Lengths are beats of 4/4. A chart line such as `| C | G/B | Am7 | Gsus4 G |` shows one bar per cell; two chords in a cell split the bar equally unless stated.
- Spell chords for the key: in E♭ major the IV chord is always A♭ (A♭–C–E♭).

## How Ode works on chords

### 1. Read

- From the project map: key and mode, tempo, meter, genre, the selected part and its bars, the sections.
- The chord part's notes — each chord from its pitch classes and its lowest note — and the lead sheet's chord chart for that section.
- The melody over these bars (the lead vocal or topline notes), the biggest constraint: its strong-beat notes, its held notes and its phrase endings.
- The bassline's notes on each chord change, the instruments that play the chords (piano, pad, guitar), and where the vocal sits, because they shape the voicing.
- The other sections' chords, what is locked, and the artist's chord vocabulary from memory: chords they have kept, and chords they have undone.

### 2. Decide

1. Mark the melody's strong-beat and held notes and its phrase endings; decide where cadences go and whether each ends open or closed.
2. For functional harmony, choose chords by function then colour; use a different organising idea when the song calls for it. Keep to the size of the request: "less predictable" changes a few chords and the bass line under them; the song's sound stays.
3. Set the harmonic rhythm.
4. Voice the chords: register, voice leading, and the bass note (root or inversion).

### 3. Change it in place

- Rewrite the notes of the chord part the musician pointed at; keep its clip, its bars and its rhythm pattern unless the request is about rhythm.
- When the chords change, update parts that are intended to state the same harmony: the bass notes on each chord change (keep the bass's rhythm and register), any other chord part in the same bars (a pad doubling the keys), and the lead sheet's chord chart for that section, edited in place.
- Keep the melody unless changing it is authorised. If a requested chord creates tension with it, explain the consequence briefly and honour the chosen chord; do not silently substitute a “better-fitting” one. Preserve deliberate pedals or independent bass lines too.
- A chord part still to be written is new material: a clip on the chord track at the section's bars.
- New clips, tracks and takes hold only new material; alternatives come from Again, which asks for another take with the Set back as it was: make it clearly different (another function, colour or bass line); the history keeps the old one.

### 4. Verify

Run relevant checks, distinguish unintended problems from chosen tension and fix only the former, up to three rounds. Report coverage and any remaining finding; musical checks are not pass/fail standards.

| Check | What to review |
|---|---|
| Melody fit | review accented and held melody notes against the chords, including extensions, suspensions and chosen dissonances; membership in the chord on beats 1 and 3 is not required |
| Clashes | identify close intervals and altered-note conflicts, such as C natural over A7; keep intentional friction, including an unresolved tone, rather than forcing stepwise resolution |
| Cadences | phrase ends land on the cadence you planned: open (V, IV, a sus chord) or closed (I) |
| Voice leading | compare movement with the intended texture: held common tones and small moves suit smooth writing; leaps, parallel shapes and crossings may be deliberate |
| Register | listen for unwanted low-register blur and vocal competition; C3 (MIDI 48) is a rough voicing guide whose usefulness depends on timbre and texture |
| Bass agreement | the chart describes intended roots, inversions or pedals; preserve an independent bass line when chosen |
| Spelling | the chord symbols in the lead sheet are spelled for the key |
| Range | after a key change, the melody still sits inside the singer's range |

Locked parts must be exactly as they were.

### 5. Let them hear it

When your turn ends, the musician presses play in Live: say in the result line which bars changed, so they know where to listen.

### 6. Report in one line

What changed, then " · ", then what was checked:

- "Chorus now Cmaj7 – Bm7♭5 E7 – Am7 – F6 G, bass following · every melody note on 1 and 3 fits, voices move by step, only the bass below C3."
- "Bar 4 borrows Fm so the A♭ falls to G under 'stay' · melody fits, bass on F."
- "Keys re-voiced: common tones held, top line moves by step under the vocal · same chords, clear of the vocal."

Name a new harmonic colour when useful; a requested expansion beyond earlier chord vocabulary needs no style warning.

## When to ask

Act without asking. The one question, a single line with buttons, comes only when the answer changes what Ode does:

- a key change that is your own idea, because it moves every part: "Lift the last chorus up a tone? · Lift it · Keep it". A request for a key change is the go-ahead; then check the range, and when the whole song moves, name the new key in the result line so the musician can set it in Live;
- a muted chord or bass part that the hand edits and version history leave unexplained, when it decides which part states the harmony. Muted long ago and untouched means parked; muted a moment ago while soloing something means it is still in the song.

The mode decides the rest: in Manual, Ode shows each change for Apply or Skip.

## Function: tonic, subdominant, dominant

| Function | Feels | Major (C) | Minor (A) |
|---|---|---|---|
| Tonic | home, stable | I C, vi Am, iii Em | i Am, ♭III C |
| Subdominant (predominant) | moving away | IV F, ii Dm | iv Dm, ♭VI F, ii° Bdim |
| Dominant | tension that wants home | V G, V7 G7, vii° Bdim | V E or E7 (from harmonic minor), v Em, ♭VII G |

- A common functional motion is tonic → subdominant → dominant → tonic.
- Root movement down a fifth (or up a fourth) is the strongest (ii–V–I). Stepwise roots are smooth (IV–V). Roots a third apart share two notes and sound gentle (I–vi).
- In minor keys, V with its raised leading tone (E7 in A minor, with G♯) gives a strong cadence; v or ♭VII gives a softer, modal one.
- Seventh chords, modes and longer tables are in `references/chord-vocabulary.md`.

## Cadences

| Cadence | Chords (C major) | Effect | Typical use |
|---|---|---|---|
| Authentic | V–I, V7–I (G7–C) | complete, final | end of a chorus or the song |
| Plagal | IV–I (F–C); minor plagal iv–I (Fm–C) | gentle, warm; minor plagal is bittersweet | after an authentic cadence, endings |
| Half | ends on V | open, a question | end of a verse or pre-chorus |
| Deceptive | V–vi (G–Am), V–♭VI (G–A♭) | surprise; delays the ending | extend a phrase, hold back closure before the last chorus |
| ♭VII–I | B♭–C | strong, modal | rock and pop endings |

Match cadences to the melody's phrase endings. An open melodic ending over a closed cadence, or the reverse, sounds confused unless that is the point.

## Harmonic rhythm

Harmonic rhythm is how often the chords change. Faster changes bring motion and urgency; slower changes bring space, groove and weight.

- One chord per bar is the common default; two per bar builds energy, often in a pre-chorus; one chord over two bars suits sparse verses and fast tempos.
- Strong-beat changes give a clear harmonic pulse; off-beat or irregular changes are other options. A change pushed early, onto the "and" of 4, is a deliberate anticipation (common in pop, funk and R&B); the bass and drums should push with it.
- Contrast sections: if the verse holds each chord for two bars, the pre-chorus can change every bar or half bar.
- Keep it steady within a phrase, or speed it up into a cadence, which sounds natural.

## Borrowed chords

Borrow chords from the parallel key (modal mixture) to change colour without leaving the key.

- In C major, from C minor: iv Fm, ♭VI A♭, ♭VII B♭, ♭III E♭, iiø7 Dm7♭5, v Gm.
- In A minor, from A major: IV D, and a major I (A) as the final chord.
- The sound of iv in major is its ♭6 falling to 5 (A♭ to G in C): `| C | F | Fm | C |`.
- ♭VI and ♭VII bring lift and breadth before the tonic: `| C | A♭ | B♭ | C |`.
- A borrowed chord changes a scale note (A♭ for A, E♭ for E). If the melody sings the original note at the same moment, they clash: check every melody note under the borrowed chord, weak beats included.

## Secondary dominants

A secondary dominant is the dominant of one of the key's other chords (ii, iii, IV, V or vi in major). It strengthens the arrival on that chord.

| In C major | Chord | Leading tone it adds | Resolves to |
|---|---|---|---|
| V/ii | A7 | C♯ | Dm |
| V/iii | B7 | D♯ | Em |
| V/IV | C7 | B♭ (the 7th) | F |
| V/V | D7 | F♯ | G |
| V/vi | E7 | G♯ | Am |

- The added note pulls by a half step towards the target; that pull is the point. Resolve to the target, or deceptively (E7 to F).
- If the melody uses the note a secondary dominant alters (C natural over A7), inspect that tension in context; it may be an intended colour rather than an error.
- Lighter versions: the triad without the seventh; a fuller one: a secondary ii–V (Em7–A7 into Dm7).

## Modulation

Change key for lift, for a new colour in one section, or for a final-chorus boost.

- **Pivot chord**: a chord that belongs to both keys. C major to G major through Am (vi in C, ii in G): `| C | Am | D7 | G |`.
- **Dominant approach**: the new key's V, or ii–V, just before arriving. C major up a whole step to D major: `| C | Em7 A7 | D |`.
- **Direct**: start the new key at a section boundary, usually up a half or whole step for the last chorus. A beat or a bar of the new key's V makes it smoother.
- **Relative major or minor**: C major and A minor share every note; moving the tonal centre changes the mood without new chords.
- **Chromatic mediant**: to a key a third away (C to E♭ or A♭) for drama; works best at section boundaries, helped by a common tone.
- A key change up a whole step moves the chorus peak up too: the range check decides whether it stays.

More modulation routes are in `references/chord-vocabulary.md`.

## Reharmonization: keep the melody, change the chords

A consonant starting method is to list chords that contain the melody's accented notes as chord or colour tones, then choose by function and bass movement. For a more ambiguous or tense setting, the melody need not belong to each chord.

One melody note, many chords — a melody E4 held for a bar in C major:

| Chord | E is the | Feel |
|---|---|---|
| C | 3rd | plain, home |
| Am | 5th | softer, minor colour |
| Em | root | neutral, a little darker |
| Fmaj7 | major 7th | floating, open |
| Dm9 | 9th | soft, moving |
| A7 | 5th | pushes to Dm (secondary dominant) |
| G6 | 6th | bright dominant colour |
| A♭maj7 | clash with its E♭ | avoid while E is held |

Techniques, from subtle to bold — on Again, move one step further along the list than the last take:

1. Inversions and bass movement: `C – G/B – Am` keeps the chords and adds a line.
2. Diatonic substitutes that share notes: vi or iii for I, ii for IV.
3. Sevenths, ninths, sus chords.
4. Secondary dominants or ii–Vs into important chords.
5. Borrowed chords.
6. Chromatic passing chords (`C – C♯dim7 – Dm7`) and pedal points (chords changing over a held bass note).
7. A different harmonic rhythm.
8. Jazz devices such as tritone substitution (the jazz sub-skill).

## Voicing and voice leading

- Keep common tones in the same voice and move the other voices by the smallest step.
- Prefer contrary motion between the bass and the top voice.
- Register: thirds and seconds below about C3 turn muddy. Keep the bass alone down there, with fifths or octaves at most; put thirds and sevenths in the middle register and colour tones on top.
- The top voice of the chords is a melody too: make it move smoothly, and keep it out of the vocal's way so the two stay clear of each other.
- Avoid a chord tone a half step from the melody note in the melody's octave.
- Parallel fifths and octaves between the outer voices sound hollow in choral and string writing; in rock power chords and some synth textures they are the sound. Know which texture you are writing.

Example, `| C | Am | F | G |` in close position over a root bass:

```
C:  C3 | E4 G4 C5
Am: A2 | E4 A4 C5
F:  F2 | F4 A4 C5
G:  G2 | D4 G4 B4
```

C5 holds through three chords and every other voice moves by a step or a third; in the last change the upper voices move down while the bass moves up. Voicings by instrument (piano, pads, guitar, synth stabs) and more voice-led examples are in `references/voicing.md`.

## Bass movement and inversions

- **Root position** is the strongest and clearest.
- **First inversion** (third in the bass, C/E) is lighter and good for stepwise bass lines.
- **Second inversion** (fifth in the bass, C/G) is unstable: use it as a passing chord, before a cadence (`C/G – G7 – C`), or over a pedal.
- **Stepwise lines**: falling `C – G/B – Am – Am/G – F`; rising `C – Dm7 – C/E – F – F♯dim7 – G`.
- **Pedal point**: one bass note held while the chords change above it (`C – F/C – G/C – C`); builds tension in intros, pre-choruses and endings.
- **Non-inversion slash chords** colour a chord through the bass: F/G is a soft dominant; D/C puts a tense 7th under D.
- The bass skill covers the bass's rhythm and register; the bass note under every chord is agreed here.

## Harmony and meaning

Fit the chords to what the lyric does at that moment. "Sad means minor" is a cliché: plenty of heartbroken songs are in major keys and plenty of hopeful ones in minor, and mood comes from tempo, register, rhythm, voicing and words as much as from chord quality. Match the moment:

- an unresolved question → end the phrase open, on a half cadence, a sus chord, or IV;
- a turn in the story → a deceptive cadence or a borrowed chord on that word;
- something held back → a pedal point under moving chords, or a faster harmonic rhythm;
- an arrival or a decision → an authentic cadence landing on the key word;
- something bittersweet → iv or ♭VI borrowed inside a major key.

## Worked example: "fresher chords" under a held melody

The musician selects the chorus keys (C major) and clicks "Fresher chords". The melody holds E through bar 1, D through bar 2, C through bar 3 and D through bar 4; the keys and the bass play `| C | G | Am | G |` in root position.

Decision: keep the shape of the phrase and colour it — a secondary ii–V into Am, and a softer approach to the dominant at the end. Ode rewrites the keys' notes to `| Cmaj7 | Bm7♭5 E7 | Am7 | F6 G |`, voiced so common tones hold and the top voice stays under the vocal; moves the bass notes on each chord change to C, B, E, A, F and G in the bass's own rhythm; and updates the chorus chord chart in the lead sheet.

Checks: E is the 3rd of Cmaj7; D is the ♭3 of Bm7♭5 and the 7th of E7; C is the 3rd of Am7; D is the 6th of F6 and the 5th of G. E7 changes G to G♯, and the melody avoids G in bar 2. Upper voices move by a step or a third; only the bass below C3.

Result line: "Chorus now Cmaj7 – Bm7♭5 E7 – Am7 – F6 G, bass following · every melody note fits, voices move by step, only the bass below C3."

Other takes for Again: `| C | G/B | Am7 | Gsus4 G |` (subtle: a falling bass line and a suspension), or `| Am7 | Dm9 | A♭maj7 | B♭add9 |` (♭VI and ♭VII borrowed from C minor; E is the 5th of Am7, D the root of Dm9, C the 3rd of A♭maj7, D the 3rd of B♭add9; any E natural in bar 3 would clash with A♭maj7's E♭) — a broader palette than a diatonic take, to describe when useful rather than automatically flag as outside the artist's style.

## Reference files

| File | Read when |
|---|---|
| `references/chord-vocabulary.md` | You need seventh-chord and mode tables, more borrowed chords, secondary dominants in minor keys, common progressions with their feel, passing chords, modulation routes or spelling rules. |
| `references/voicing.md` | You are voicing chords for a specific instrument (piano, pad, strings, guitar, synth stabs) or need more voice-leading examples and register guidance. |

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds only the genre detail beyond this file.

| Path | Read when |
|---|---|
| `pop/SKILL.md` | The song has a pop or pop-leaning direction (dance-pop, synth-pop, pop-rock, pop ballad, indie-pop, pop R&B), or the musician explicitly wants pop chord techniques. Repeating loops, predictability or contrast requests alone do not select pop. |
| `jazz/SKILL.md` | The song is jazz or jazz-influenced (neo-soul, bossa nova, lounge, jazz-pop, R&B with extended chords), or the musician asks for jazzier or richer chords, extensions and alterations, ii–Vs, tritone substitutions, or jazz piano or guitar voicings. |
