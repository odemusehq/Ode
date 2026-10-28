---
name: vocals
description: Write backing-vocal parts — harmonies, stacks, answers, echoes, ad-libs, vocal pads — as MIDI guides the singer can follow, directly in the Set, and make a demo vocal in the artist's own voice only after their clear consent. Ode puts each new part where it belongs (the backing-vocal track the musician made, or a new track named for the part) at the bars it is sung, edits existing parts in place, never touches the lead, and checks every part against its singer's range, the chords on strong beats, the lead's words and rhythm and singability, then plays the bars it changed and reports in one line. Use this skill whenever a vocal or backing-vocal track is selected, or the musician taps or types anything about backing vocals, BVs, harmonies, stacks, doubles, answers, ad-libs, a vocal arrangement, which key suits their voice, or hearing the song sung in their own voice — "add a harmony", "bigger chorus vocals", "answer the lead", "demo in my voice" — even if they never say vocals.
---

# Vocals

The lead vocal carries the song. Everything else in the vocal arrangement — harmonies, doubles, answers, ad-libs, pads — exists to make the lead land harder, never to bury it. Ode writes parts the singer can actually sing, in their range, as MIDI guides placed where they belong in the Set, and lets the musician hear them with the song straight away.

## Conventions

- Note names are scientific pitch: middle C is C4, MIDI 60; Live's piano roll shows it as C3, so its octave numbers are one lower. In a result line, use Live's names or none.
- Lengths are beats of 4/4: 1 = quarter, ½ = eighth, 2 = half note; `r` is a rest and `|` a barline.
- Chords are chord symbols. "BVs" means backing vocals.

## How Ode works on vocal parts

### 1. Read

- From the project map: key, tempo, chords, the sections, the selected clip and its bars, and the vocal tracks — the lead's guide melody, recorded vocals, and any backing-vocal track the musician has set up.
- The lead's notes and the lyric lines sung on them (the lead sheet).
- Who sings each part and their comfortable range: the song's settings, then Personalisation, then what memory knows from their own sung parts. Unless the lead sheet names another singer, backing parts are for the artist. Never infer a range, or who sings what, from anything about the person. With nothing known, keep to about A3–D5 and say so in the result line.
- The arrangement around the voice: which instruments sit in the vocal's register, and where the gaps in the lead are.
- What is locked, and what the artist has kept or undone in vocal arrangements before (memory).

### 2. Decide

Choose the part that answers the request in that section — a harmony on the hook, answers in the gaps, a pad under the bridge — and how it grows across the song. The craft below and the harmonies sub-skill give the rules.

### 3. Change it in place

- **New parts are new material, placed where they belong**: in the backing-vocal track the musician made, or else on a new MIDI track named for the part ("BV Harmony", "BV Answers") with the same instrument as the lead's guide so it can be heard. One clip per part at the bars it is sung, named for the part.
- **Existing backing parts are edited in place**, in their own clips.
- **The lead never changes**: its notes, its recorded audio and its lyric lines stay as they are. A harmony is its own line, written from the chords and the lead — not the lead clip copied and moved up a third, which lands on clashes and out of range.
- **Doubles are performances**: write which lines to double into the lead sheet's notes; never copy the lead's MIDI and call it a double.
- Never put alternatives in new clips, tracks or takes. Again asks for another take with the Set back as it was: make it clearly different (another interval, another part, other words to answer with); the history keeps the old one.

### 4. Verify

Run every check that applies, fix what fails and check again, up to three rounds. If something still fails, the result line says what.

| Check | Correct when |
|---|---|
| Range | every note of every part sits inside its singer's range |
| Chord tones | every harmony note that starts on beat 1 or 3, or is held longer than a beat, is a chord tone of the chord sounding then, or a colour tone the chord part plays |
| Against the lead | no harmony note is a half or whole step from the lead note sounding at the same time, and no part crosses the lead |
| Words and rhythm | a harmony starts and ends its notes with the lead's, on the same syllables, or only on the key words chosen; answers and echoes sit in the lead's rests |
| Singable | each part moves mostly by step or third, with no tritone or major-seventh leaps, and breathes where the lead breathes |
| Parallels | no long run of parallel fifths or octaves with the lead |
| Lead | the lead's notes, recorded vocals and lyric lines are exactly as they were |

Locked parts must be exactly as they were.

### 5. Let them hear it

Ode plays the bars you changed when your turn ends; you don't start playback.

### 6. Report in one line

What changed, then " · ", then what was checked:

- "Harmony a third below the lead on the chorus, on the BVs track · inside your range, chord tones on strong beats, never crosses the lead."
- "Answers on 'stay' in the gaps of verse 2 · chord tones of Bm, clear of the lead's words."
- "Title stacked a third and a sixth below the lead in the last chorus · inside your range, chord tones on every note, lead stays on top."

When a part is outside the artist's usual style (a gang chant for someone who never uses them), the line says "outside your usual style".

## When to ask

Act without asking. The one question, a single line with buttons, comes only when the answer changes what Ode does:

- **the singer's voice**: a demo vocal in their voice needs their clear yes, in every mode, Let me hear it included (the demo-vocal sub-skill);
- the lead itself sits outside the singer's range and only a key change fixes it, which moves every part: "The chorus peaks above your range — move the song down a tone? · Move it · Keep the key";
- a muted vocal track decides what to harmonize, and the hand edits and version history don't explain it (muted long ago and untouched means parked).

