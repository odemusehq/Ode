---
name: arrangement
description: Arrange the song in place in Ableton Live by deciding what plays in each section and changing it there — take parts out or bring them in, edit the clips' notes for builds, fills, drops and variation, double a part an octave up, place transitions (risers, fills, cuts, impacts) on the downbeat, set locators, and turn a loop into a full song in the Arrangement — then check each changed section's energy against its neighbours, the downbeats, the key and the vocal's space, and report in one line. Use this whenever the musician wants a bigger chorus or drop, says a section drags or feels flat, empty, crowded or too long, wants a part added or taken out, needs an intro, outro, build, breakdown or transition, wants a loop turned into a song, or asks how long the track should be, whatever words they use.
---

# Arrangement

Arrangement decides what plays when. The same eight bars can be a forgettable loop or a song that pulls the listener from the first bar to the last; the difference is how energy and interest change over time, and how clearly the important part (usually the vocal or the hook) is heard at every moment. Which sections a song has and how long they are is song form (the song-form skill); this skill works inside and between the sections.

Ode arranges in the Set: it edits the clips already in each section, takes parts out, brings them in, and adds what a section needs where it belongs. The musician plays the result in Live straight away, and the version history keeps the arrangement as it was.

Before generating a whole song, retain its intent, sections/chords and tagged links in the lead sheet. Use its optional `composition` for the chosen hook notes or source tag/hash, lyric phrase spans tied to exact text lines/revisions, and each section's part roles, activity spans and constraints. All composition spans refer to existing `sectionId` values and use section-relative quarter-note beats; a pickup can precede the section if its Arrangement position stays nonnegative. Keep instrument readiness, kit mapping, cadence/transition choices and other musical context in the appropriate constraints/notes. Read `compositionStatus`, reconcile stale selected bindings after lyric or structural edits, and update the plan after a deliberate revision. A part activity entry expresses intention; compare it with actual clips before claiming it is applied. Production-task progress lives in `production_task_update`, separately from the musical plan. Do not infer a new chorus identity from a fresh template.

A stock-device insertion or MIDI note list is not proof of an audible instrument. Inspect the actual Drum Rack map, use `padMap` for non-GM drums, and check readiness. The groove helper is a 4/4 template; its `feel` can preserve a bridge's pulse, and other meters need an intentional MIDI pattern. Chord voicing is a sustained harmonic skeleton, not guitar articulation or piano comping.

## The loop

