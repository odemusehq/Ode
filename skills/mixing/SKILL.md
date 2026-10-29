---
name: mixing
description: Mix the song in place in Ableton Live with Live's devices or the musician's plug-ins — levels, panning and sends, EQ that carves space, compression, saturation, reverb and delay returns, buses and the low end — by changing the faders, sends and devices already in the Set, then check masking and levels on the tracks' own audio, and mono, and report in one line. Use this whenever the musician clicks a mix suggestion's Fix or "Check the mix", says a part is buried, too loud, muddy, harsh, boomy, thin, crowded or flat, asks about EQ, compression, reverb, delay, width, sidechain or pumping, sees Live's meters going red, or wants the mix ready for mastering, even if they never say "mix".
---

# Mixing

A mix makes the song's important parts clear and the whole song feel the way the musician intends. Most of a mix is balance: the right level for each part, in its own space in frequency, stereo and depth. Processing serves that balance; it doesn't replace it.

Ode mixes in place: it moves the faders, pans and sends and changes the devices already on the tracks, and adds a device only where nothing on the track can do the job. The musician plays the section in Live straight away, and the version history keeps every earlier mix.

## The loop

1. **Read.** From the project map: each track's mixer (volume, pan, sends) and its devices with their values, the return tracks, the Main track's devices, the sections, and the hand edits since the last request (a fader the musician just moved is a decision: mix around it). Then measure before changing anything: masking between the parts involved, in the section where the problem is, and the levels of the tracks you will touch. The mix check renders each audio track's own sound, before its devices and fader; a device or fader change is heard in Live. Readings back up the decision; never guess them.
2. **Decide.** Name the problem in musical words ("the pad covers the vocal at 2–4 kHz in the chorus") and choose the smallest move that fixes it: a fader, a pan or a send before a cut, a cut before dynamics. Cut the competing part rather than boosting the one that should be heard; boosts make a part louder, which fools the ear into hearing it as better.
3. **Change it in place**, as one undo step:
   - Use what is on the track first: a free band of its EQ Eight, its compressor's threshold, an existing send. Add a device only when nothing there can do it, and never a second copy of a device to compare.
   - Never duplicate tracks or clips to try a mix move. Parallel processing goes through a return track or a device's Dry/Wet, not a copy of the part.
   - Keep the musician's notes and parts. When the cleanest fix is an arrangement or sound change (drop a part in a section, move it an octave), make it with that skill and say so in the result line.
   - When a move changes level (an EQ boost, saturation, compression), match the output to the input, so the change is heard for its tone, not its loudness.
   - Leave locked parts alone; if one causes the problem, fix around it and say so.
4. **Verify** with the checks below, fixing until they pass (up to three rounds); otherwise the result line says what still fails. A setting is not a measurement: give readings only from checks that ran after the change.
5. **Let them hear it.** When your turn ends, the musician presses play in Live: name the section you worked on in the result line, so they know where to listen.
6. **Report in one line:** what changed (device, parameter, from → to), then " · " and what was checked. For example:
   - "Pad cut 3 dB at 3 kHz on its EQ Eight · on the clash with the vocal that the masking check found in the chorus."
   - "Reverb return high-passed at 300 Hz, pad and guitar −2 dB at 250 Hz · on the 250 Hz build-up the masking check found, bass still mono below 120 Hz."
   - "Bass compressed 4 dB, kick up 1 dB · one owner of the sub, track levels clear of clipping."

**Again** is another take: the Set is back as it was, so fix it a clearly different way (a dynamic cut instead of a static one, a level move instead of a cut, carving another part).

**Outside the usual style.** Taste calls (how wet, how wide, how forward the vocal) are made by acting, not by asking. When a take goes beyond the artist's usual mixes — judged only from their own songs and what they have said — the result line says so.

## Checks

