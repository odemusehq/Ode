---
name: sound-design-drums
description: Choosing, layering, tuning, synthesising and processing drum sounds in Live — kicks, snares, claps, hi-hats, cymbals, percussion and 808s — building Drum Rack kits from samples, slicing drum loops, and cleaning drums isolated from recordings or generated one-shots. Read this when the job is how the drums sound (punch, weight, tone, length, tuning, kit coherence), after the general sound-design skill; groove and pattern writing belong to the drums skill.
---

# Drum sound design

This sub-skill covers how the drums sound. How they play (grooves, fills, velocity patterns) belongs to the drums skill; how they sit in the final balance belongs to mixing. The general way of working (small reviewable changes, check in context, rights and sources) is in the parent sound-design skill.

## Choosing drum sounds

- **Audition in the groove, with the bass and the music playing.** A kick that sounds huge alone may be too long for a busy bassline; a snare that sounds thin alone may be exactly what cuts through a dense chorus.
- **Choose for length as well as tone.** Short, tight hits leave space and feel fast; long, boomy hits fill space and suit sparse arrangements and slower tempos.
- **Keep the kit coherent.** Samples from very different sources (dry and close, roomy and old, bright and modern) can sound pasted together. Either choose them to match, or give the whole kit a shared room or saturation so it reads as one kit. Contrast is fine when it's a decision.
- **Fewer, better sounds.** Three layers that each do something beat six that blur together.

## Where each drum lives

| Drum | Weight | Body | Problem area | Attack and detail |
|---|---|---|---|---|
| Kick | 40–60 Hz (sub) | 60–120 Hz (punch) | 250–500 Hz (boxy) | 2–5 kHz (beater click) |
| Snare | — | 150–250 Hz | 400–800 Hz (boxy, ringing) | 1–5 kHz (crack), 5–10 kHz (rattle, sizzle) |
| Clap | — | 800 Hz–1.5 kHz | 300–500 Hz | 1–4 kHz, plus its tail |
| Hi-hats, cymbals | — | — | below 300 Hz (bleed, noise) | 3–6 kHz (attack), 8–14 kHz (shimmer) |
| Toms | 60–120 Hz (floor) to 150–300 Hz (rack) | — | 300–600 Hz | 2–5 kHz |
| 808 | 30–60 Hz fundamental | harmonics 100–500 Hz | — | the attack transient or click |

These are typical regions, not fixed points; find the real ones on the sound itself.

## Kick

- **Fit the kick to the bass.** Decide which one owns the sub. A long, subby kick wants a bass that is higher or that leaves gaps; a short, punchy kick leaves room for a deep bass. The low-end mixing sub-skill covers the full relationship.
- **Tune it.** A kick with a clear pitch should sit on the song's root or fifth (or another chord tone); an out-of-key kick fights the bass. Find its fundamental and transpose in Simpler.
- **Set its length to the tempo and the bass.** Shorten the decay or fade the tail in Simpler until the kick ends before the next bass note or kick.
- **Layer by job.** A top layer for the click (high-passed around 100–200 Hz) over a body or sub layer (low-passed if it has a messy top). Align the transients so they hit together, then check polarity: flip one layer and keep the setting with more low end.
- **Synthesise one when nothing fits.** In Operator: one sine; a pitch envelope sweeping from about 150–250 Hz down to the fundamental (40–60 Hz) over roughly 30–80 ms; amp decay 200–600 ms. Add a click with a very short noise burst (5–15 ms) or a short high sine. Drum Buss's Boom adds a tuned low tail that can be locked to a note.

## Snare and clap

- **Body, crack, tail.** Body around 150–250 Hz gives weight, crack around 1–5 kHz gives snap, the tail (noise, rattle, room) gives length. Layering usually means one sample for each missing part.
- **Claps are several hits.** A clap sounds natural when it has a few short hits spread over about 10–30 ms, then a tail. Stacking claps with slight timing offsets, or adding a short room, makes a thin clap fuller.
- **Synthesise a snare** with a tone (sine or triangle around 150–250 Hz with a quick pitch drop) and noise (decay 100–250 ms, high-passed around 1 kHz). Balance tone and noise for a tighter or a noisier snare.
- **Tune the body** to sit with the key, especially in sparse arrangements where the snare is exposed.
- **Use the room deliberately.** A short room (0.3–1 s decay, little pre-delay) on a return chain makes the snare part of a space; gate or shorten the tail if it blurs fast patterns.

## Hi-hats, cymbals and percussion

