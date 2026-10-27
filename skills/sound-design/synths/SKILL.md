---
name: sound-design-synths
description: Recipes and techniques for building specific synth sounds in Live's instruments (Drift, Wavetable, Operator, Meld) or the musician's synth plug-ins — sub, synth, reese and acid-style basses, plucks, pads, supersaws, leads, FM keys, organs, bells, brass-like stabs, arps, risers, impacts and drones. Read this when a synth sound has to be created or reshaped for a part, after the general sound-design skill.
---

# Synth sound recipes

This sub-skill holds what is specific to programming synths. The general way of working (understand the part, small reviewable changes, check in context, rights and sources) is in the parent sound-design skill.

Every recipe below is a starting point: set it up, play it in the section where it will live, then move the values while listening. Prefer the musician's own synths and presets when they have something close; the same recipes translate to any subtractive, wavetable or FM synth.

## Before you program

- **Know the register.** Find the lowest and highest notes the part plays. A bass whose notes sit around E1–E2 (41–82 Hz) needs a different patch from one playing an octave higher.
- **Know the rhythm.** Note lengths and tempo decide envelope times: a pluck in 1/16 notes at 128 BPM has about 117 ms per note, so a 400 ms decay will smear.
- **Know who else plays.** If a separate sub bass exists, a synth bass shouldn't add more sub; if the vocal sits in the same octave as a lead, the lead needs to alternate with it or move.

## Basses

**Sub bass.** Pure low end, felt more than heard.
- Sine (or triangle for a touch of upper harmonics) in Operator or Drift; Mono mode; no filter needed.
- Amp attack 1–5 ms (a 0 ms attack can click), sustain full, release 20–80 ms so notes don't overlap.
- Keep the fundamentals mostly between about 30 and 80 Hz; below 30 Hz few systems reproduce it and it eats headroom.
- For small speakers, add harmonics without changing the low end: parallel saturation, or a separate mid layer (below).

**Synth bass (plucky or sustained).**
- Saw or square; Mono; low-pass 24 dB with cutoff 300–800 Hz and moderate resonance.
- Filter envelope: attack 0 ms, decay 100–300 ms, sustain low to medium, amount moderate; this gives each note a bright start.
- Velocity to filter-envelope amount so accented notes speak more.
- Glide 30–80 ms on overlapping (legato) notes only, so slides happen where the musician plays them.

**Two-layer bass for every system.** In an Instrument Rack: a sine sub layer, mono, and a mid layer (saw or square, saturated) high-passed at about 100–150 Hz. Both play the same notes. The sub carries weight on large systems; the mid layer carries the line on phones and laptops. Balance them with a macro.