| Check | When | Correct when |
|---|---|---|
| Masking | Parts that collide, and "Check the mix" | The move sits on the band and in the section where the masking check found the collision, at the size the plan called for. The check reads each track's own audio before its devices, so it finds the collision, and the musician hears the fix in Live |
| Clipping | Every change | The mix check shows every audio track's own audio below clipping, and every gain a change adds (an EQ boost, saturation, compression makeup) is taken back at the device's output |
| Headroom | "Check the mix", and before mastering | The mix check over the loudest section finds every audio track within its gain-staging window and the summed level clear of a hot mix, and any limiter on the Main track stays switched off while mixing |
| Mono | Width, pan or polarity changes, and "Check the mix" | The kick, bass, snare and lead vocal stay centred, everything below 100–150 Hz is mono (Bass Mono on wide parts), and the width comes from panning, doubles and stereo effects; very short left–right delays cancel when summed to mono |
| Low end | Changes to kick, bass, 808 or anything below 150 Hz | One part owns the sub at any moment, and the low end is mono below 100–150 Hz (low-end sub-skill) |

## Questions

Mix moves are edits in place that Undo reverses, and the mode decides whether a change waits for Apply, so don't ask. Ask one line with buttons only when the answer changes what you would do: a muted track you would have to balance whose reason the hand edits and the version history don't explain (muted long ago and untouched since usually means parked; muted moments ago while another track was soloed usually means muted to hear the others), or a fix that would delete a part.

## A typical order (not a fixed workflow)

Organise → gain staging → static balance (faders and pan) → corrective EQ and dynamics → buses → space (sends and returns) → character (saturation) → changes over the song → checks. Go back and forth freely; balance is revisited after every big change.

## Gain staging and headroom

- Live's internal headroom is huge, so a red track meter doesn't distort by itself; but the Main track's output and fixed-point files clip above 0 dBFS, and devices that model analog gear react to how hard they are driven.
- Aim for track peaks roughly between −12 and −6 dBFS, sustained parts lower; feed analog-modelled plug-ins an average around −18 dBFS if they were designed for it.
- Set levels with a Utility at the start of the chain, and keep faders near their middle range for balance.
- Re-check levels after EQ boosts, saturation and resonant filters; they raise the level.
- Leave the Main track peaking around −6 to −3 dBFS while mixing.
- Mix with any limiter on the Main track switched off, then switch it back as it was: a limiter hides overs, squashes the loud parts being balanced, and makes everything sound better simply because it is louder. Loudness belongs to mastering.

## Balance

- Start from the most important element (usually the lead vocal, or kick and bass in instrumental club music), set it, then bring each part up around it.
- Balance section by section: what works in the verse may be too loud in the chorus.
- A part that adds nothing when unmuted is an arrangement question: leave it and mention it in the result line.

## Panning and stereo image

- **Centre:** kick, snare, bass, lead vocal and usually the main hook. They carry the song and must survive mono playback.
- **Spread:** doubles and backing vocals, double-tracked guitars (often hard left and right), keys, percussion, hats slightly off-centre, reverb and delay returns.
- **Balance the sides:** bright and busy parts distributed so neither side feels heavier.
- **Width tools:** Utility's Width, Chorus-Ensemble, stereo delays, EQ Eight in mid/side mode (brighten or thin the sides). Very short delays between left and right (the Haas effect) widen but often cancel in mono; prefer other tools.
- **Low end mono:** Utility's Bass Mono below roughly 100–150 Hz on wide parts.

## EQ

- **Cut before boost.** Cutting removes the problem without adding level or harshness; cut the competing part rather than boosting the one you want to hear.
- **High-pass by ear, not by habit.** Parts that don't need lows can be high-passed (vocals often 70–120 Hz, guitars 80–150 Hz, pads 150–300 Hz, hats 200–500 Hz), but high-passing everything thins the mix; stop where the part starts to lose weight.
- **Narrow cuts for problems, broad moves for tone.** Resonances and ringing: Q 4–10, cut 3–8 dB. Tone: Q 0.5–1.5, moves of 1–3 dB. Needing more than about 6 dB of boost usually means the sound or the arrangement should change.
- **Carve space between parts:** cut 2–3 dB in one part where the other part's important range is (the pad at 2–4 kHz, where the vocal's presence is).
- **EQ in context.** Decisions made on a soloed part rarely survive the full mix.
- **Dynamic EQ** for problems that come and go (a boomy note, harsh peaks): a Multiband Dynamics band or a dynamic EQ plug-in the musician already has on the track.

