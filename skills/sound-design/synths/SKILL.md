---
name: sound-design-synths
description: Recipes for turning the synth on the selected track into a specific sound, in place — sub, synth, reese, acid and wobble basses, plucks, FM keys, organs, bells, pads, supersaws, brass-like stabs, arps, leads, risers, impacts and drones — in Drift, Wavetable, Operator, Meld or the musician's synth plug-ins, with the checks each one needs. Read this after the sound-design skill whenever a synth part has to become a particular kind of sound or a synth patch is being reshaped.
---

# Synth sound recipes

The loop, the checks and the one-line result are in the parent sound-design skill; this file holds what is specific to synths. Each recipe is a starting point: set it on the instrument already on the track, or insert the Live instrument it names on that track, then move the values while checking the part in its section. The same recipes translate to any subtractive, wavetable or FM plug-in the musician already added, and a preset of their own, loaded by them, is often the closest start.

## Read the part first

- **Register.** Find the lowest and highest notes. A bass whose notes sit around E1–E2 (41–82 Hz) needs a different patch from one an octave higher.
- **Rhythm.** Note lengths and tempo set the envelope times: a sixteenth note lasts 15 000 ÷ BPM milliseconds (about 117 ms at 128 BPM), so a 400 ms decay smears a sixteenth-note pluck.
- **Who else plays.** If a separate sub bass exists, a synth bass adds no more sub; if the vocal sings in the lead's octave, the lead moves an octave, thins out or answers the vocal in its gaps.

## Basses

**Sub bass.** Pure low end, felt more than heard.
- Sine (or triangle for a touch of upper harmonics) in Operator or Drift; Mono; no filter needed.
- Amp attack 1–5 ms (a 0 ms attack can click), sustain full, release 20–80 ms so notes don't overlap.
- Keep the fundamentals mostly between about 30 and 80 Hz; below 30 Hz few systems reproduce it and it eats headroom.
- For small speakers, add harmonics without touching the low end: parallel saturation, or a mid layer (below).

**Synth bass (plucky or sustained).**
- Saw or square; Mono; 24 dB low-pass with the cutoff at 300–800 Hz and moderate resonance.
- Filter envelope: attack 0 ms, decay 100–300 ms, sustain low to medium, moderate amount; each note gets a bright start.
- Velocity to the filter envelope amount, so accented notes speak more.
- Glide 30–80 ms on overlapping notes only, so slides happen where the notes overlap.

**Two-layer bass for every system.** In an Instrument Rack: a mono sine sub layer, and a saturated saw or square mid layer high-passed at about 100–150 Hz, both playing the same notes. The sub carries the weight on large systems; the mid layer carries the line on phones and laptops. A macro balances them.

