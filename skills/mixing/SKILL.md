---
name: mixing
description: Mix a song in Ableton Live with Live's devices or the musician's plug-ins — gain staging and headroom, balance, panning and stereo image, EQ (cut before boost, carving space), compression and dynamics, parallel compression, sends and returns for reverb and delay, buses, sidechain, saturation, automation, masking, mono compatibility, checking at different levels and on different speakers, and reference tracks for tonal balance. Use this whenever the musician asks about levels, a muddy, harsh, thin, boomy, flat or crowded mix, a part that is buried or too loud, EQ, compression, reverb, delay, width, sidechain or pumping, meters going red, or getting a mix ready for mastering, even if they never say "mix".
---

# Mixing

A mix makes the song's important parts clear and the whole song feel the way the musician intends. Most of a mix is balance: the right level for each part, in its own space in frequency, stereo and depth. Processing serves that balance; it doesn't replace it.

The musician is the author. Listen and measure first, change one thing at a time, explain each change in a sentence with the values, and keep every change easy to compare and undo. Leave locked parts alone: if a locked part causes a problem, say so and fix around it, or ask whether to unlock it.

## How to work

1. **Listen to the whole song and measure before changing anything.** Read the track meters, measure the Master (short-term loudness of the loudest section, true peak, spectrum), and check masking between the parts the musician is worried about. Measurements back up your ears; report readings, don't guess them.
2. **Name the problem in musical words** ("the vocal is masked by the pads around 2–4 kHz in the chorus") before proposing a fix.
3. **Fix with the smallest effective move.** Often that's a fader, a pan or a mute, not a plug-in.
4. **One change at a time, compared fairly.** Match the processed level to the bypassed level before judging, because louder always sounds better. Keep the previous state recoverable (device bypass, or a duplicated chain).
5. **Measure again after the change** and listen in the context of the full section.
6. **Report briefly:** what changed (device, parameter, from and to), why, and what to listen for.

When a treatment is a matter of taste (reverb character, how wide, how present the vocal sits), offer three options with one clearly labelled as outside the artist's usual style, judged only from their own songs and stated preferences. Note what they choose; it's a preference worth remembering.

## A typical order (not a fixed workflow)

Organise (names, colours, group tracks) → gain staging → static balance (faders and pan) → corrective EQ and dynamics → buses → space (sends and returns) → character (saturation) → automation → checks (mono, levels, speakers, references). Go back and forth freely; balance is revisited after every big change.

## Gain staging and headroom

- Live's internal headroom is huge, so a red track meter doesn't distort by itself. But the Master's output and exported fixed-point files clip above 0 dBFS, and devices that model analog gear react to how hard they are driven. Sensible levels keep every device in its sweet spot and leave room for mastering.
- Aim for track peaks roughly between −12 and −6 dBFS and sustained parts lower; feed analog-modelled plug-ins an average around −18 dBFS if they were designed for it.
- Set levels with clip gain or a Utility at the start of the chain, and keep faders near their middle range for balance and automation.
- Re-check levels after EQ boosts, saturation and resonant filters; they raise the level.
- Leave the Master peaking around −6 to −3 dBFS while mixing.
- **Keep the limiter off the Master while mixing.** It hides overs, squashes the loud parts you're balancing, and makes everything sound better simply because it's louder. Loudness belongs to mastering.

## Balance

- Start with the most important element (usually the lead vocal, or kick and bass in instrumental club music), set it, then bring each part up around it.
- Monitor mostly at a moderate level. Loud monitoring exaggerates lows and highs and tires the ears; quiet listening shows whether the essentials still come through.
- Balance section by section: what works in the verse may be too loud in the chorus. Section-level changes are automation.
- If unmuting a part adds nothing, it may not need to be there; raise it with the musician as an arrangement question.

## Panning and stereo image