Frequency ranges per instrument and what problem words usually point to are in `references/frequency-guide.md`.

## Compression and dynamics

Compression controls level changes, shapes transients and adds density; use it for a reason you can name.

- **Threshold and ratio** decide how much; **attack** decides whether the transient passes (slow: more punch) or is caught (fast: smoother); **release** lets the level recover before the next note or hit (too fast distorts or pumps, too slow keeps it compressed all the time); **knee** makes the onset gentler.
- Most sources need 2–6 dB of gain reduction; more is an effect.
- Set makeup gain so bypassing doesn't change the level.

| Source | Device | Ratio | Attack | Release | Gain reduction |
|---|---|---|---|---|---|
| Lead vocal | Compressor | 3:1–6:1 | 2–10 ms | 40–100 ms or auto | 3–6 dB (vocals sub-skill) |
| Bass | Compressor | 3:1–6:1 | 5–30 ms | 50–150 ms | 3–6 dB |
| Kick | Compressor (if needed) | 3:1–4:1 | 10–30 ms | 30–80 ms | 2–4 dB |
| Snare | Compressor | 3:1–5:1 | 5–20 ms | 50–120 ms | 3–5 dB |
| Drum bus | Glue Compressor | 2 or 4 | 10 or 30 ms | 0.1–0.4 s or auto | 2–4 dB |
| Acoustic guitar | Compressor | 2:1–4:1 | 10–30 ms | 100–200 ms | 2–4 dB |
| Piano, keys | Compressor | 2:1–3:1 | 10–30 ms | 100–300 ms | 1–3 dB |
| Mix bus glue | Glue Compressor | 2 | 10 or 30 ms | auto | 1–2 dB |

- **Parallel compression:** compress hard (fast attack, 8–12 dB of gain reduction) and blend 20–50% with the dry signal, through the Compressor's Dry/Wet or a return track. Density and sustain from the compressed signal, transients from the dry one.
- **Serial compression:** two gentle stages (a fast one catching peaks, a slower one evening out the level) sound more natural than one heavy stage.
- **Gating and expansion:** Gate for bleed and noise between hits; gentle downward expansion for softer clean-up.

Device-by-device settings are in `references/live-devices.md`.

## Sends and returns

- **Shared reverb and delay live on return tracks:** one space shared by many parts makes the mix cohesive and depth easy to balance. Return effects run 100% wet; effects that are part of a sound stay on its track.
- **A small set usually covers a song:** a short room (0.4–1 s) for cohesion, a plate for vocals (1.2–2.5 s), a hall for depth (2–4 s), a tempo-synced delay (quarter or dotted eighth), maybe a slapback (80–140 ms, little feedback). Ode works with the return tracks the Set has; when the song needs another, the result line names it so the musician can add it in Live.
- **EQ the returns:** high-pass around 200–500 Hz and low-pass around 6–10 kHz, so the space doesn't muddy the low mids or add hiss and sibilance.
- **Pre-delay** of 10–80 ms (or a short note value) keeps the dry attack clear of the reverb, which keeps words intelligible.
- **Duck the returns** with Echo's ducking, or a compressor on the return keyed by the dry vocal: tails bloom in the gaps and stay out of the words.
- **Depth:** a part feels closer when it is louder, brighter, drier and has a clear transient; further away when it is quieter, darker, wetter and softer.

## Buses

Group related tracks (drums, bass, music, vocals, effects) to process them together and balance the song with a few faders. Keep bus processing gentle: 1–3 dB of glue compression, broad EQ, light saturation.

## Sidechain