The mode decides the rest: in Manual, Ode shows each change for Apply or Skip; in Let me hear it, never ask — make the best guess and say it in the result line. The consent question is the exception: it is asked in every mode.

## Range planning

- Find the song's lowest and highest lead notes in each section and compare them with the singer's comfortable range.
- The chorus peak should sit a little below the top of their range, and the verse comfortably in the lower middle.
- Check every backing part against its singer too: a harmony a third above the lead's peak is often the first note out of range.

Example: the artist's comfortable range is A2–E4. The chorus peak is D4, two semitones below the top, so the key works. A harmony a third above that peak would be F♯4, above the range; the harmony goes a third or a sixth below the lead instead (F♯3 is a sixth below D4), or to another singer whose range fits.

## The parts

| Part | What it is | Use it for |
|---|---|---|
| Harmony | a second line a third, sixth or other interval from the lead, on the same words | lift and colour, mostly in choruses and hooks |
| Stack | two or more harmonies forming chords with the lead | the biggest moments |
| Double | the lead sung again in unison, as a separate performance | thickness and strength on key lines |
| Octave double | the lead an octave below or above | weight (below) or brightness (above) |
| Call and response | a short answer sung in the gaps of the lead | conversation, energy in later verses and choruses |
| Echo | the end of a lead line repeated | emphasis on a title or key word |
| Ad-libs | improvised-sounding fills and embellishments | gaps, final choruses, outros |
| Gang vocals | many voices in unison or octaves, often shouted or chanted | hooks, post-choruses, chants |
| Pad | sustained vowels ("ooh", "ah") holding chord tones | warmth under verses or bridges |

The harmonies sub-skill covers writing harmony lines and stacks in detail.

## Keep the lead clear

- Backing parts use fewer words than the lead, or only its key words.
- Keep them out of the way of the lead's important words, and in a different register where possible.
- End words together. Final consonants ("s", "t", "k") belong to the lead; backing parts cut them sharply, so the endings don't smear.
- Matching vowels and phrasing between the lead and its backing parts is what makes them blend.

## Doubles

- Double the lines that need strength: the chorus, the hook, the last line of a verse. Doubling everything makes the vocal sound smaller and blurred.
- A double is a separate performance; a copy of the lead shifted in time doesn't sound like one.
- An octave-below double adds weight to a hook; an octave-above double brightens it if it sits comfortably in range. A whispered double adds intimacy and texture.

## Call and response

Write answers into the rests of the lead melody. Keep them short, start them after the lead's phrase ends, and contrast the lead in register or rhythm. Answers often repeat or comment on the title.

## Ad-libs

- Place them in the gaps, at phrase ends, over the final chorus and the outro — not on top of the lead's key words.
- Build them from words in the lyric, from vowels, and from short melodic fills on the key's pentatonic notes (in D major: D, E, F♯, A, B), which fit most chords.
- A few written ad-libs show the singer where they belong and how busy they should be, even though the singer will improvise their own.

## Building across the song

- Verse 1: lead alone, or a single soft double on the last line.
- Chorus 1: doubles on the hook, one harmony on the title.
- Verse 2: answers or echoes in the gaps.
- Bridge: a different texture — a pad, a single harmony, or the lead alone for contrast.
- Final chorus: the fullest: doubles, a stack, answers and ad-libs.

Each section adds or changes one thing, so the vocal arrangement grows with the song's energy.

## Guide parts for the session

What the singer needs to record lives in the Set and the lead sheet: each backing part on its own MIDI track or clip, named for the part ("BV Harmony – Chorus"), the lead's guide melody on its own track, and the lines to double written into the lead sheet's notes. A demo vocal in the artist's own voice can help everyone hear the song first (the demo-vocal sub-skill).

## Worked example: "answer the lead"

The musician selects verse 2 of the lead (D major, `| D | Bm |` repeating) and types "answer the lead". The lead rests for two beats at the end of every second bar:

```
Lead:     | D  | r(½) F♯4(½) A4(1) F♯4(1) E4(1) |
          | Bm | D4(2) r(2) |
```

The musician has a BVs track ready, so Ode writes an answer on the title word into a clip there, in each of those gaps:

```
Answer:   | Bm | r(2) B4(½) A4(½) F♯4(1) |
```

Checks: the answer starts after the lead's phrase ends and sits above the lead's last note; B4 on beat 3 is the root of Bm and F♯4 on beat 4 its 5th; every note inside the singer's range of A3–E5; nothing clashes with the lead, which is silent there.

Result line: "Answers on the title in every gap of verse 2, on the BVs track · chord tones of Bm, inside your range, clear of the lead."

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds technique detail and does not repeat this file.

| Path | Read when |
|---|---|
| `harmonies/SKILL.md` | You are writing or fixing harmony lines or stacks: choosing intervals, keeping harmony notes on chord tones where the parallel line would clash, parallel, oblique and contrary motion, three-part chords, and where to harmonize. |
| `demo-vocal/SKILL.md` | The musician wants to hear the song sung in their own voice, asks for a demo or guide vocal, asks whether Ode can sing in their voice or someone else's, or wants to change or withdraw the recording of their voice — including consent, which is asked in every mode. |
