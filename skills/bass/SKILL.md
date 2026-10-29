---
name: bass
description: Write and fix basslines directly in the Set. Ode edits the notes of the bass clip the musician points at so the line follows the chords and locks with the kick, checks roots on chord changes, key, starts against the real kick notes, space around the snare, register and clashes with other low parts, then reports in one line which bars changed, so the musician can play them. Use this skill whenever a bass, sub or 808 clip is selected, or the musician clicks a suggestion or types anything about the bassline, an 808, sub-bass, walking bass, or low end that sounds muddy, empty or clashing — "lock to the kick", "follow the chords", "more movement", "simpler", "add a bass" — even if they never say bass.
---

# Bass

The bass does three jobs at once: it defines the harmony (the bass note decides how a chord is heard), it ties the harmony to the drums (it locks with the kick), and it can carry a counter-melody of its own. A good bassline does the first two without fuss and adds the third only where there is room. Ode edits the bassline already in the Set, so the musician can play it against the drums straight away.

## Conventions

- Note names are scientific pitch: middle C is C4, MIDI 60; Live's piano roll shows it as C3, so its octave numbers are one lower. In a result line, use Live's names or none. Low notes for reference: E1 (MIDI 28) ≈ 41 Hz, A1 = 55 Hz, E2 ≈ 82 Hz, A2 = 110 Hz, C3 = MIDI 48.
- Lengths are beats of 4/4: 1 = quarter, ½ = eighth, ¼ = sixteenth, 1½ = dotted quarter, 2 = half; `r` is a rest and `|` a barline.
- In 808 lines, `~` joins two overlapping notes so the sound glides from the first to the second.
- Chords are chord symbols.

## How Ode works on a bassline

### 1. Read

- From the project map: key, tempo, meter, genre, the selected clip and its bars, the section and its energy.
- The chords and how long each lasts: the chord part's notes or the lead sheet's chord chart.
- The kick — the actual notes in the drum clip at these bars, on the Drum Rack's kick pad (usually 36; read the pads) — and the snare. Never assume a kick pattern.
- The bass clip's notes, and the bass instrument: whether it glides (mono, glide or portamento on) and how long its notes ring.
- What else sounds in the low and low-mid register at the same time: the keys' left hand, guitar, pads; and the vocal's rhythm.
- What is locked, and the artist's habits from memory: bass sounds and styles they have kept or undone.

### 2. Decide

Choose the approach the request asks for — roots locked to the kick for weight, notes between the kicks for bounce, a melodic line with passing tones, octaves, an 808 with slides — and keep what already works (usually the root on beat 1 and the figure's rhythm) unless asked for something new. The craft below gives the rules.

### 3. Change it in place

- Edit the notes of the clip the musician pointed at; keep its position, length and loop.
- If the line needs glide (808 slides), turn the instrument's glide on in place; if a separate kick plays, set note lengths so the tails end before the next kick.
- A bassline for a section that has none is new material: a clip on the bass track at that section's bars.
- Never put alternatives in new clips, tracks or takes. Again asks for another take with the Set back as it was: make it clearly different (another rhythm, register or approach); the history keeps the old one.
- Change only the bars that need it. Drums and chords stay as they are; if the kick itself is the problem, say so in the result line.

### 4. Verify

Run every check that applies, fix what fails and check again, up to three rounds. If something still fails, the result line says what.

| Check | Correct when |
|---|---|
| Roots | the note at each chord change is the chord's root, or a deliberate inversion or slash bass you can name |
| Key | every note is in the song's scale, or is a chromatic approach note on a weak position that resolves by a half step into the next note |
| Kick | when the line locks to the kick: every bar's first note starts with the kick on beat 1 (within a 32nd note), and its other notes start with kick hits too, except passing or approach notes in the last beat before a chord change; when it plays between the kicks (house off-beats): no note starts on a kick |
| Smear | no long bass note runs across a kick it would mask, unless that is the style (a held sub under a sparse kick) |
| Snare | the snare beats carry fewer bass notes than the kick beats, and those that fall there are passing or approach notes |
| Register | notes between about E1 and C3 (MIDI 28–48); main 808 notes about E1–E2; nothing important below E1 without harmonics above it |
| Low clashes | no other part plays in the bass's octave at the same time (the keys' left hand around C2–C3), and no chord intervals smaller than a fifth below C3 |
| 808 | tuned to the key, tails ending before the next hit when a separate kick plays, slides a few per phrase, glide on |
| Loop | no note runs past the clip's end |