- **Centre:** kick, snare, bass, lead vocal and usually the main hook. They carry the song and need to survive mono playback.
- **Spread:** doubles and backing vocals, double-tracked guitars (often hard left and right), keys, percussion, hats slightly off-centre, reverb and delay returns.
- **Balance the sides.** Keep bright and busy parts distributed so neither side feels heavier.
- **Width tools:** Utility's Width, Chorus-Ensemble, stereo delays, double tracking, EQ Eight in mid/side mode (brighten or thin the sides). Very short delays between left and right (the Haas effect) widen but often cancel in mono; prefer other tools.
- **Keep the low end mono:** Utility's Bass Mono below roughly 100–150 Hz on wide parts or the Master.

## EQ

- **Cut before boost.** Cutting removes the problem without adding level or harshness; boosting makes a part louder, which fools the ear into hearing it as better. Cut the competing part rather than boosting the one you want to hear.
- **High-pass by ear, not by habit.** Parts that don't need lows can be high-passed (vocals often 70–120 Hz, guitars 80–150 Hz, pads 150–300 Hz, hats 200–500 Hz), but high-passing everything thins the mix; stop where the part starts to lose weight.
- **Narrow cuts for problems, broad moves for tone.** Resonances and ringing: Q 4–10, cut 3–8 dB. Tone: Q 0.5–1.5, moves of 1–3 dB. Needing more than about 6 dB of boost usually means the sound or the arrangement needs to change.
- **Find a problem quickly:** a brief narrow boost swept across the range locates a resonance; then cut it. Keep sweeps short; they fool the ear.
- **Carve space between parts:** cut 2–3 dB in one part where the other part's important range is (for example, cut the pad at 2–4 kHz where the vocal's presence is).
- **EQ in context.** Soloed EQ decisions rarely survive the full mix.
- **Dynamic EQ** for problems that appear only sometimes (a boomy note, harsh peaks): a Multiband Dynamics band or the musician's dynamic EQ plug-in.

Frequency ranges for each instrument and common problem areas are in `references/frequency-guide.md`.

## Compression and dynamics

Compression controls level changes, shapes transients and adds density. Use it for a reason you can name.

- **Threshold and ratio** decide how much; **attack** decides whether the transient passes (slow attack: more punch) or is caught (fast attack: smoother); **release** should let the level recover before the next note or hit (too fast distorts or pumps, too slow keeps it compressed all the time); **knee** makes the onset gentler.
- Most sources need 2–6 dB of gain reduction; more is an effect.
- Set makeup gain so bypassing doesn't change the level, then judge.

| Source | Device | Ratio | Attack | Release | Gain reduction |
|---|---|---|---|---|---|
| Lead vocal | Compressor | 3:1–6:1 | 2–10 ms | 40–100 ms or auto | 3–6 dB (see the vocals sub-skill) |
| Bass | Compressor | 3:1–6:1 | 5–30 ms | 50–150 ms | 3–6 dB |
| Kick | Compressor (if needed) | 3:1–4:1 | 10–30 ms | 30–80 ms | 2–4 dB |
| Snare | Compressor | 3:1–5:1 | 5–20 ms | 50–120 ms | 3–5 dB |
| Drum bus | Glue Compressor | 2 or 4 | 10 or 30 ms | 0.1–0.4 s or auto | 2–4 dB |
| Acoustic guitar | Compressor | 2:1–4:1 | 10–30 ms | 100–200 ms | 2–4 dB |
| Piano, keys | Compressor | 2:1–3:1 | 10–30 ms | 100–300 ms | 1–3 dB |
| Mix bus glue | Glue Compressor | 2 | 10 or 30 ms | auto | 1–2 dB |

