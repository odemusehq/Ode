---
name: drums
description: Program and fix drum parts directly in the Set. Ode edits the notes of the drum clip the musician points at — grooves, fills, swing, ghost notes, velocity and timing, section energy — writes only to pads the kit actually has, and checks the backbeat, the kick against the bass, the velocity shape, fills that land on the downbeat clear of the vocal, and a loop that ends cleanly, then reports in one line which bars changed, so the musician can play them. Use this skill whenever a drum clip or Drum Rack is selected, or the musician clicks a suggestion or types anything about a beat, groove, fill, swing, feel, hats, kick, snare or kit — "fill into the chorus", "more human", "chorus hits harder", "half-time bridge", "give me a beat at 90" — even if they never say drums.
---

# Drums

Drums set the time feel, the energy of each section, and the pocket that bass, chords and vocal sit in. A good part is less about how many hits there are than about where they fall, how loud each one is, and what changes when the section changes. Ode edits the drum part already in the Set, so the musician can play it at once.

## Conventions

- Grids show one bar of sixteenths in 4/4, counted `1 e + a 2 e + a 3 e + a 4 e + a`. `X` = accent, `x` = normal hit, `g` = ghost note, `o` = open hi-hat, `.` = rest.
- Velocities are MIDI values (1–127): accents 105–127, normal hits 80–104, ghost notes 20–50.
- Drum Racks follow the General MIDI drum map: kick 36, snare 38, clap 39, closed hi-hat 42, open hi-hat 46, crash 49, ride 51 (Live labels note 36 as C1). The full map is in `references/kits.md`, but the kit in the Set decides which pads exist.

## How Ode works on drums

### 1. Read

