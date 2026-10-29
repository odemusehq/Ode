---
name: sound-design-drums
description: Shape drum sounds in place in Live — choose, swap, layer, tune, trim and process the kick, snare, clap, hats, percussion and 808 in the Drum Rack or Simpler already on the track, build a Drum Rack kit from samples, slice a loop onto pads, and clean drums isolated from recordings or generated one-shots — with the checks drums need (kit balance, kick against bass, tuning, clean starts). Read this after the sound-design skill whenever the job is how the drums sound (punch, weight, tone, length, tuning, a coherent kit); how they play belongs to the drums skill.
---

# Drum sound design

This file covers how the drums sound: punch, weight, tone, length and tuning. How they play (grooves, fills, velocity patterns) belongs to the drums skill, and their final balance to mixing. The loop, the checks and the one-line result are in the parent sound-design skill.

Work on the kit that is already there: change a pad's sample, its Simpler settings and the devices in its chain; swap a sample in its pad, keeping one kit on one drum track.

## Choosing drum sounds

- **Judge in the groove**, with the bass and the music playing. A kick that sounds huge alone may be too long for a busy bassline; a snare that sounds thin alone may be exactly what cuts through a dense chorus.
- **Choose for length as well as tone.** Short, tight hits leave space and feel fast; long, boomy hits fill space and suit sparse arrangements and slower tempos.
- **Keep the kit coherent.** Samples from very different sources (dry and close, roomy and old, bright and modern) sound pasted together. Choose them to match, or give the whole kit a shared room or saturation so it reads as one kit. Contrast is fine when it is a decision.
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

These are typical regions; find the real ones on the sound itself.

## Kick

- **Fit the kick to the bass.** Decide which one owns the sub. A long, subby kick wants a bass that sits higher or leaves gaps; a short, punchy kick leaves room for a deep bass. The low-end mixing sub-skill covers the full relationship.
- **Tune it.** A kick with a clear pitch sits on the song's root or fifth (or another chord tone); an out-of-key kick fights the bass. Find its fundamental (the strongest low band in its spectrum) and transpose it in its Simpler.
- **Set its length to the tempo and the bass.** Shorten the decay or fade the tail in its Simpler until the kick ends before the next bass note or kick.
- **Layer by job, inside its pad's chain.** A top layer for the click (high-passed around 100–200 Hz) over a body or sub layer (low-passed if its top is messy). Align the transients so they hit together, then check polarity: flip one layer and keep the setting with more low end.
- **Synthesise one when every sample falls short.** In Operator: one sine; a pitch envelope sweeping from about 150–250 Hz down to the fundamental (40–60 Hz) over roughly 30–80 ms; amp decay 200–600 ms; a click from a very short noise burst (5–15 ms) or a short high sine. Drum Buss's Boom adds a tuned low tail that can be set to a note.

## Snare and clap

- **Body, crack, tail.** Body around 150–250 Hz gives weight, crack around 1–5 kHz gives snap, the tail (noise, rattle, room) gives length. Layering usually means one sample for each missing part.
- **Claps are several hits.** A clap sounds natural with a few short hits spread over about 10–30 ms, then a tail. Stacking claps with slight timing offsets, or adding a short room, fills out a thin clap.
- **Synthesise a snare** from a tone (sine or triangle around 150–250 Hz with a quick pitch drop) and noise (decay 100–250 ms, high-passed around 1 kHz). The balance of tone and noise makes it tighter or noisier.
- **Tune the body** to sit with the key, especially in sparse arrangements where the snare is exposed.
- **Use the room deliberately.** A short room (0.3–1 s decay, little pre-delay) on a return chain inside the rack puts the snare in a space; shorten the tail if it blurs fast patterns.

## Hi-hats, cymbals and percussion

- **Velocity matters more than the sample.** Even a great hat sounds mechanical at one velocity: map velocity to level and a little to brightness or decay.
- **Choke groups.** Open and closed hats in the same choke group, so a closed hat cuts an open one as on a real kit.
- **Length is groove.** Shorter hats sound tighter and faster, longer hats looser and busier; adjust the decay before touching the pattern.
- **High-pass** hats and cymbals around 200–500 Hz; their low content is mostly noise that muddies the kick and snare.
- **Synthesise hats** from noise, or from Operator with high, non-integer ratios for a metallic tone, high-passed around 6–8 kHz; closed decay 20–80 ms, open 200–600 ms.
- **Percussion** (shakers, tambourines, rims, congas) adds movement: pan it off-centre and tune pitched percussion to the key.