- **Velocity variation matters more than the sample.** Even a great hat sounds mechanical at a constant velocity; map velocity to level and a little to brightness or decay.
- **Choke groups.** Put open and closed hats in the same Drum Rack choke group so a closed hat cuts an open one, as on a real kit.
- **Length is groove.** Shorter hats sound tighter and faster; longer hats sound looser and busier. Adjust decay before changing the pattern.
- **High-pass** hats and cymbals at around 200–500 Hz; their low content is mostly noise that muddies the kick and snare.
- **Synthesise hats** from noise, or from Operator with high, non-integer ratios for a metallic tone, high-passed around 6–8 kHz; closed decay 20–80 ms, open 200–600 ms.
- **Percussion** (shakers, tambourines, rims, congas, bongos) adds movement. Pan it off-centre, vary velocity and timing slightly, and tune pitched percussion to the key.

## 808s

- **An 808 is a bass part.** Tune it to the notes it plays, check its fundamental and transpose the sample so its root matches.
- **Glide.** In Simpler, Classic mode with one voice and glide on, overlapping notes slide; set glide time by ear (often 50–150 ms).
- **Length.** Set the decay or note lengths so each 808 ends before the next; long tails on fast patterns turn into a drone.
- **Small speakers.** Saturation (Saturator, Roar, Drum Buss) adds harmonics so the line is heard where the sub isn't reproduced. Parallel saturation keeps the clean sub intact.
- **Kick and 808 together.** If both carry sub at the same moment, they cancel or pile up. Choose a kick with little sub, shorten the kick, offset the 808 slightly, or duck the 808 under the kick (see the low-end mixing sub-skill).

## Building a Drum Rack kit

1. **Lay out pads consistently** (kick, snare, clap, hats, percussion, effects) so patterns stay readable and kits can be swapped.
2. **Trim every sample.** Start on the transient, fade the tail if it has noise, remove silence.
3. **Level-match in the rack.** Set chain volumes so the kit is balanced before any processing; keep peaks well below clipping so the drum bus has headroom.
4. **Set choke groups** for hats and any sounds that should cut each other.
5. **Process per pad where needed** (EQ, transient shaping, saturation), and put shared processing on return chains inside the rack (a room, a drive).
6. **Add a few macros** the musician can ride: kit tune, decay, drive, room.

## Processing drums

- **Transient shaping.** Drum Buss's Transients control sharpens or softens attacks. A Compressor with a slower attack (10–30 ms) lets the hit through and then turns down the body, which reads as more punch; a fast attack softens the hit.
- **Saturation.** Drum Buss Drive and Crunch, Saturator or Roar add density and help drums cut at lower levels. Saturate the drum bus lightly rather than every pad heavily.
- **Damp harshness.** Drum Buss's Damp or a low-pass on bright hits takes the edge off without dulling the whole kit.
- **Gate long tails** with Gate when a room or a long sample blurs a fast pattern.
- **Parallel and bus compression** are mixing moves; see the mixing skill.

## Drum loops and breaks

- **Slice** a loop into a Drum Rack (one slice per pad) or Simpler's Slicing mode, so the musician can replay, rearrange and swap hits.
- **Warp** drum loops in Beats mode; tune the transient preservation to the loop's subdivision.
- **Layer a loop under programmed drums** for texture: high-pass it around 200–400 Hz so it adds top-end movement without fighting the kick and snare.

## Drums isolated from recordings

- Separated drums often carry bleed: bass in the kick, vocal or guitar in the snare and cymbals. EQ out what's outside each drum's range, gate between hits, and reinforce weak transients with a clean layer.
- Slice the separated drums into a Drum Rack to reuse individual hits.
- Only clear for release if the musician owns the source recording or has cleared it; note the source either way.

## Generated one-shots

Describe the hit precisely: drum type, length, pitch, attack, character and space. For example, "short dry kick, around 300 ms, tuned near F, tight click, no reverb". Ask for variations, then trim, tune and level-match them like any sample. Use generated sounds only from services whose terms allow commercial use and leave the musician the rights, and note where each one came from.

## Checks

- Kit balanced at the same velocity; nothing jumps out or disappears.
- Kick and 808 or bass not fighting for the sub; kick tuned and its length suits the bass.
- Transients survive in the mix, at low volume and on small speakers.
- Mono: kick, snare and 808 centred; stereo percussion doesn't vanish when summed.
- No clicks at sample starts; tails don't blur the groove.
- Locked drum parts untouched; sources of samples and generated hits noted.

## Worked example

"My kick has no punch on my laptop." The kick's energy is almost all around 45 Hz, which laptop speakers can't reproduce. Fixes to try one at a time, stopping when it works: add a top layer from another kick, high-passed around 150 Hz, aligned and polarity-checked; or add Drum Buss with a little Crunch and Transients to bring out the attack; or a 2–3 dB lift around 3–4 kHz for the beater. After each change, play it with the bass, check masking between kick and bass, and listen on the laptop again. Report what changed and what to listen for: "the click now carries the beat on small speakers; the sub is unchanged."