- From the project map: tempo, meter, genre, the selected clip and its bars, the section it belongs to (locators, lead sheet) and the sections either side.
- The clip's notes, and the Drum Rack's pads: which notes have a sound (each pad's receiving note and the sample on it). A note on an empty pad is silent.
- The bassline's notes, where the bass should lock with the kick; the vocal's notes, where lines start and end, so fills fall in the gaps; the harmonic rhythm.
- The neighbouring drum clips: what the verse does decides what makes the chorus bigger.
- What is locked, and the artist's habits from memory (swing amount, favourite sounds, how busy they like hats).

### 2. Decide

Choose the feel, the pattern and what varies, using the craft below: roles kept distinct, the backbeat where the style expects it, fills only at phrase ends, and a section's energy shown by pattern changes, not only by level.

### 3. Change it in place

- Edit the notes of the clip the musician pointed at; keep its position, length and loop.
- A fill goes into the last beats of the clip it leads out of. Its landing — the kick and, at a section change, a crash on the next downbeat — goes into the first beat of the next clip, edited there.
- Write only to pads the kit has. If the fill you had in mind needs a sound the kit lacks (toms in a kit without toms), use the pads that exist.
- A beat for an empty section is new material: a clip on the drum track at that section's bars, with the same kit.
- Never put alternatives in new clips, tracks or takes. Again asks for another take with the Set back as it was: make it clearly different (another feel, fill type or kick pattern); the history keeps the old one.
- Change only the bars that need it: a fill touches the end of one phrase and the next downbeat, not the whole song.

### 4. Verify

Run every check that applies, fix what fails and check again, up to three rounds. If something still fails, the result line says what.

| Check | Correct when |
|---|---|
| Pads | every note is on a pad the Drum Rack has |
| Backbeat | snare or clap on 2 and 4 (beat 3 in half-time), unless moved on purpose |
| Kick and bass | where the bass locks to the kick, each of those bass notes starts with a kick hit, within a 32nd note |
| Velocity | accents, normal hits and ghost notes are clearly different, and no part sits at one flat value |
| Density | the hat subdivision suits the tempo (straight sixteenths blur above about 150 BPM unless the style wants them) |
| Fill | it sits at the end of a phrase, starts after the vocal line ends, and lands on the next downbeat with a kick (and a crash at a section change); a build's velocities rise |
| Sections | a chorus differs from its verse in more than velocity: subdivision, kick pattern, open hats, a layered snare |
| Loop | no note runs past the clip's end, and the last bar leads cleanly back into the first |

Bars outside the change, and locked parts, must be exactly as they were.

### 5. Let them hear it

When your turn ends, the musician presses play in Live: say in the result line which bars changed, from a bar or two earlier for a fill or a transition, so they hear the change in context.

### 6. Report in one line

What changed, then " · ", then what was checked:

- "Fill into the chorus: snare run on beats 3–4 of bar 8, crash with the kick on the downbeat · lands on 1, after the vocal's last word, only pads the kit has."
- "Hats now accented, ghost snares around 2 and 4, kick left on the grid · velocities 24–118, loop ends clean."
- "Chorus groove opened up: sixteenth hats, open hat into each bar, extra kick on the 'and' of 3 · backbeat kept, kick still with the bass on 1 and 3."

When a groove is outside the artist's usual style (half-time for someone who always plays straight), the line says "outside your usual style".

## When to ask

Act without asking. The one question, a single line with buttons, comes only when the answer changes what Ode does:

- deleting a drum part, or replacing a performance the musician played in by hand with a programmed pattern they didn't ask for;
- a muted drum track or a muted second kick that the hand edits and version history don't explain, when the groove or the bass depends on it. Muted long ago and untouched means parked; muted a moment ago while soloing something else means it is still in the song.

The mode decides the rest: in Manual, Ode shows each change for Apply or Skip.

## Roles

- **Kick** — the pulse and the low-end anchor. Its pattern gives the groove its character (four-on-the-floor, syncopated, sparse). Lock it with the bass.
- **Snare or clap** — the backbeat, usually beats 2 and 4 in 4/4; beat 3 in a half-time feel. Its timing and tone decide whether the groove feels tight or laid back.
- **Hi-hats, shakers, ride** — the subdivision and drive (eighths, sixteenths, triplets). Accents and open hats shape the motion; the ride lifts intensity or marks a new section.
- **Toms** — fills and rolling patterns.
- **Crash** — marks the downbeat of a new section. Use it for arrivals, not every four bars.
- **Percussion** — colour and counter-rhythms: tambourine on 2 and 4 in a chorus, shaker sixteenths, congas.

Keep the roles distinct. If everything plays sixteenths, nothing drives.

## Time feel and swing

- **Straight**: sixteenths evenly spaced.
- **Swing and shuffle**: the second note of each pair arrives late. As a percentage, 50% is straight and about 66% is a full triplet feel; 54–58% is a subtle push, 58–64% a clear swing. Swing the notes by moving them: the late note of each pair starts at the swing percentage of the pair's length, so in a sixteenth pair (half a beat) 56% puts it at 0.28 beats instead of 0.25. Swing hats and ghost notes more than the kick and backbeat for a loose feel.
- **Half-time**: snare on beat 3; the song feels half as fast at the same tempo. **Double-time**: snare on every beat, or hats at twice the density.
- **Triplet feels**: 12/8, or triplet hats over a straight kick.
- **Pocket**: a consistent timing relationship between the parts. Laid back means the snare slightly late (around 5–20 ms); pushed means hats slightly early. In electronic styles keep the kick on the grid as the anchor.

## A basic backbeat

```
        1 e + a 2 e + a 3 e + a 4 e + a
Hat     x . x . x . x . x . x . x . x .
Snare   . . . . X . . . . . . . X . . .
Kick    X . . . . . . . X . x . . . . .
```

To make it groove: accent the hats (downbeats louder than off-beats, or the reverse for push), add ghost notes around the backbeat, and vary the kick in the last bar of each four-bar phrase.

## Ghost notes

Ghost notes are soft snare hits (velocity 20–50) between the backbeats. They add motion without adding weight. Common places are the "a" just before a backbeat and the "e" just after one.

```
        1 e + a 2 e + a 3 e + a 4 e + a
Hat     x . x . x . x . x . x . x . x .
Snare   . . . g X . . g . g . . X . . g
Kick    X . . . . . . . X . x . . . . .
```

Too many ghost notes make the groove busy and muddy; leave space around each backbeat. Ghost kicks (soft extra kicks) fill out sparse hip-hop and funk grooves.

## Velocity and timing variation

- No drummer hits two notes the same. Give each pattern an accent shape, then add small variation (±5 to 10) to hats and ghost notes.
- In electronic styles keep the kick and backbeat steady for punch; in acoustic styles let them vary slightly too.
- Timing: small offsets (a few milliseconds) on hats and percussion, plus deliberate ones such as a late snare for a laid-back feel. Leave the kick on the grid when the bass is locked to it.
- Change the pattern a little every four or eight bars — an extra kick, an open hat, a dropped hat — so the loop doesn't sound copied and pasted.

## Fills and transitions

- Put fills at the ends of phrases: small ones (a beat, a few snare or kick notes) every four or eight bars, bigger ones (up to a bar) at section changes.
- A fill lands on the next downbeat, usually with a crash and a kick on beat 1.
- Types: a snare build (eighths → sixteenths → thirty-seconds with rising velocity), a tom fill moving high to low, kick and snare in unison, a drop-out (the drums stop for a beat or a bar before the chorus), a reverse cymbal or riser (the sound-design skill).
- Leave room for the vocal: a fill under the last word of a line fights it, so the fill starts after the line ends.
- Minimal styles (house, trap) use fewer fills; their transitions come from adding or removing elements, rolls and risers.

A two-beat fill into a chorus, snare velocities rising from about 70 to 120 across beats 3 and 4:

```
        1 e + a 2 e + a 3 e + a 4 e + a
Hat     x . x . x . x . . . . . . . . .
Snare   . . . . X . . . x x x x x x x X
Kick    X . . . . . . . X . . . . . . .
```

Next bar: crash and kick together on beat 1.

## Section by section

| Section | Typical drum approach |
|---|---|
| Intro | sparse: hats or percussion only, or the full groove filtered |
| Verse | the groove at moderate density, closed hats, a simpler kick; room for the lyric |
| Pre-chorus | a build: denser hats, more kick, a snare or tom build, or the kick dropped out for tension |
| Chorus | fullest: open hats or ride, extra kicks, a layered snare and clap, a crash on the downbeat |
| Bridge or breakdown | strip back: no kick, half-time, or percussion only |
| Final chorus | the chorus plus one more element (tambourine, extra percussion, bigger fills) |
| Outro | thin out, or the chorus groove into a hard stop |

Change the pattern between sections, not just the level. The same beat played louder does not make a chorus.

## Kits

- Choose sounds that suit the genre and the song. Kick and bass share the low end: a long, boomy kick and a long sub-bass mask each other, so shorten one of them. When the kick has a clear pitch, tune it to the key or to the bass's root.
- Snare and clap tone set the era and mood. Layer a clap with a snare for width, and nudge one by a few milliseconds if they flam.
- Closed and open hats come from the same family, in one choke group so a closed hat cuts the open one, like a real hi-hat.
- One kit per song (variations per section are fine), with plainly named pads.
- Velocity has to change the sound or level, so ghost notes are actually soft.
- More on kits, layering and the full note map: `references/kits.md`.

## Worked example: "chorus hits harder"

Pop-rock at 118 BPM. The musician selects the chorus drum clip, which plays the verse groove a little louder, and clicks "Chorus hits harder". The verse (unchanged) plays cross-stick on 2 and 4, closed eighth hats and a kick on 1 and 3; the bass locks to the kick on 1 and 3.

Ode rewrites the chorus clip's notes: full snare instead of cross-stick, sixteenth hats with accents on the beats, an open hat on the last "and" of each bar, an extra kick on the "a" of 1 and the "and" of 3, a crash with the kick on the chorus downbeat, and a small variation in bar 4 of each phrase.

```
        1 e + a 2 e + a 3 e + a 4 e + a
Hat     X x x x X x x x X x x x X x o .
Snare   . . . . X . . . . . . . X . . .
Kick    X . . x . . . . X . x . . . . .
```

Checks: every note on a pad the kit has; backbeat on 2 and 4; the bass's notes on 1 and 3 still start with kicks; hat accents 108–118, in-between hats 70–88; the open hat ends before the next downbeat, so the loop ends clean; the chorus now differs from the verse in snare sound, subdivision, kick pattern and the open hat.

Result line: "Chorus groove opened up: snare instead of cross-stick, accented sixteenth hats, open hat into each bar, two extra kicks · backbeat kept, still locked with the bass on 1 and 3."

## Reference files

| File | Read when |
|---|---|
| `references/patterns.md` | You need grooves for other feels (pop-rock variations, half-time, shuffle, funk, R&B, four-on-the-floor, two-step), more fills, or ways to vary a loop over four or eight bars. |
| `references/kits.md` | You are building or choosing a kit, mapping pads, layering or tuning drums, or need the full General MIDI drum map with Live's note names. |

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds genre detail and does not repeat this file.

| Path | Read when |
|---|---|
| `house/SKILL.md` | The track is house or house-adjacent (deep house, tech house, Afro house, disco-influenced or other four-on-the-floor dance music), or the musician wants a club groove, DJ-friendly intros and outros, builds and drops. |
| `hip-hop/SKILL.md` | The track is hip-hop or rap-led (boom bap, trap, drill, lo-fi), uses 808s, or the musician wants a beat for a rapper, hi-hat rolls, a swung, dusty feel, or a beat switch. |