**Reese bass.** Two saws detuned 10–30 cents (or Wavetable's Classic unison at a low amount), Mono, low-pass around 400–1200 Hz, slow LFO movement on detune, position or cutoff. Detuned saws beat against each other and can cancel in the low end, especially in mono, so a clean sine sub goes under it and the reese is high-passed around 100–150 Hz.

**Acid-style bass.** One saw or square, Mono, 24 dB low-pass with high resonance (60–80%) and a low cutoff; a short filter-envelope decay (100–250 ms); velocity raising the envelope amount for accents; glide on overlapping notes (50–100 ms). Distortion after the filter makes the resonance bite.

**Wobble or growl bass.** An LFO synced to the tempo on cutoff (and on wavetable position or FM amount in Wavetable). Changing the LFO rate between 1/4, 1/8, 1/8 triplet and 1/16 across a phrase gives rhythm; a band-pass or morph filter sounds more vocal than a plain low-pass. A clean sub layer underneath keeps the low end steady while the harmonics move.

## Plucks, keys and mallets

**Pluck.** Amp attack 0 ms, decay 150–400 ms, sustain 0, release close to the decay; a filter envelope with a slightly shorter decay opening a low cutoff. A synced delay (dotted eighth or sixteenth) turns a simple pluck into a rhythm part. In fast parts, shorten the decay rather than turning the pluck down.

**FM electric piano.** In Operator: a sine carrier and a modulator at ratio 1 with a decaying envelope (decay 0.5–1.5 s, low sustain) and velocity to modulator level; for the bell-like attack, a quiet modulator at a high ratio (around 14) with a very short envelope. Light Chorus-Ensemble or Phaser-Flanger adds the familiar movement. Electric is the modelled alternative.

**Organ.** Operator with all four oscillators as carriers (the additive algorithm), sines at ratios matching organ drawbars: 0.5 (sub-octave), 1 (fundamental), 2 (octave), 3 (octave and a fifth), 4 (two octaves). Mix their levels like drawbars; fast or slow chorus or vibrato gives a rotating-speaker feel.

**Bells and mallets.** Operator with a non-integer modulator ratio (3.5 or 1.41, for example) for inharmonic partials, a fast attack, a long decay (2–6 s) and no sustain; or Collision for modelled mallets. Bells are bright and long, so they need space in time: few notes, and a high-pass around 200–400 Hz in dense mixes.

## Pads and chords

**Warm pad.** Drift or Wavetable; saws detuned a few cents, or a softer waveform; low-pass at 1–4 kHz with low resonance; attack 200 ms to 1 s, release 1–3 s; a slow LFO on cutoff or position (0.05–0.3 Hz) for gentle movement; Chorus-Ensemble for width.

**Pads in a busy mix.** High-pass at 150–300 Hz, keep the patch above the bass and away from the vocal's main octave, and set it lower than feels natural in solo. A pad usually fills gaps rather than being heard as a part.

**Supersaw chords.** Wavetable with Classic unison (6–8 voices, amount 25–50%), cutoff 4–10 kHz, a short attack, release 200–600 ms. Very wide unison can thin out or flange in mono; a less detuned centre layer, or a lower unison amount, keeps it solid. In dance music, ducking from the kick gives it room (mixing skill).

**Brass-like stab.** Saws with a filter-envelope attack of 20–60 ms so the tone swells into each note, a small pitch envelope rising into pitch, light unison. Short and punchy for stabs; a longer attack for swells.

**Arpeggios.** Live's Arpeggiator in front of a pluck or a short keys sound: rate 1/16 or 1/8, gate 50–80%, a style that suits the chord movement. Velocity or a slow LFO on cutoff keeps a long arpeggio from sounding mechanical.

## Leads

- Mono with glide (20–60 ms) for singing lines; Poly for chordal leads.
- Vibrato from an LFO on pitch (4–6 Hz, small depth), delayed or on the mod wheel so it appears on held notes only.
- A lead cuts through with energy around 1–5 kHz — a brighter waveform, saturation or resonance — rather than more level.
- If it plays in the vocal's octave at the same time, move the patch an octave with the oscillators' octave controls or thin it; trading phrases with the vocal is an arrangement move.

## Risers, impacts and transitions

- **Noise riser.** White noise through a band-pass or high-pass filter sweeping up over 4–16 bars, its level rising and a reverb or delay tail growing. A pitched layer (a saw, or the song's root rising in pitch) makes it musical.
- **Downlifter.** The reverse movement: noise or a tone falling in pitch and filter after a section's peak, often after an impact.
- **Impact.** A low sine with a fast pitch drop (as for a kick, but longer), a noise burst and a long dark reverb, placed on the downbeat of the new section.
- **Reverse sweeps.** A reversed cymbal or reverb tail that ends exactly on the downbeat.
- **Build the movement into the sound**, so it needs no automation: a riser sample generated or trimmed to the build's length, or one long note on a synth whose amp and filter envelopes rise over the whole build. Where it goes in the song belongs to the arrangement skill.

## Drones and textures

- Meld, or Wavetable with slow modulation on position and filter; long envelopes; layered noise for air.
- Keep drones in key: a root or fifth drone supports most chords; a drone on a note outside the chords creates tension, which can be the point.
- Generated or sampled textures can be stretched, reversed or re-pitched in Simpler into sounds nothing else in the song makes.

## Synth checks

These add to the parent skill's checks.

| Check | Correct when |
|---|---|
| Level jumps | After resonance, unison or envelope changes, the part's level is matched to before; these moves can shift it by several dB |
| Mono | Unison, detune, chorus and stereo voice modes sum to mono without collapsing or turning hollow; basses stay centred |
| Tuning | Detuned layers drift from concert pitch on average: basses and drones still sit on the key |
| Harshness | Very bright waveforms and heavy FM on high notes don't turn brittle; use the instrument's high-quality mode or soften the source |
| Expression | Velocity, the mod wheel or macros named in plain words (Brightness, Movement, Width, Dirt) still let the musician play and ride the sound |

Many unison voices and long releases add up on the CPU: use as few voices as give the size.

## Example

The musician selects the Lead track — an instrumental hook at 110 BPM in G minor with no instrument yet; their songs mostly use soft, clean synths — and clicks "Make a lead". Insert Drift on the track: triangle oscillator, filter around 2.5 kHz, Mono with 40 ms glide, delayed vibrato, then Echo after it at a dotted eighth with low feedback. Check the level, the register against the vocal (the hook plays where the vocal rests) and mono. Result: "Lead on Drift: triangle, filter 2.5 kHz, 40 ms glide, dotted-eighth echo · level set, clear of the vocal's phrases, mono-compatible." Again tries a clearly different take — a Wavetable saw with light unison and a ping-pong delay — and a third take might put a square wave through Roar into a moving band-pass, with "rougher than your usual leads" in its result line.
