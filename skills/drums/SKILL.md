---
name: drums
description: Program drum parts that groove and serve the song — kick, snare and hi-hat roles, time feel and swing, ghost notes, velocity and timing variation, fills and transitions, section-by-section energy, and building drum kits from samples. Use this skill whenever the musician asks for a beat, groove, drum pattern, fill, drum programming or a Drum Rack kit, wants more swing or a more human feel, wants drums for a section or a whole song, says the drums feel stiff, busy, flat or that the chorus doesn't hit, or asks how drums should change between verse and chorus, even if they only say "give me a beat at 90".
---

# Drums

Drums set the time feel, the energy of each section, and the pocket that bass, chords and vocal sit in. A good part is less about how many hits there are than about where they fall, how loud each one is, and what changes when the section changes. Write parts the musician can hear, judge and edit; never overwrite a drum clip they made.

## Conventions

- Grids show one bar of sixteenth notes in 4/4, counted `1 e + a 2 e + a 3 e + a 4 e + a`. `X` = accent, `x` = normal hit, `g` = ghost note, `o` = open hi-hat, `.` = rest.
- Velocities are MIDI values (1–127). As a guide: accents 105–127, normal hits 80–104, ghost notes 20–50.
- Drum sounds follow the General MIDI drum map that Drum Racks use: kick 36, snare 38, clap 39, closed hi-hat 42, open hi-hat 46, crash 49, ride 51. Live labels note 36 as C1. The full map is in `references/kits.md`.

## Gather first

- Tempo, meter, genre (from the song's settings), the section, and how much energy it should have.
- The bassline and anything kick-like, the vocal's rhythm (a dense rap or a sparse ballad), and the harmonic rhythm.
- Existing drum clips, the kit in use, and anything locked.
- The artist's habits — swing amount, favourite kit sounds — from earlier songs.

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
- **Swing and shuffle**: the second note of each pair arrives late. As a percentage, 50% is straight and about 66% is a full triplet feel; 54–58% is a subtle push, 58–64% a clear swing. Swing hats and ghost notes more than the kick and backbeat for a loose feel. Apply swing as a groove on the clip rather than moving notes by hand, so it stays adjustable.
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

- No drummer hits two notes the same. Give each pattern an accent shape, then add small random variation (±5 to 10) to hats and ghost notes.
- In electronic styles keep the kick and backbeat steady for punch; in acoustic styles let them vary slightly too.
- Timing: small random offsets (a few milliseconds) on hats and percussion, plus deliberate ones such as a late snare for a laid-back feel. Leave the kick on the grid when the bass is locked to it.
- Change the pattern a little every four or eight bars — an extra kick, an open hat, a dropped hat — so the loop doesn't sound copied and pasted.

## Fills and transitions

- Put fills at the ends of phrases: small ones (a beat, a few snare or kick notes) every four or eight bars, bigger ones (a bar) at section changes.
- A fill lands on the next downbeat, usually with a crash and a kick on beat 1.
- Types: a snare build (eighths → sixteenths → thirty-seconds with rising velocity), a tom fill moving high to low, kick and snare in unison, a drop-out (the drums stop for a beat or a bar before the chorus), a reverse cymbal or riser (the sound-design skill).
- Leave room for the vocal: a fill under the last word of a line fights it, so fill after the line ends.
- Minimal styles (house, trap) use fewer fills; their transitions come from adding or removing elements, rolls and risers.

A one-bar fill into a chorus, with snare velocities rising from about 70 to 120 across beats 3 and 4:

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

## Building kits

- Choose sounds that suit the genre and the song. Kick and bass have to share the low end: a long, boomy kick and a long sub-bass mask each other, so shorten one of them. When the kick has a clear pitch, tune it to the key or to the bass's root.
- Snare and clap tone set the era and mood. Layer a clap with a snare for width, and nudge one by a few milliseconds if they flam.
- Take closed and open hats from the same family, in a choke group so a closed hat cuts the open one, like a real hi-hat.
- Keep one kit per song (variations per section are fine) and name the pads clearly.
- Make sure velocity changes the sound or level, so ghost notes are actually soft.
- More on kits, layering and the full note map: `references/kits.md`.

## How to work

1. Read the tempo, genre, section, bassline and vocal rhythm.
2. Propose two or three grooves that differ in feel (for example straight, half-time, syncopated), each with one line on what it does. When you offer three, label one clearly as outside the artist's usual style.
3. Write the chosen groove as a one-, two- or four-bar pattern with variation in the last bar; add fills only at phrase ends.
4. Check it (below), then present the grid so the musician can hear it before anything lands in the Set. New parts go in new clips.

## Check before presenting

- The backbeat is where the style expects it, or moved on purpose.
- The kick agrees with the bass where they should lock.
- Velocities vary — accents, ghost notes — rather than a flat 100 everywhere.
- Hat and percussion density suits the tempo (sixteenths at 170 BPM are a blur).
- Fills land on the downbeat and don't step on vocal lines.
- The clip loops cleanly, with no notes hanging past its end.
- Energy rises and falls with the sections.
- Locked drum parts are untouched.

## Reference files

| File | Read when |
|---|---|
| `references/patterns.md` | You need grooves for other feels (pop-rock variations, half-time, shuffle, funk, R&B, four-on-the-floor), more fills, or ways to vary a loop over four or eight bars. |
| `references/kits.md` | You are building or choosing a kit, mapping pads, layering or tuning drums, or need the full General MIDI drum map with Live's note names. |

## Sub-skills

Paths are relative to this skill's folder. Read a sub-skill when it applies; it adds genre detail and does not repeat this file.

| Path | Read when |
|---|---|
| `house/SKILL.md` | The track is house or house-adjacent (deep house, tech house, Afro house, disco-influenced or other four-on-the-floor dance music), or the musician wants a club groove, DJ-friendly intros and outros, builds and drops. |
| `hip-hop/SKILL.md` | The track is hip-hop or rap-led (boom bap, trap, drill, lo-fi), uses 808s, or the musician wants a beat for a rapper, hi-hat rolls, a swung, dusty feel, or a beat switch. |
