---
name: mixing
description: Work on mix balance, EQ, dynamics, width and existing sends/devices for the musician's stated problem. Inspect source metrics as bounded observations, compare actual processed files when supplied, and state missing capture or routing. Use for buried, muddy, harsh, boomy, crowded or unbalanced parts and mix checks. Average spectra do not diagnose masking and independent LUFS do not establish Main headroom.
---

# Mixing

A mix makes the song's important parts clear and the whole song feel the way the musician intends. Most of a mix is balance: the right level for each part, in its own space in frequency, stereo and depth. Processing serves that balance, which always comes first.

Ode mixes in place: it moves the faders, pans and sends and changes the devices already on the tracks, and adds a device only where the track's own devices fall short of the job. The musician plays the section in Live straight away, and the available version history records supported state. It is not a complete Live project backup.

## The loop

1. Read the actual tracks, routing assumptions, existing processing, hand edits, locks and the artist's problem. Determine which signal the available audio contains before diagnosing it.
2. Use `mix_check` for bounded source observations. Its average spectra suggest candidate spectral overlap only; they do not establish simultaneous masking, processed balance or Main headroom. Independent track LUFS are not a measured sum.
3. Hear the relevant processed passage when available, including the lead-in, competing parts and effect returns. Retain supplied bounces and compare the actual files with `audio_compare`; match loudness for tone decisions, and preserve levels when balance is the question. The installed SDK cannot capture a new processed mix, so a missing bounce leaves audible verification incomplete.
4. Make the smallest supported change that addresses the observed problem. Preserve intentional colour, groove, roughness and artist choices. Existing sends and static parameters can be changed; missing routing, automation and recording operations remain explicitly incomplete.
5. Read back the changed settings. Verify audible improvement only against comparable subsequent audio and the artist's criterion. Re-running a pre-effects render after EQ or a fader change cannot verify that change.
6. Give a concise chat reply with actual changes and the remaining audition/capture step. A valid outcome can be no change, a reverted experiment or a request for the missing processed passage.

## Checks

| Property | Evidence required |
|---|---|
| Masking | Simultaneous audible competition in context; average source bands alone never prescribe a cut, pan or sidechain |
| Output clipping and headroom | Peaks of the actual relevant bus/Main output or final file. Source true peak is labelled dBTP and cannot establish downstream clipping |
| Balance | Processed parts in their musical context, including actual faders, pan, routing and effects |
| Mono | Original stereo/mono-power diagnostics and audition of the output. Centre or width settings are intentions, not proof |
| Dynamics and low end | The actual attack/recovery and musical interaction. Nominal threshold/ratio settings do not establish gain reduction or artistic benefit |

The recipes below are conditional starting points. Do not change an intentional signal or force a heuristic score merely to satisfy them.

## Questions

Mix moves are edits in place that Undo reverses, and the mode decides whether a change waits for Apply, so act without asking. Ask one line with buttons only when the answer changes what you would do: a muted track you would have to balance whose reason the hand edits and the version history leave unexplained (muted long ago and untouched since usually means parked; muted moments ago while another track was soloed usually means muted to hear the others), or a fix that would delete a part.

## A typical order (a flexible one)

Organise → gain staging → static balance (faders and pan) → corrective EQ and dynamics → buses → space (sends and returns) → character (saturation) → changes over the song → checks. Go back and forth freely; balance is revisited after every big change.

## Gain staging and headroom

- Live's internal headroom is huge, so a track meter in the red still leaves the audio clean; the Main track's output and fixed-point files clip above 0 dBFS, and devices that model analog gear react to how hard they are driven.
- Aim for track peaks roughly between −12 and −6 dBFS, sustained parts lower; feed analog-modelled plug-ins an average around −18 dBFS if they were designed for it.
- Set levels with a Utility at the start of the chain, and keep faders near their middle range for balance.
- Re-check levels after EQ boosts, saturation and resonant filters; they raise the level.
- Leave the Main track peaking around −6 to −3 dBFS while mixing.
- Temporarily bypass a Main limiter only when that comparison helps and it is not integral to the artist's sound; restore it afterwards and compare at matched loudness. Preserve an intentionally limited mix.

## Balance

- Start from the most important element (usually the lead vocal, or kick and bass in instrumental club music), set it, then bring each part up around it.
- Balance section by section: what works in the verse may be too loud in the chorus.
- A part that leaves the mix the same when unmuted is an arrangement question: leave it and mention it in the result line.

## Panning and stereo image

- **Centre:** kick, snare, bass, lead vocal and usually the main hook. They carry the song and must survive mono playback.
- **Spread:** doubles and backing vocals, double-tracked guitars (often hard left and right), keys, percussion, hats slightly off-centre, reverb and delay returns.
- **Balance the sides:** bright and busy parts distributed so the two sides feel equally weighted.
- **Width tools:** Utility's Width, Chorus-Ensemble, stereo delays, EQ Eight in mid/side mode (brighten or thin the sides). Very short delays between left and right (the Haas effect) widen but often cancel in mono; prefer other tools.
- **Low end mono:** Utility's Bass Mono below roughly 100–150 Hz on wide parts.

## EQ

