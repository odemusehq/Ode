# Live's devices for mixing

Controls and starting values for Live's built-in devices in a mix. Values are starting points to move from while listening in context, compared at matched level. Third-party equivalents work the same way when the musician prefers them.

## Contents
- EQ Eight and Channel EQ
- Compressor
- Glue Compressor
- Multiband Dynamics
- Gate
- Saturator, Roar, Drum Buss
- Reverb
- Hybrid Reverb
- Delay and Echo
- Utility
- Limiter (in a mix)
- The mixer itself

## EQ Eight and Channel EQ

**EQ Eight:** eight bands, each a low cut (12 or 48 dB/octave), low shelf, bell, notch, high shelf or high cut (12 or 48 dB/octave); gain up to ±15 dB per band; Q; a Scale control that scales every band's gain at once; Stereo, L/R or M/S mode; a per-band audition to hear just that band; Adaptive Q; an oversampling option for more accurate high-frequency curves.

| Job | Settings |
|---|---|
| High-pass a part | Low cut 12 dB/oct for gentle, 48 dB/oct for a firm cut; frequency by ear, stopping before the part loses weight |
| Remove a resonance | Bell, Q 4–10, cut 3–8 dB at the ringing frequency |
| Tone shaping | Bell or shelf, Q 0.5–1.5, 1–3 dB |
| Add air | High shelf at 10–12 kHz, +1–3 dB |
| Keep lows mono on a wide part | M/S mode, low cut on the Side channel around 100–200 Hz |
| Brighten width without touching the centre | M/S mode, gentle high shelf on the Side channel |

Use Scale to try a whole EQ curve at half or double strength in one move. If a boost needs more than about 6 dB, reconsider the sound or the arrangement.

**Channel EQ:** a simple three-band EQ with an 80 Hz high-pass switch; quick, broad tone shaping when precision isn't needed.

## Compressor

Controls: Threshold, Ratio, Attack (from 0.01 ms), Release (with Auto), Knee, Makeup (with automatic makeup), Dry/Wet; Peak, RMS and Expand modes; a linear or logarithmic envelope; lookahead (0, 1 or 10 ms); a sidechain section with an EQ on the sidechain signal.

- **Peak mode** reacts to transients: drums, plucked sounds, catching vocal peaks. **RMS mode** reacts to average level: smoother levelling of vocals, bass and buses. **Expand mode** turns it into a downward expander.
- **Lookahead** lets it catch the very start of a transient, at the cost of a little latency.
- **Sidechain EQ** decides what the compressor listens to: a band-pass on the kick's low end, or on the sibilance band for de-essing.
- **Dry/Wet** gives parallel compression on the track itself.

Starting values per source are in the main skill's compression table.

## Glue Compressor

Modelled on a classic console bus compressor. Controls: Threshold, Ratio (2, 4 or 10), Attack (0.01–30 ms in steps), Release (0.1–1.2 s, or Auto), Makeup, Range, Dry/Wet, a Soft Clip switch, and a sidechain with EQ.

| Use | Settings | Why |
|---|---|---|
| Drum bus | Ratio 4 (or 2), attack 10–30 ms, release 0.1–0.4 s or Auto, 2–4 dB | A slower attack lets hits through and adds punch and cohesion |
| Mix bus glue | Ratio 2, attack 10 or 30 ms, release Auto, 1–2 dB | Gentle gain reduction ties parts together without audible pumping |
| Parallel drums | Ratio 10, attack 0.1–1 ms, release 0.1–0.2 s, heavy reduction, Dry/Wet 20–40% | Dense sustain blended under untouched transients |

**Range** caps how much gain reduction can happen, which keeps heavy settings from overdoing it. Leave **Soft Clip** off unless you want its clipping; it changes the sound of peaks.

## Multiband Dynamics

Three bands with adjustable crossovers. Each band can compress or expand above its upper threshold and below its lower threshold, with its own attack, release, input and output gain. Global Amount and Time scale every band at once; there are Peak and RMS modes and a sidechain input.

| Job | Settings |
|---|---|
| De-essing | Use mainly the high band, crossover around 5–6 kHz; compress above threshold (ratio 3:1–6:1, fast attack, release 50–100 ms) so only sibilant moments are reduced by 3–6 dB |
| Taming low-end boom | Low band, crossover around 120–200 Hz; compress the boomy notes by 2–4 dB |
| Ducking only the lows | Sidechain from the kick; compress the low band so the bass's sub dips while its upper band is untouched |
| Making room for a vocal | Sidechain from the vocal; compress the mid band (set crossovers around 1 kHz and 5 kHz) on pads or guitars by 1–3 dB |