Locked parts must be exactly as they were.

### 5. Let them hear it

When your turn ends, the musician presses play in Live: say in the result line which bars changed, so they know where to listen.

### 6. Report in one line

What changed, then " · ", then what was checked:

- "Bass now hits with the kick on 1, the 'and' of 2 and 3 · roots on every chord, in key, clear of the keys' left hand."
- "808 follows the roots with two slides every four bars, glide on · in key, tails end before each kick, lowest note E1."
- "Approach notes into each chord on beat 4 · on weak beats, each resolves by a half step, roots still with the kick."

When a line is outside the artist's usual style (octaves for someone who always plays roots), the line says "outside your usual style".

## When to ask

Act without asking. The one question, a single line with buttons, comes only when the answer changes what Ode does:

- the kick that decides the bass rhythm is on a muted track, or there are two kick parts and one is muted, and the hand edits and version history don't explain it. Muted long ago and untouched means parked; muted a moment ago while soloing something else means it is still in the song;
- deleting a bass part, or replacing a line the musician played in by hand with a different one when they asked for something smaller.

The mode decides the rest: in Manual, Ode shows each change for Apply or Skip.

## Following the chords

- Play the root on each chord change, usually on the downbeat. That states the harmony clearly.
- Use chord tones (3rd, 5th, 7th) for movement within a chord, and octaves and fifths for energy without new pitches.
- Connect chords with passing tones (scale steps between chord tones) and approach notes (a half step below or above the next root, just before it arrives) on weak beats.
- A pedal point — one bass note held under changing chords — builds tension in intros, pre-choruses and builds.

## Colouring the chords

The bass note can change what a chord is:

- the 3rd in the bass (C/E) softens a chord and makes stepwise lines possible;
- the 5th in the bass (C/G) is unstable; use it in passing or before a cadence;
- a note outside the triad changes the harmony: A under C makes Am7, F under G makes G7 with its 7th in the bass, G under F makes a suspended F/G.

Do this deliberately, keep the lead sheet's chord chart in agreement (the harmony skill), and name the slash chord in the result line.

## Locking with the kick

- Start bass notes with the kick on the strong hits, especially beat 1. When they hit together, they sound like one powerful instrument.
- Then choose: stay with the kick for weight, or play in the gaps between kicks for bounce (house off-beat bass is the clearest case).
- Avoid long bass notes that smear across every kick: end notes before the next kick when the two would mask each other. Ducking the bass with the kick (sidechain compression) is a mixing choice, covered by the mixing skill.
- Design the bass and the kick together, and check the bassline against the real kick notes.

## Rhythm and space

- Rests are part of the groove. A bassline with no space has no bounce.
- Short notes punch and leave room; long notes give weight and warmth. Note length shapes the groove as much as note choice.
- Syncopation — anticipating a chord change on the "and" of 4, or accenting off-beats — adds drive. Keep beat 1 strong so the listener keeps the downbeat.
- A repeated one- or two-bar figure (an ostinato or riff) is often stronger than a line that changes every bar.
- Leave the snare beats lighter than the kick beats; the bass and snare rarely need to hit together.

## Register

- Most basslines live between about E1 and C3. Electric bass spans roughly E1 to G3; synth bass and 808s go lower.
- Sub-bass fundamentals sit roughly between 30 and 60 Hz (about B0 to B1). Below about E1 many speakers lose the fundamental, so the sound needs harmonics above it, or the line moves up.
- Keep chords out of the low register: intervals smaller than a fifth turn to mud below about C3. Play single notes, octaves or fifths down there.
- Octave jumps up are an energy tool; dropping an octave for a chorus adds weight.
- Keep out of the keys' left hand: if the piano plays roots around C2–C3 too, one of them moves or stops.

## Passing tones and approach notes

- Diatonic passing tones fill a third between chord roots by step: under `| C | Am |`, C–B–A.
- Chromatic approach notes lead into the next root from a half step away on the last eighth or quarter of the bar: G♯ into A, D♭ into C.
- Walking bass (jazz, swing, some blues) plays four quarter notes per bar: chord tones on beats 1 and 3, passing or approach notes on 2 and 4, with an approach note on beat 4 into the next chord.
- Keep passing notes on weak beats so the strong beats still state the harmony.

## Octaves and fifths