- **Cut before boost.** Cutting removes the problem without adding level or harshness; cut the competing part to make room for the one you want to hear.
- **High-pass by ear, case by case.** Parts that work without their lows can be high-passed (vocals often 70–120 Hz, guitars 80–150 Hz, pads 150–300 Hz, hats 200–500 Hz), but high-passing everything thins the mix; stop where the part starts to lose weight.
- **Narrow cuts for problems, broad moves for tone.** Resonances and ringing: Q 4–10, cut 3–8 dB. Tone: Q 0.5–1.5, moves of 1–3 dB. Needing more than about 6 dB of boost usually means the sound or the arrangement should change.
- **Carve space between parts:** cut 2–3 dB in one part where the other part's important range is (the pad at 2–4 kHz, where the vocal's presence is).
- **EQ in context.** Decisions made on a soloed part rarely survive the full mix.
- **Dynamic EQ** for problems that come and go (a boomy note, harsh peaks): a Multiband Dynamics band or a dynamic EQ plug-in the musician already has on the track.

Frequency ranges per instrument and what problem words usually point to are in `references/frequency-guide.md`.

## Compression and dynamics

Compression controls level changes, shapes transients and adds density; use it for a reason you can name.

- **Threshold and ratio** decide how much; **attack** decides whether the transient passes (slow: more punch) or is caught (fast: smoother); **release** lets the level recover before the next note or hit (too fast distorts or pumps, too slow keeps it compressed all the time); **knee** makes the onset gentler.
- Most sources need 2–6 dB of gain reduction; more is an effect.
- Set makeup gain so bypassing keeps the same level.

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
- **EQ the returns:** high-pass around 200–500 Hz and low-pass around 6–10 kHz, so the space keeps the low mids clear and stays free of hiss and sibilance.
- **Pre-delay** of 10–80 ms (or a short note value) keeps the dry attack clear of the reverb, which keeps words intelligible.
- **Duck the returns** with Echo's ducking, or a compressor on the return keyed by the dry vocal: tails bloom in the gaps and stay out of the words.
- **Depth:** a part feels closer when it is louder, brighter, drier and has a clear transient; further away when it is quieter, darker, wetter and softer.

## Buses

Group related tracks (drums, bass, music, vocals, effects) to process them together and balance the song with a few faders. Keep bus processing gentle: 1–3 dB of glue compression, broad EQ, light saturation.

## Sidechain

- **Ducking to the kick:** a Compressor on the bass or pads with the kick as its sidechain source; attack 0.1–1 ms, release 50–200 ms timed so the level is back before the next kick, ratio 4:1 or higher. 2–4 dB is subtle space; 6–10 dB is audible pumping.
- **Duck only the lows:** Multiband Dynamics keyed by the kick ducks the bass's low band and leaves its upper harmonics alone.
- **Make room for the vocal:** dip pads or guitars by 1–3 dB in roughly the 1–5 kHz band only while the vocal sings (Multiband Dynamics keyed by the vocal).
- A sidechain needs its source routed in Live. When it is already routed, tune it. When it is still unrouted and routing it is beyond your reach, prefer a fix you can make (an EQ carve, shorter bass notes, a level move), or set up the compressor and end the result line with the one routing step left: "pick Kick as the sidechain source on Bass".

## Saturation

Saturation adds harmonics (so parts are heard on small speakers), density and a sense of loudness without much extra peak level. Start subtle: Saturator (Analog Clip or Soft Sine, drive 1–6 dB, output lowered to match, Dry/Wet for parallel use), Roar at low amounts, Drum Buss on drums. Too much shows as harshness around 2–5 kHz, smeared transients and a flatter, smaller sound.

## Changes over the song

Static mixes rarely hold a song's interest: drier verses and wider, brighter choruses, delay on the last word of a line, parts dipped in places. Devices that react to the music (a compressor keyed by the vocal, ducking delays) work across the whole song without automation. When a move needs automation beyond what you can write (a ride on one phrase, a send rising into the chorus), make the rest of the change and end the result line with the one move to draw: track, parameter, bars, from and to.

## Masking

Masking is one sound making another harder to hear because they share a frequency range at the same time.

- **Investigate:** compare source spectra as candidates, then hear aligned processed overlap in the problem section. Alternating phrases cannot mask one another merely because their average spectra match.
- **Common pairs:** kick and bass (low-end sub-skill); the vocal against guitars, keys, pads and leads around 1–5 kHz; pads and everything else around 200–500 Hz.
- Choose an arrangement, sound, balance or processing move only after identifying the audible problem, then compare the outcome. Preserve intentional overlap.

## Mono compatibility

Phones, many club systems and some speakers play in mono or close to it. The musician hears it with the Main track summed to mono in Live (a Utility on the Main track set to mono, switched off afterwards); Ode checks the settings that usually cause trouble. Parts that vanish or turn hollow usually come from short left–right delays, heavy chorus, very wide unison, wide stereo samples or polarity problems between layers or microphones: narrow them, flip polarity, or choose another widening method.

## Reference tracks

When the musician supplies a reference track, use it for tonal balance only: measure it with the audio analysis, then compare its low end against top end, how loud the vocal sits, and its brightness and width with the mix in broad strokes; the musician compares the two by ear at matched loudness in Live. A reference's arrangement, sounds and signature stay with the reference; describe the target in general qualities ("a warmer top end, the vocal more forward").

## Handing the mix to mastering

The Main track peaks around −6 to −3 dBFS, every level sits below clipping, and limiting and maximising wait for mastering. Master-bus processing the musician's sound depends on (a clipper, a glue compressor) stays, and the mastering skill works on top of it.

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