**Reese bass.** Two saws detuned 10–30 cents (or Wavetable's Classic unison with a low amount), Mono, low-pass around 400–1200 Hz, slow LFO movement on detune, position or cutoff. Detuned saws beat against each other and can cancel in the low end, especially in mono, so put a clean sine sub under it and high-pass the reese around 100–150 Hz.

**Acid-style bass.** One saw or square, Mono, 24 dB low-pass with high resonance (60–80%) and a low cutoff; short filter-envelope decay (100–250 ms); velocity raising the envelope amount for accents; glide on overlapping notes (50–100 ms). Distortion after the filter makes the resonance bite. Move cutoff and resonance over the song for development.

**Wobble or growl bass.** An LFO synced to the tempo on cutoff (and wavetable position or FM amount in Wavetable). Change the LFO rate between 1/4, 1/8, 1/8 triplet and 1/16 across a phrase for rhythm; a band-pass or morph filter sounds more vocal than a plain low-pass. Keep a clean sub layer underneath so the low end stays steady while the harmonics move.

## Plucks, keys and mallets

**Pluck.** Amp attack 0 ms, decay 150–400 ms, sustain 0, release similar to the decay; a filter envelope with a slightly shorter decay opening a low cutoff. A synced delay (1/8 dotted or 1/16) turns a simple pluck into a rhythm part. In fast parts, shorten the decay rather than turning the pluck down.

**FM electric piano.** In Operator: carrier sine, modulator at ratio 1 with a decaying envelope (decay 0.5–1.5 s, low sustain) and velocity to modulator level; for the bell-like attack, a quiet modulator at a high ratio (around 14) with a very short envelope. Light Chorus-Ensemble or Phaser-Flanger adds the familiar movement. Live's Electric is the modelled alternative.

**Organ.** In Operator with all four oscillators as carriers (the additive algorithm), sines at ratios matching organ drawbars: 0.5 (sub-octave), 1 (fundamental), 2 (octave), 3 (octave and a fifth), 4 (two octaves). Mix the levels like drawbars; add fast or slow chorus or vibrato for a rotating-speaker feel.

**Bells and mallets.** Operator with a non-integer modulator ratio (e.g. 3.5 or 1.41) for inharmonic partials, fast attack, long decay (2–6 s), no sustain; or Collision for physically modelled mallets. Bells are bright and long, so give them space in time: few notes, and a high-pass around 200–400 Hz in dense mixes.

## Pads and chords

**Warm pad.** Drift or Wavetable; saws detuned a few cents or a softer waveform; low-pass 1–4 kHz with low resonance; attack 200 ms–1 s, release 1–3 s; slow LFO on cutoff or position (0.05–0.3 Hz) for gentle movement; Chorus-Ensemble for width.

**Pads in a busy mix.** High-pass at 150–300 Hz, voice the chord above the bass and away from the vocal's main octave, and keep the pad lower in level than feels natural in solo. A pad's job is usually to fill gaps, not to be heard as a part.

**Supersaw chords.** Wavetable with Classic unison (6–8 voices, amount 25–50%), cutoff 4–10 kHz, short attack, release 200–600 ms. Very wide unison can thin out or flange in mono; a less detuned centre layer, or a slightly lower unison amount, keeps it solid. In dance music, sidechain ducking from the kick gives it room (see the mixing skill).

**Brass-like stab.** Saws with a filter envelope attack of 20–60 ms so the tone swells into each note, a small pitch envelope rising into pitch, light unison. Short and punchy for stabs; longer attack for swells.

**Arpeggios.** Live's Arpeggiator in front of a pluck or short keys sound: rate 1/16 or 1/8, gate 50–80%, and a style that suits the chord movement. Velocity or a slow LFO on cutoff keeps a long arpeggio from sounding mechanical.

## Leads

- Mono with glide (20–60 ms) for singing lines; Poly for chordal leads.
- Vibrato from an LFO on pitch (4–6 Hz, small depth), brought in with the mod wheel or delayed so it appears on held notes only.
- A lead must cut: energy around 1–5 kHz, from a brighter waveform, saturation or resonance, rather than more level.
- Leave room for the vocal. If lead and vocal play at the same time in the same octave, suggest moving one of them, trading phrases (call and response) or thinning the lead.

## Risers, impacts and transitions

- **Noise riser.** White noise through a band-pass or high-pass filter sweeping up over 4–16 bars, with level rising and a reverb or delay tail that grows. A pitched layer (a saw or the song's root note rising in pitch) makes it musical.
- **Downlifter.** The reverse movement: noise or a tone falling in pitch and filter after a section's peak, often after an impact.
- **Impact.** A low sine with a fast pitch drop (as for a kick, but longer), a noise burst, and a long dark reverb; place it on the downbeat of the new section.
- **Reverse sweeps** come from resampling: print a reverb or a cymbal, reverse it, end it exactly on the downbeat.
- Long movements usually need automation; if you can't write it, give the musician the start and end bars and values. More on placing them in the arrangement skill.

## Drones and textures

- Meld, or Wavetable with slow modulation on position and filter; long envelopes; layered noise for air.
- Keep drones in key: a root or fifth drone supports most chords; a drone on a note outside the chords creates tension, which can be the point.
- Resample to audio, then stretch, reverse or re-pitch for textures nothing else in the song sounds like.

## Synth-specific checks

- **Mono compatibility:** unison, detune, chorus and stereo modes widen a sound; sum to mono and make sure it doesn't collapse or thin out badly. Keep basses and kicks centred.
- **Tuning:** detuned layers can drift away from concert pitch on average; check the patch against the key, especially basses.
- **Level jumps:** resonance, unison and envelope changes can jump the level by several dB; compare at matched level.
- **Aliasing and harshness:** very bright waveforms and heavy FM on high notes can sound brittle or produce tones that don't belong; use the instrument's high-quality or oversampling option where it has one, or soften the source.
- **CPU:** many unison voices and long releases add up; resample or freeze when the musician is happy with a part.
- **Expression:** map velocity, mod wheel or macros so the musician can still play and ride the sound; name macros in plain words (Brightness, Movement, Width, Dirt).

## Worked example: three lead options

A musician asks for a lead for an instrumental hook at 110 BPM in G minor; their past songs mostly use soft, clean synths.

1. **Clean and vocal.** Drift, triangle oscillator with the filter around 2–3 kHz, Mono with 40 ms glide, delayed vibrato, a 1/8 dotted delay at low feedback. Sings like a voice; fits their usual sound.
2. **Bright and wide.** Wavetable saw with light Classic unison, cutoff 5–8 kHz, a touch of Saturator, Ping Pong delay. Bigger and more forward; good if the hook must carry the chorus.
3. **Outside your usual style:** a gritty band-pass lead. Square wave through Roar (Tube Preamp, moderate amount) into an Auto Filter band-pass moving with an envelope follower. Rougher and more aggressive than their usual sound.

Build the chosen one first, play it in the hook, then adjust one stage at a time.
