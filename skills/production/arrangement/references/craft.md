# Arrangement

Arrangement decides what plays when. The same eight bars can be a forgettable loop or a song that pulls the listener from the first bar to the last; the difference is how energy and interest change over time, and how clearly the important part (usually the vocal or the hook) is heard at every moment. Which sections a song has and how long they are is song form (the song-form skill); this skill works inside and between the sections.

Ode arranges in the Set: it edits the clips already in each section, takes parts out, brings them in, and adds what a section needs where it belongs. The musician plays the result in Live straight away, and the version history keeps the arrangement as it was.

Before generating a whole song, retain its intent, sections/chords and tagged links in the lead sheet. Use its optional `composition` for the chosen hook notes or source tag/hash, lyric phrase spans tied to exact text lines/revisions, and each section's part roles, activity spans and constraints. All composition spans refer to existing `sectionId` values and use section-relative quarter-note beats; a pickup can precede the section if its Arrangement position stays nonnegative. Keep instrument readiness, kit mapping, cadence/transition choices and other musical context in the appropriate constraints/notes. Read `compositionStatus`, reconcile stale selected bindings after lyric or structural edits, and update the plan after a deliberate revision. A part activity entry expresses intention; compare it with actual clips before claiming it is applied. Production-task progress lives in `production_task_update`, separately from the musical plan. Do not infer a new chorus identity from a fresh template.

A stock-device insertion or MIDI note list is not proof of an audible instrument. Inspect the actual Drum Rack chains and receiving-note mapping before writing notes; GM is not guaranteed. Decide timing, articulation and dynamics through the configured model and native note writers. Existing native Groove Pool assignments are available through the tools in `production/live-controls`; no local groove template or humanisation engine exists. Sustained chord notes do not by themselves establish guitar articulation or piano comping.

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