- Root–octave patterns in eighths drive disco, funk and dance music.
- Root–fifth patterns (the fifth below or above) give the two-feel of country, rock and folk, and steady movement in pop.
- Skip the fifth on chords whose fifth is altered (diminished, half-diminished, augmented, ♭5); use the root, octave or the chord's own fifth.

## 808 basslines and slides

- An 808 is a long, sine-like bass drum that works as both kick and bass in trap, drill and much modern hip-hop and pop. Its notes must match the key: the long tail is a pitch, and a wrong one clashes with every chord.
- **Note length is the tail**: the length of each MIDI note sets how long the 808 rings. Shorten notes in busy passages, end them before the next hit if a separate kick plays, and let the note before a rest ring out.
- **Slides (glide)**: with the 808 in mono and glide (portamento) on, overlapping two notes makes the pitch slide from the first to the second. Slide up an octave, or to the fifth, for movement; slide back down to land on the root. Slides are accents, a few per phrase, not on every note.
- **Simple lines win**: 808s often follow only the strongest chord roots, or stay on the key's root while the chords move. If the 808 stays on E under a D chord, it makes D/E, a tense, suspended sound; choose that deliberately.
- **Range**: the most useful 808 notes sit roughly between E1 and E2 (41–82 Hz). Much lower and small speakers lose them; much higher and they stop sounding like low end.
- **Small speakers**: saturation adds harmonics so the 808 is heard on phones and laptops; that is a sound-design and mixing choice.

Example, E minor, 140 BPM, half-time feel with the clap on beat 3, chords `| Em | C |`:

```
| Em | E1(2) r(½) E1(½)~E2(1) |
| C  | C2(1½) r(1) C2(½)~G1(1) |
```

The long first note rings through beats 1 and 2, the rest leaves the clap on beat 3 alone, and each bar ends with one slide: up an octave in bar 1, down a fourth in bar 2, which leads back to E1.

## Sub-bass and mid-bass roles

- **Sub-bass** (below about 80 Hz) is felt more than heard: a sine-like tone, mono, simple lines with few fast notes.
- **Mid-bass** (roughly 80–300 Hz plus harmonics) is what you hear on small speakers: character, attack and the notes' identity.
- When layering, give each layer a role: the sub carries the fundamental, the mid layer carries the tone and articulation. Two layers fighting in the same octave turn to mud.
- With a bass guitar and a synth bass together, decide which one owns the sub and keep the other above it.

## Worked example: "more movement"

Chorus in A minor, 100 BPM, chords `| Am7 | Fmaj7 | C | G |`, kick on beat 1, the "and" of 2 and beat 3, snare on 2 and 4. The bass clip plays roots locked to the kick:

```
| Am7   | A1(1) r(½) A1(½) A1(1) r(1) |
| Fmaj7 | F1(1) r(½) F1(½) F1(1) r(1) |
| C     | C2(1) r(½) C2(½) C2(1) r(1) |
| G     | G1(1) r(½) G1(½) G1(1) r(½) G♯1(½) |
```

The musician clicks "More movement". Ode keeps the roots on the first two kicks of each bar and rewrites beats 3 and 4 with chord tones and steps into the next chord:

```
| Am7   | A1(1) r(½) A1(½) E1(1) G1(1) |
| Fmaj7 | F1(1) r(½) F1(½) A1(1) B1(1) |
| C     | C2(1) r(½) C2(½) G1(1) A1(1) |
| G     | G1(1) r(½) G1(½) B1(1) G♯1(1) |
```

Checks: roots on every chord change; every note in A minor except G♯1, which leads by a half step back to A1; each beat-3 note starts with the kick and is a chord tone (E of Am7, A of Fmaj7, G of C, B of G); the beat-4 notes step into the next root (G1 down to F1, B1 up to C2, A1 down to G1, G♯1 up to A1); everything between E1 and C2, below the keys' left hand.

Result line: "More movement: chord tones on beat 3 and a step into each new chord on beat 4 · roots still with the kick, in key, lowest note E1."

On Again, try octaves in eighths with the low notes on the kicks and the snare beats left empty — outside the usual style for an artist who plays roots, so the result line says so.

## Reference files

| File | Read when |
|---|---|
| `references/examples.md` | You want worked basslines in other styles: pop-rock eighths, a ballad with inversions, funk with octaves and the blues third, house off-beat bass, a walking bass, and a longer 808 line. |

## Sub-skills

None yet. For the kick patterns a bassline locks to in specific genres, read the drums skill's sub-skills (`house/SKILL.md` and `hip-hop/SKILL.md` in the drums skill's folder).