- **Parallel compression:** compress hard (fast attack, 8–12 dB of gain reduction) and blend 20–50% with the dry signal, through the Compressor's Dry/Wet or a return track. It adds density and sustain while the dry signal keeps the transients. Common on drums, bass and vocals.
- **Serial compression:** two gentle stages (a fast one catching peaks, a slower one evening out the level) sound more natural than one heavy stage.
- **Gating and expansion:** Gate for bleed and noise between hits; gentle downward expansion (Compressor's Expand mode, or Multiband Dynamics below the threshold) for softer clean-up.
- **Transient shaping:** Drum Buss's Transients, or a compressor's attack setting, to make hits sharper or softer.

Device-by-device settings (EQ Eight, Compressor, Glue Compressor, Multiband Dynamics, Gate, Saturator, Roar, Drum Buss, Reverb, Hybrid Reverb, Delay, Echo, Utility, Limiter) are in `references/live-devices.md`.

## Sends and returns

- **Put shared reverb and delay on return tracks.** One space shared by many parts makes the mix cohesive, saves CPU and makes depth easy to balance. Return effects run 100% wet. Effects that are part of a sound stay on its track.
- **A small set usually covers a song:** a short room or ambience (0.4–1 s) for cohesion, a plate for vocals (1.2–2.5 s), a hall for depth (2–4 s), a tempo-synced delay (1/4 or 1/8 dotted), maybe a slapback (80–140 ms, little feedback).
- **EQ the returns:** high-pass around 200–500 Hz and low-pass around 6–10 kHz so the space doesn't muddy the low mids or add hiss and sibilance.
- **Pre-delay** of 10–80 ms (or a short note value at the tempo) keeps the dry attack clear of the reverb, which keeps words intelligible.
- **Duck the returns** with a compressor on the return keyed by the dry vocal (fast attack, release 100–300 ms, 3–6 dB), or Echo's ducking: tails bloom in the gaps and stay out of the words.
- **Depth:** a part feels closer when it's louder, brighter, drier and has a clear transient; further away when it's quieter, darker, wetter and softer. Post-fader sends (the default) keep the reverb in proportion to the fader.

## Buses

Group related tracks (drums, bass, music, vocals, effects) so you can process them together, balance the song with a few faders and export stems. Keep bus processing gentle: 1–3 dB of glue compression, broad EQ, light saturation.

## Sidechain

- **Ducking to the kick:** a Compressor on the bass or pads with the kick as its sidechain input; attack 0.1–1 ms, release 50–200 ms timed so the level is back before the next kick, ratio 4:1 or higher. 2–4 dB is subtle space; 6–10 dB is an audible pumping effect.
- **A steady trigger:** a separate kick trigger track that isn't heard in the mix keeps the ducking going when the audible kick drops out, or gives a regular pump.
- **Duck only the lows:** Multiband Dynamics with a sidechain input ducks the bass's low band under the kick and leaves its upper harmonics alone. When the sidechain source is a full drum bus, use the sidechain EQ so only the kick's low end triggers it.
- **Make room for the vocal:** dip pads or guitars by 1–3 dB in roughly the 1–5 kHz band only while the vocal sings (Multiband Dynamics keyed by the vocal).

## Saturation

Saturation adds harmonics (so parts are heard on small speakers), density and a sense of loudness without much extra peak level. Start subtle: Saturator (Analog Clip or Soft Sine, drive 1–6 dB, output lowered to match, Dry/Wet for parallel use), Roar at low amounts, Drum Buss on drums. Too much shows up as harshness around 2–5 kHz, smeared transients and a flatter, smaller sound. Compare at matched level.

## Automation

Static mixes rarely hold a song's interest. Ride the vocal phrase by phrase, throw delay on the last word of a line, mute or dip parts in places, make verses drier and choruses wider or brighter, open filters into choruses. Use clip gain or a Utility's gain for corrective level rides so the track fader stays free for the balance. If you can't write the automation yourself, give the musician the exact move: track, parameter, bars, from and to values.

## Masking

Masking is one sound making another harder to hear because they share a frequency range at the same time.

- **Find it:** check masking between the tracks involved, listen with the suspected part muted and unmuted, and compare their spectra in the section where the problem happens.
- **Common pairs:** kick and bass (see the low-end sub-skill); vocal against guitars, keys, pads and leads around 1–5 kHz; pads and everything else around 200–500 Hz.
- **Fix in this order:** arrangement (drop a part in that section, change its octave or rhythm), sound choice, panning, EQ carving, dynamic fixes (sidechain or multiband ducking when the overlap comes and goes), level. Recheck after each fix.

## Mono compatibility

Phones, many club systems, some speakers and broadcast play in mono or close to it. Sum the Master to mono temporarily (a Utility on the Master set to mono, removed afterwards) and listen: the lead vocal, kick, snare and bass shouldn't change much in level or tone. Parts that vanish or turn hollow usually come from short left–right delays, heavy chorus, very wide unison, wide stereo samples or polarity problems between layers or microphones. Narrow them, flip polarity, or choose a different widening method.

## Checking at different levels and on different speakers

- Listen quiet (do the vocal and the beat still come through?), at a moderate level (most of the work), and briefly loud (harshness, boom).
- Check on everything available: monitors, headphones (detail and reverb tails, but misleading for width and bass), earbuds, a laptop or phone speaker (midrange and bass harmonics), a car, a single speaker in mono.
- Take breaks. Tired ears hear less top end and accept more compression; fresh ears the next day catch what hours of work hid.

## Reference tracks

Use two or three released tracks the musician likes, in a similar context, **for tonal balance only**: low end against top end, how loud the vocal sits against the music, overall brightness and width in broad strokes. Match the loudness first (released masters are louder; measure both and turn the reference down), then compare. Don't copy a reference's arrangement, sounds or signature, and don't try to make the mix sound like a particular artist; describe the target in general qualities ("a warmer top end, the vocal more forward").

## Handing the mix to mastering

- Master peaking around −6 to −3 dBFS, no clipping anywhere, no limiter or maximiser on the Master. If the musician's sound depends on Master-bus processing (a clipper, a glue compressor), keep it and tell the mastering stage.
- Export the full length with reverb and delay tails, as WAV at the project's sample rate, 24-bit or 32-bit float, normalisation off, no dither on 32-bit float. The mastering skill covers the rest.

## Checks before calling a mix done

- The most important part is clear in every section, at low volume too.
- No masking between the lead and the parts around it; low end tight and mono.
- Peaks and headroom as above; no clipping on any track or the Master.
- Mono: nothing important disappears.
- Translates on headphones, small speakers and monitors.
- Tonal balance sensible against loudness-matched references.
- Locked parts untouched; every change can be compared and undone.

## Worked examples

**"The vocal disappears in the chorus."** Masking shows the supersaw pads and the vocal overlap at 2–4 kHz; the chorus vocal is 2 dB quieter relative to the music than in the verse. Steps: raise the chorus vocal 1.5–2 dB with automation or clip gain; cut the pads 2–3 dB around 3 kHz (Q about 1); if the overlap comes and goes, dip the pads in that band only while the vocal sings, with Multiband Dynamics keyed by the vocal. Measure masking again and listen to the chorus in context.

**"The mix is muddy."** The spectrum shows a build-up around 200–400 Hz; the reverb return has no EQ and everything is sent to it. Steps: high-pass the reverb return around 300 Hz and low-pass it near 8 kHz; cut 2–3 dB around 250–350 Hz on the pads and guitars (not the bass); check that kick and bass aren't both filling the same low range (low-end sub-skill). One change at a time, listening after each.

**"My Master is in the red."** The Master hits +2 dBFS and has a limiter on it. Explain that loudness comes later; take the limiter off, pull the loudest groups down with Utility gain until the Master peaks around −6 dBFS, keep the balance the same, and measure again.

## Reference files

| File | Read when |
|---|---|
| `references/live-devices.md` | Setting up a specific Live device for mixing and you need its controls and starting values |
| `references/frequency-guide.md` | Finding where an instrument lives in frequency, or what a problem word (muddy, boxy, harsh) usually points to |

## Sub-skills

Paths are relative to this skill's folder.

| Path | Read when |
|---|---|
| `vocals/SKILL.md` | Mixing lead vocals, doubles, harmonies, backing vocals, ad-libs or rap vocals: clean-up, EQ, compression, de-essing, reverb and delay, level rides |
| `low-end/SKILL.md` | Kick and bass or 808 fighting, boomy or weak low end, sub problems, sidechain between kick and bass, mono low end, low end on small speakers |