## 808s

- **An 808 is a bass part.** Tune it to the notes it plays: find its fundamental and transpose the sample so its root matches.
- **Glide.** In Simpler, Classic mode with one voice and glide on, overlapping notes slide; glide time often 50–150 ms.
- **Length.** Each 808 ends before the next; long tails on fast patterns turn into a drone.
- **Small speakers.** Saturation (Saturator, Roar, Drum Buss) adds harmonics so the line is heard on speakers that lose the sub; parallel saturation keeps the clean sub intact.
- **Kick and 808 together.** If both carry sub at the same moment they cancel or pile up: choose a kick with little sub, shorten the kick, or duck the 808 under the kick (low-end mixing sub-skill).

## Building a Drum Rack kit

On the drum track's own Drum Rack:
1. **Lay out pads consistently** (kick, snare, clap, hats, percussion, effects) so patterns stay readable and kits can be swapped.
2. **Trim every sample:** start on the transient, fade a noisy tail, remove silence.
3. **Level-match in the rack:** chain volumes so the kit is balanced before any processing, peaks well short of clipping.
4. **Choke groups** for hats and any sounds that should cut each other.
5. **Process per pad where needed** (EQ, transient shaping, saturation), with shared processing on return chains inside the rack (a room, a drive).
6. **A few macros** the musician can ride: kit tune, decay, drive, room.

## Processing drums

- **Transient shaping.** Drum Buss's Transients sharpens or softens attacks. A Compressor with a slower attack (10–30 ms) lets the hit through and then turns down the body, which reads as more punch; a fast attack softens the hit.
- **Saturation.** Drum Buss Drive and Crunch, Saturator or Roar add density and help drums cut at lower levels; light saturation on the whole kit beats heavy saturation on every pad.
- **Damp harshness.** Drum Buss's Damp or a low-pass on bright hits takes the edge off without dulling the whole kit.
- **Gate long tails** when a room or a long sample blurs a fast pattern.
- Parallel and bus compression are mixing moves (mixing skill).

## Drum loops and breaks

- **Slice** a loop onto Drum Rack pads (one slice per pad) or into Simpler's Slicing mode, so its hits can be replayed, rearranged and swapped.
- **Warp** drum loops in Beats mode, with transient preservation matching the loop's subdivision.
- **Layer a loop under programmed drums** for texture: high-pass it around 200–400 Hz so it adds top-end movement without fighting the kick and snare.

## Drums isolated from recordings

- Separated drums often carry bleed (bass in the kick, vocal or guitar in the snare and cymbals): EQ out what is outside each drum's range, gate between hits, and reinforce weak transients with a clean layer.
- Slice the separated drums onto pads to reuse single hits.
- They are cleared for release only when the musician owns the source recording or has cleared it; write the source in the lead sheet's notes either way.

## Generated one-shots

Describe the hit precisely: drum type, length, pitch, attack, character and space — for example "short dry kick, around 300 ms, tuned near F, tight click, fully dry". Trim, tune and level-match the result like any sample, keep it on its pad, and write its description in the lead sheet's notes. Use generated sounds only from services whose terms allow commercial use and leave the musician the rights.

## Drum checks

These add to the parent skill's checks.

| Check | Correct when |
|---|---|
| Kit balance | At the same velocity every hit sits level with the others, and the pad chains' volumes leave headroom on the drum track |
| Kick and bass | Only one of them carries sub at any moment: the kick ends before the next bass note, or one of them gives way |
| Tuning | A pitched kick, tom or 808 sits on the key (root, fifth or another chord tone); an 808 follows the notes it plays |
| Clean starts | Every sample starts on its transient, and tails leave the groove clear |
| Mono | Kick, snare and 808 centred; stereo percussion stays audible when summed |

## Example

The musician selects the Drums track and types "kick needs more punch on my laptop". The kick's energy sits almost entirely near 45 Hz, too low for laptop speakers. In the kick's pad chain: Drum Buss after its Simpler with a little Crunch and Transients, and a 2 dB lift around 3.5 kHz for the beater. Check the level, the kick against the bass and the gain staging. Result: "Kick punchier on small speakers: Drum Buss Transients up, +2 dB at 3.5 kHz · sub unchanged, ends before the bass notes, Drum Buss output matched." Again takes another route: a top layer from a clickier kick, high-passed at 150 Hz, aligned and polarity-checked.
