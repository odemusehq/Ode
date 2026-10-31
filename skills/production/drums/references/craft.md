# Drums

Drums set the time feel, the energy of each section, and the pocket that bass, chords and vocal sit in. A good part is less about how many hits there are than about where they fall, how loud each one is, and what changes when the section changes. Ode edits the drum part already in the Set, so the musician can play it at once.

## Conventions

- Grids show one bar of sixteenths in 4/4, counted `1 e + a 2 e + a 3 e + a 4 e + a`. `X` = accent, `x` = normal hit, `g` = ghost note, `o` = open hi-hat, `.` = rest.
- Velocities are MIDI values (1–127): accents 105–127, normal hits 80–104, ghost notes 20–50.
- General MIDI suggests kick 36, snare 38, closed hat 42 and crash 49, but Drum Rack chains can receive arbitrary notes. Read the loaded kit's receiving notes and sources before composing. `references/kits.md` gives the convention; the actual rack decides the map.

## Roles

- **Kick** — the pulse and the low-end anchor. Its pattern gives the groove its character (four-on-the-floor, syncopated, sparse). Lock it with the bass.
- **Snare or clap** — the backbeat, usually beats 2 and 4 in 4/4; beat 3 in a half-time feel. Its timing and tone decide whether the groove feels tight or laid back.
- **Hi-hats, shakers, ride** — the subdivision and drive (eighths, sixteenths, triplets). Accents and open hats shape the motion; the ride lifts intensity or marks a new section.
- **Toms** — fills and rolling patterns.
- **Crash** — marks the downbeat of a new section. Save it for arrivals.
- **Percussion** — colour and counter-rhythms: tambourine on 2 and 4 in a chorus, shaker sixteenths, congas.

Keep the roles distinct. If everything plays sixteenths, the drive disappears.

## Time feel and swing

- **Straight**: sixteenths evenly spaced.
- **Swing and shuffle**: the second note of each pair arrives late. As a percentage, 50% is straight and about 66% is a full triplet feel; 54–58% is a subtle push, 58–64% a clear swing. Swing the notes by moving them: the late note of each pair starts at the swing percentage of the pair's length, so in a sixteenth pair (half a beat) 56% moves it from 0.25 to 0.28 beats. Swing hats and ghost notes more than the kick and backbeat for a loose feel.
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

- A drummer hits every note a little differently. Give each pattern an accent shape, then add small variation (±5 to 10) to hats and ghost notes.
- In electronic styles keep the kick and backbeat steady for punch; in acoustic styles let them vary slightly too.
- Timing: small offsets (a few milliseconds) on hats and percussion, plus deliberate ones such as a late snare for a laid-back feel. Leave the kick on the grid when the bass is locked to it.
- For a performed feel, try a small variation every four or eight bars; keep an unchanged loop when its repetition serves the track.

## Fills and transitions

- Put fills at the ends of phrases: small ones (a beat, a few snare or kick notes) every four or eight bars, bigger ones (up to a bar) at section changes.
- A fill often lands on the next downbeat with a crash and kick; delayed, missing or offset landings can also work.
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
| Bridge or breakdown | strip back: the kick dropped, half-time, or percussion only |
| Final chorus | a possible extra element for a final lift, or a reduced/unchanged groove for another ending |
| Outro | thin out, or the chorus groove into a hard stop |

Pattern changes can distinguish sections; the same beat with a new level, texture or lyric may also supply the intended continuity.

## Kits

- Choose sounds that suit the genre and the song. Kick and bass share the low end: a long, boomy kick and a long sub-bass mask each other, so shorten one of them. When the kick has a clear pitch, tune it to the key or to the bass's root.
- Snare and clap tone set the era and mood. Layer a clap with a snare for width, and nudge one by a few milliseconds if they flam.
- For acoustic or rock drums, use suitable licensed sampled kits or recordings when available; synthetic drums are a deliberate sound choice. Inspect actual hat chokes and velocity response, and audition a short groove before developing the arrangement. See the sound-design skill for native capture and listening.
- One kit per song (variations per section are fine), with plainly named pads.
- Velocity has to change the sound or level, so ghost notes are actually soft.
- More on kits, layering and the full note map: `references/kits.md`.

## Worked example: "chorus hits harder"

Pop-rock at 118 BPM. The musician selects the chorus drum clip, which plays the verse groove a little louder, and clicks "Chorus hits harder". The verse (unchanged) plays cross-stick on 2 and 4, closed eighth hats and a kick on 1 and 3; the bass locks to the kick on 1 and 3.

Ode rewrites the chorus clip's notes: full snare where the cross-stick was, sixteenth hats with accents on the beats, an open hat on the last "and" of each bar, an extra kick on the "a" of 1 and the "and" of 3, a crash with the kick on the chorus downbeat, and a small variation in bar 4 of each phrase.

```
        1 e + a 2 e + a 3 e + a 4 e + a
Hat     X x x x X x x x X x x x X x o .
Snare   . . . . X . . . . . . . X . . .
Kick    X . . x . . . . X . x . . . . .
```

Checks: every note on a pad the kit has; backbeat on 2 and 4; the bass's notes on 1 and 3 still start with kicks; hat accents 108–118, in-between hats 70–88; the open hat ends before the next downbeat, so the loop ends clean; the chorus now differs from the verse in snare sound, subdivision, kick pattern and the open hat.

Result line: "Chorus groove opened up: snare replaces cross-stick, accented sixteenth hats, open hat into each bar, two extra kicks · backbeat kept, still locked with the bass on 1 and 3."

## Reference files

| File | Read when |
|---|---|
| `references/patterns.md` | You need grooves for other feels (pop-rock variations, half-time, shuffle, funk, R&B, four-on-the-floor, two-step), more fills, or ways to vary a loop over four or eight bars. |
| `references/kits.md` | You are building or choosing a kit, mapping pads, layering or tuning drums, or need the full General MIDI drum map with Live's note names. |

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds only the genre detail beyond this file.

| Path | Read when |
|---|---|
| `house/SKILL.md` | The track is house or house-adjacent (deep house, tech house, Afro house, disco-influenced or other four-on-the-floor dance music), or the musician wants a club groove, DJ-friendly intros and outros, builds and drops. |
| `hip-hop/SKILL.md` | The track is hip-hop or rap-led (boom bap, trap, drill, lo-fi), uses 808s, or the musician wants a beat for a rapper, hi-hat rolls, a swung, dusty feel, or a beat switch. |