- **Ducking to the kick:** a Compressor on the bass or pads with the kick as its sidechain source; attack 0.1–1 ms, release 50–200 ms timed so the level is back before the next kick, ratio 4:1 or higher. 2–4 dB is subtle space; 6–10 dB is audible pumping.
- **Duck only the lows:** Multiband Dynamics keyed by the kick ducks the bass's low band and leaves its upper harmonics alone.
- **Make room for the vocal:** dip pads or guitars by 1–3 dB in roughly the 1–5 kHz band only while the vocal sings (Multiband Dynamics keyed by the vocal).
- A sidechain needs its source routed in Live. When it is already routed, tune it. When it isn't and you can't route it, prefer a fix you can make (an EQ carve, shorter bass notes, a level move), or set up the compressor and end the result line with the one routing step left: "pick Kick as the sidechain source on Bass".

## Saturation

Saturation adds harmonics (so parts are heard on small speakers), density and a sense of loudness without much extra peak level. Start subtle: Saturator (Analog Clip or Soft Sine, drive 1–6 dB, output lowered to match, Dry/Wet for parallel use), Roar at low amounts, Drum Buss on drums. Too much shows as harshness around 2–5 kHz, smeared transients and a flatter, smaller sound.

## Changes over the song

Static mixes rarely hold a song's interest: drier verses and wider, brighter choruses, delay on the last word of a line, parts dipped in places. Devices that react to the music (a compressor keyed by the vocal, ducking delays) work across the whole song without automation. When a move needs automation you can't write (a ride on one phrase, a send rising into the chorus), make the rest of the change and end the result line with the one move to draw: track, parameter, bars, from and to.

## Masking

Masking is one sound making another harder to hear because they share a frequency range at the same time.

- **Find it:** measure masking between the tracks involved in the section where it happens, and compare their spectra.
- **Common pairs:** kick and bass (low-end sub-skill); the vocal against guitars, keys, pads and leads around 1–5 kHz; pads and everything else around 200–500 Hz.
- **Fix in this order:** arrangement (drop a part in that section, change its octave or rhythm), sound choice, panning, EQ carving, dynamic fixes (sidechain or multiband ducking when the overlap comes and goes), level. Check again after each fix.

## Mono compatibility

Phones, many club systems and some speakers play in mono or close to it. The musician hears it with the Main track summed to mono in Live (a Utility on the Main track set to mono, switched off afterwards); Ode checks the settings that usually cause trouble. Parts that vanish or turn hollow usually come from short left–right delays, heavy chorus, very wide unison, wide stereo samples or polarity problems between layers or microphones: narrow them, flip polarity, or choose another widening method.

## Reference tracks

When the musician supplies a reference track, use it for tonal balance only: measure it with the audio analysis, then compare its low end against top end, how loud the vocal sits, and its brightness and width with the mix in broad strokes; the musician compares the two by ear at matched loudness in Live. Never copy a reference's arrangement, sounds or signature, and describe the target in general qualities ("a warmer top end, the vocal more forward").

## Handing the mix to mastering

The Main track peaks around −6 to −3 dBFS, nothing clips, and no limiter or maximiser does the work. Master-bus processing the musician's sound depends on (a clipper, a glue compressor) stays, and the mastering skill works on top of it.

## Reference files

| File | Read when |
|---|---|
| `references/live-devices.md` | Setting up a specific Live device for mixing and you need its controls and starting values |
| `references/frequency-guide.md` | Finding where an instrument lives in frequency, or what a problem word (muddy, boxy, harsh) usually points to |

## Sub-skills

Paths are relative to this skill's folder.

| Path | Read when |
|---|---|
| `vocals/SKILL.md` | Mixing lead vocals, doubles, harmonies, backing vocals, ad-libs or rap vocals: clean-up, EQ, compression, de-essing, reverb and delay, level |
| `low-end/SKILL.md` | Kick and bass or 808 fighting, boomy or weak low end, sub problems, ducking between kick and bass, mono low end, low end on small speakers |