1. **Read.** From the project map: the locators (the sections and their bars), tempo and time signature (unknown in this SDK unless established by the musician; a scene's launch meter is not the current arrangement meter), every track and the clips it plays in each section, which clips and tracks are muted, the hand edits since the last request, and the lead sheet's sections and locked parts. Read the notes of the clips you may change. Work out what plays where (parts down the side, sections across) and rate each section's energy from 1 to 10: flat neighbours, an early peak and crowded spots show at a glance.
2. **Decide** the cause of what the musician describes ("the drop feels weak": the build before it is as full as the drop) and the smallest set of moves that fixes it, using the levers below as options. Contrast does most of the work, so before adding to a section, look at what can come out of the one before it. Use as many levers as the requested effect needs; a single subtle move can be enough.
3. **Change it in place**, as one undo step:
   - Edit the clips already in the section: their notes (a fill in the last bar, hats from eighths to sixteenths, a part doubled an octave up), their mute and their length.
   - Taking a part out of a section (removing or muting its clip there, or clearing a few bars) and bringing a part in (placing its clip on its own track in that section) are arranging, and go ahead without a question. Copying the loop or a part into the sections where it belongs is building the song, and is arranging too.
   - New material (a counter-melody, a fill, a riser, a new section) goes where it belongs: a new clip on the right track in the right bars, and a new track only for a genuinely new part. Write melodic and rhythmic material with the melody, harmony, bass or drums skills and their checks.
   - Copy sections, clips or tracks only to build the song: Again gives another take, and the history keeps the old one.
   - Leave locked parts alone: arrange around them (bring other parts in or out against them, put a transition before them) without touching their notes, clips or devices.
4. **Review** the requested properties below. Hard range, timing and kit constraints must hold; musical tension, density and contrast are advisory and can be intentional. State which checks ran and which need listening.
5. **Let them hear it.** When your turn ends, the musician presses play in Live: name the bars you changed in the result line, from a bar or two earlier for a transition, so they know where to listen.
6. **Report in one line:** what changed, then " · " and what was checked. For example:
   - "Last chorus bigger: hats in sixteenths, crash on the downbeat, pad held back in verse 2 · above chorus 1 on three levers, all in key, lands on bar 29."
   - "Verse 2 half-time for its first 8 bars, bass out for the last beat · lighter than chorus 1, downbeats intact."
   - "Breakdown added at bar 65: drums and bass out, pad and vocal chop stay · 16 bars, song now 6:12."

**Again** is another take: the Set is back as it was, so switch levers from the last take (register to rhythm, addition to subtraction), with moves as bold as before.

**Style context.** Earlier songs can suggest starting points; the current direction governs. Mention an unrequested stripped ending or other departure only when that context helps explain the choice.

## Checks

| Check | When | What to review |
|---|---|---|
| Energy | Every change | The changed section sits where the plan puts it against its neighbours. Compare what plays, the drums' note density and the highest register in each section. Judge the intended contrast in the actual song; note density/register are clues, not proof. A stripped chorus or an early peak can be intentional |
| Boundaries | Every change | Entries, impacts and transition endings meet the intended boundary, including pickups, off-beat changes and sub-bar sections; do not force the bar grid |
| Clean edges | Clips cut, shortened or moved | Every note ends at or before a cut (shorten it to end there); audio clips are cut between words and hits |
| Key | Notes written or moved | Review new pitches against the intended harmony, including chosen chromaticism or unresolved dissonance |
| Vocal space | Parts added or doubled | Review whether overlap supports the desired focus or texture; clear registers and gaps are options for intelligibility |
| Low end | Parts added | Review actual low-part interaction; a single sub owner can clarify a mix, while shared energy or rough overlap may be intentional |
| Length | Sections added, removed or resized | Boundaries and lengths agree with the intended form, including irregular phrases; with constant quarter-note BPM, seconds = beats × 60 ÷ BPM |

## Questions

Act without asking: moving, muting and editing clips in a section are edits in place that Undo reverses, and the mode decides whether a change waits for Apply. Ask one line with buttons only when the answer changes what you would do:
- in Auto, before deleting a part from the whole song or rewriting every bar of a section (in Manual, the Apply card already asks);
- in Auto and Manual, when the part you would bring in is on a muted track and the reason is unclear. Work it out first from the hand edits and the version history: muted long ago and untouched since usually means parked, so leave it out; muted moments ago while another track was soloed usually means it was muted to hear the others, so it still counts. Ask only when the reason stays unclear: "The guitar is muted — use it in the last chorus? · Use it · Leave it out".

## Energy

Energy is how intense a moment feels. Many levers raise or lower it, and several together make a change obvious.

| Lever | Lower energy | Higher energy |
|---|---|---|
| Density | Few parts | Many parts, layers, doubles |
| Low end | Kick and bass out or filtered | Full kick and bass |
| Rhythm | Half-time, long notes, sparse hats | Driving eighths or sixteenths, busier percussion |
| Register | Lower, narrower range | Higher melody, octave doublings, wider range |
| Stereo width | Narrow, centred | Wide pads, panned doubles and percussion |
| Brightness | Filtered, darker | Open filters, more top end |
| Harmonic rhythm | Chords change slowly | Chords change faster |
| Vocal | Low register, softer delivery, single voice | Higher register, harmonies, doubles, ad-libs |
| Level | Quieter | Louder (the smallest lever; contrast in the arrangement matters more) |

**Contrast makes a section big.** A chorus feels huge because the pre-chorus held something back. For a bigger chorus, look first at what can come out of the section before it.

**Example energy curves** (starting points to adapt):
- Verse–chorus song: intro 3, verse 4, pre-chorus 5, chorus 7, verse 5, pre-chorus 6, chorus 8, bridge 4 or 6, final chorus 9, outro 3.
- Club track: intro 4, build 5, breakdown 3, build 7, drop 9, break 4, build 7, drop 10, outro 4.

More forms with section lengths and durations at common tempos are in `references/forms-and-timing.md`.

## Adding and removing parts

- **When variation helps,** try a new part, a part removed, a new rhythm or a new register. An unchanged loop or sustained texture can also be the chosen effect.
- **Arrange by subtraction from a full loop.** Build the densest section (chorus or drop) first, then derive the others by removing parts; this keeps everything consistent and makes contrast easy.
- **Arrange by addition from a sparse start.** Start with the core (vocal and one instrument, or drums and bass) and add one element every 4 or 8 bars.
- **One focal point at a time.** At any moment one thing leads: the vocal, a lead synth, a guitar riff. When two parts compete for attention, let them trade (call and response) or drop one.
- **Fill the gaps between phrases.** Counter-melodies, fills and ear candy belong between vocal phrases, clear of the words.
- **Removing is as strong as adding.** Dropping the kick for a bar, cutting the bass before a chorus, or stopping everything for a beat often lifts more than a new layer.

## Roles and registers

Roles and registers can clarify a dense arrangement; parts may share or change roles when that serves the texture.

| Role | Typical parts | Usual register |
|---|---|---|
| Foundation | Kick, bass, 808 | Sub and low end (fundamentals below about 120 Hz) |
| Rhythm | Snare, clap, hats, percussion, rhythm guitar, stabs | Mids and highs |
| Harmony bed | Pads, chords, keys, strings | Low mids to upper mids, voiced away from the vocal |
| Lead | Vocal, topline, lead synth, hook | Mids and upper mids, the most exposed range |
| Counter-melody | Second line, answering phrases | A register above or below the lead |
| Texture and ear candy | Noise, atmospheres, risers, one-off effects | Wherever there is space |

When two parts collide, fix it in the arrangement before reaching for EQ: move one part an octave (with the melody or harmony skill when that changes the line), change a voicing or inversion, change one part's rhythm so they hit at different moments, or drop one of them in that section. EQ carving is the mix's job for whatever overlap remains. Keep chords out of the vocal's main octave where possible, and only one part in the sub at a time.

## Builds

A build raises tension so the next section lands. Common tools, often combined:
- Rhythmic acceleration: snare or clap repeats moving from quarter notes to eighths to sixteenths over the last 4–8 bars.
- Filter movement: a high-pass rising on the music, or a low-pass opening.
- Risers: noise sweeps, rising tones, pitch going up.
- Removing the low end in the last bar or two, so its return is the impact.
- Harmonic tension: a held dominant chord, a pedal note under changing chords, or holding the chord before the resolution.
- Vocal tools: a pickup phrase, a repeated word or chop, rising harmonies.
- Growing reverb or delay sends, so the sound gets bigger and less defined just before the drop.

Typical lengths are 4, 8 or 16 bars. A build too long for its payoff, or one that uses every tool at once, deflates the drop.

## Breakdowns

A breakdown resets the energy so the song can build again.
- Remove the drums and low end; leave a thread (a pad, the vocal, a reduced hook) so the song carries on.
- Reveal something: the hook on a new instrument, a new chord colour, an exposed vocal line.
- Keep it short enough to hold attention: 8 or 16 bars in club tracks, a few bars in a song.

## Drops and choruses

The arrival delivers what the build promised.
- For a firm arrival, bring kick and bass back on the downbeat; a delayed or offset return can create a different effect.
- A short silence or cut just before the downbeat (one beat to half a bar) makes the arrival hit harder.
- Mark the downbeat: a crash, an impact or a snare hit.
- The hook in its strongest register, as the clear focal point.
- If the drop feels weak, look at the section before it first: too full, too loud or too long?

## Transitions

Transitions signal that a change is coming and hide the seams between sections: risers and downlifters, reverse cymbals and reverse reverbs that end on the downbeat, drum fills, filter sweeps, short silences, delay throws on the last word of a phrase, impacts and crashes, tape stops, and vocal pickups into the next section. Place them by bar and beat: reverse sounds end exactly on the downbeat; impacts start on it.

Prefer transitions made with clips, notes and sounds: a fill, a drop-out, a riser cut to the build's length, a crash on the downbeat. When a move needs automation (a filter sweep, a send rising), which only the musician can draw, build it into a sound, or end the result line with the one move to draw, for example "draw Auto Filter 30 Hz → 800 Hz on the Music group over bars 57–64". How to build and place each transition is in `references/transitions.md`.

## Variation

Repetition can make a hook memorable or create a hypnotic plateau. Vary its surroundings when the song needs movement, rather than adding changes by schedule.
- For regular phrase variation, try a change every 4 or 8 bars: a fill at the end of each phrase, a part dropped for a bar, a variation of the drum pattern.
- Make verse 2 different from verse 1: a counter-melody, another drum pattern, a half-time feel, fewer or different parts.
- If a final peak is wanted, build the last chorus with harmonies or doubles, an octave lift in the instruments, extra percussion, wider stereo; sometimes a stripped-back chorus first, then the full one.
- Vary repeated loops with small changes: a different last bar, a note held over the bar line, another chord inversion.
- Decide the ending: a cold final hit, a fade, or parts leaving one by one.

## From a loop to a full song

1. **Name the parts** in the loop and their roles.
2. **Choose the form and length** from the song's context, the lead sheet's sections when it has them, and the artist's own past songs. For streaming, listeners reach the vocal or hook early; for DJ use, intros and outros of 16–32 bars led by drums make mixing easier. Place locators named the way musicians read them (Intro, Verse 1, Pre-Chorus, Chorus, Drop, Breakdown, Bridge, Outro).
3. **Choose a useful starting section** from the full loop; the densest section is one option, not a required writing order.
4. **Develop the other sections** by adding, removing or rewriting parts to suit the intended arc.
5. **Write what is missing** with the matching skill: a part for the breakdown, a fill, a counter-melody for verse 2, transition sounds.
6. **Add transitions or internal variation where useful.** A plain cut, no new layer or unchanged repetition can be deliberate.
7. **Check the whole song:** the energy curve, the downbeats, the length.

When the loop lives in Session View, copy its clips into the Arrangement section by section. To lengthen or shorten a section without breaking alignment, change every track over the same bars.

## Timing

In 4/4, **seconds = bars × 240 ÷ BPM** (in general, bars × beats per bar × 60 ÷ BPM).
- 16 bars at 120 BPM = 32 s; 16 bars at 124 BPM ≈ 31 s; 32 bars at 128 BPM = 60 s.
- A 3:30 song at 100 BPM is about 87.5 bars; a 6-minute track at 124 BPM is about 186 bars.

Four- or eight-bar phrases are convenient starting points; keep irregular or shortened phrases when the material or duration brief calls for them.

## Reference files

| File | Read when |
|---|---|
| `references/forms-and-timing.md` | Planning a full arrangement: example forms with bar counts and energy for common song types, and duration tables at common tempos |
| `references/transitions.md` | Building or placing a specific transition (riser, downlifter, reverse cymbal or reverb, fill, filter sweep, delay throw, tape stop, silence, impact) |