Heavy upward and downward compression on all three bands (the familiar OTT-style setting) is a sound-design effect, not a mix fix.

## Gate

Controls: Threshold, Return (the gap between opening and closing thresholds, which stops chattering), Attack, Hold, Release, Floor (how far it turns down when closed), Lookahead, Flip, and a sidechain.

- Drums with bleed: attack 0.02–1 ms, hold 10–50 ms, release 50–200 ms, floor −20 to −40 dB for a natural result (−inf only for an obvious gated effect).
- Set Return a few dB so the gate doesn't flutter on decaying notes.

## Saturator, Roar, Drum Buss

- **Saturator** in a mix: Analog Clip or Soft Sine, drive 1–6 dB, output lowered to match, Dry/Wet 30–100%. Bass Shaper for adding harmonics to low parts. Watch for harshness around 2–5 kHz.
- **Roar** in a mix: one stage, Tube Preamp or Soft Sine shaper, low amount; Multiband routing to saturate a bass's upper band while the low band stays clean; Dry/Wet for parallel use.
- **Drum Buss** on drums: Drive and Crunch low to start, Transients to sharpen or soften hits, Damp to tame harsh tops, Boom tuned to the kick's fundamental for extra weight (use sparingly; it adds low end the bass may already own), Comp for a fixed, gentle compression, Trim to set the input.

## Reverb

Controls: input low and high cut, pre-delay, size, decay time, diffusion and early reflections, density, a Freeze switch, stereo width and Dry/Wet (100% on returns).

| Space | Size and decay | Pre-delay | Input filters | Use |
|---|---|---|---|---|
| Room, ambience | Small, 0.4–1 s | 0–15 ms | Low cut 200–300 Hz, high cut 6–8 kHz | Cohesion on drums and instruments, a sense of a real space |
| Plate-like vocal space | Medium, 1.2–2.5 s, high diffusion | 20–80 ms or a short note value | Low cut 300–500 Hz, high cut 6–9 kHz | Smooth, bright tail that stays out of the words |
| Hall | Large, 2–4 s | 30–80 ms | Low cut 200–400 Hz, high cut 5–8 kHz | Depth behind pads, strings, slow songs |

## Hybrid Reverb

Convolution and algorithmic engines in serial or parallel, blended; algorithms include Dark Hall, Quartz, Shimmer, Tides and Prism; an EQ section, a Vintage control and a Bass Mono option.

- Convolution with a real room or hall impulse response for natural spaces; the algorithm for smooth, controllable tails.
- Turn on Bass Mono so the reverb's low end doesn't widen the mix's low end.
- Use its EQ to high-pass and low-pass the tail as with any return.

## Delay and Echo

**Delay:** synced or millisecond times per side, Link, Ping Pong, Feedback, a band-pass filter on the repeats, modulation, Freeze, and a transition mode for time changes.
- Vocal delay: 1/4 or 1/8 dotted, feedback 15–35%, filter narrowing the repeats to roughly 300 Hz–5 kHz.
- Slapback: one repeat at 80–140 ms, feedback near 0%.

**Echo:** a character delay with Stereo, Ping Pong and Mid/Side modes, high- and low-pass filters, modulation, noise and wobble, a reverb section, and ducking.
- Ducking lowers the repeats while the source plays, so the delay can be louder without blurring the words.
- High-pass 200–500 Hz and low-pass 3–6 kHz for repeats that sit behind the dry part.

## Utility

Controls: Gain, Width, Mono, Bass Mono with an adjustable frequency, Balance, polarity invert for left and right, channel mode (left, right, swap), a DC filter and Mute.

- **Gain** at the start of a chain sets the level into the devices; at the end it matches levels for fair comparisons.
- **Width** below 100% narrows; 0% is mono.
- **Bass Mono** makes everything below the set frequency (typically 100–150 Hz) mono.
- **Mono** on the Master is a quick mono check; take it off afterwards.
- **Polarity invert** fixes cancellation between layers or microphones; keep the setting with more low end and a clearer attack.

## Limiter (in a mix)

Keep the Limiter off the Master while mixing. On individual tracks it can catch rare peaks (a stray loud hit), set to touch only those peaks. If the musician wants a louder rough mix to play to someone, put a limiter at the very end of the Master for that bounce only and take it off afterwards; the mastering skill covers real limiting.

## The mixer itself

- Track faders and pan are the main mix tools; most balance problems are solved there.
- Live's split stereo pan mode pans the left and right channels of a stereo track independently, useful for narrowing a wide recording or placing its sides.
- Post-fader sends keep the effect level in proportion to the fader; pre-fader sends keep it constant whatever the fader does.
- Group tracks are buses; return tracks hold shared effects.
