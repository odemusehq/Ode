---
name: sound-design
description: Choose and shape sounds in Ableton Live so each part does its job in the song — picking the instrument, preset or sample for a part, programming synths (oscillators, filters, envelopes, modulation), layering, sampling and resampling, creative effects, sounds isolated from recordings or generated from a description, and shaping a sound so it sits in the mix. Use this whenever the musician asks for a sound, patch, preset, tone or texture, describes a sound in words ("warmer", "wider", "less harsh", "more punch", "dusty", "glassy"), wants to sample, chop, flip or resample something, wants a sound pulled out of a recording or generated, or wants a third-party plug-in tweaked, even if they never say "sound design".
---

# Sound design

Sound design here means choosing and shaping sounds so every part does its job in this song: the bass holds the floor, the lead speaks over everything, the pad fills without crowding, the texture adds life without asking for attention. A great sound in solo can be the wrong sound in the track, so judge every choice in context.

The musician is the author. Suggest a direction, make small changes they can hear and undo, explain each one in a sentence, and let them decide. Leave locked parts alone: if a locked part is the problem, say so and offer a fix elsewhere, or ask whether they want to unlock it.

## How to work

1. **Understand the part before touching a knob.** What role does it play (foundation, rhythm, harmony, lead, counter-melody, texture, ear candy)? Which register does it live in? Which section is it for, and how much energy should that section have? What does it share space with? A pad for a sparse verse and a pad for a dense chorus are different sounds.
2. **Look at what is already there.** The track's instrument and effects, what plays at the same time, key and tempo, locked parts, and the musician's own instruments, plug-ins, presets and samples. Use what you know about their preferences (sounds and plug-ins they like, things they dislike). Start from their tools: a sound built in a plug-in they know is easier for them to keep shaping.
3. **Start close, then shape.** A preset or sample near the target, adjusted with intent, is usually faster and better than building from scratch. Build from an initialised patch when the sound is simple (a sub bass, a sine pluck) or when nothing close exists.
4. **Change one stage at a time.** Source (oscillator or sample), then filter, then envelopes, then modulation, then effects. After each change, listen in the track. Keep the original recoverable: duplicate the track or device first, or keep the new device bypassable, so the musician can compare.
5. **Check in context.** Play the section with everything else. Check masking with the parts that share the range, the level against the rest, the sound in mono, and at low volume (the "Checks" section below).
6. **Report briefly.** Say what changed with values and why, what to listen for, and one possible next step. Example: "Opened the filter from 900 Hz to 2.4 kHz and shortened the decay from 600 to 250 ms, so the pluck cuts through the pads and leaves room between notes. Listen to the chorus against the vocal."

**When offering options**, give three distinct directions, each with a one-line description of how it changes the song. Label one clearly as outside the artist's usual style, judged only from their own songs and stated preferences, never from their name, gender, age, nationality or genre clichés.

**When the musician says "like [artist]" or "like [song]",** turn it into general qualities you can name and build: bright or dark, short or sustained, clean or distorted, dry or roomy, mono and centred or very wide, simple or evolving. Build those qualities; don't try to recreate another artist's signature sound or a specific record's patch.

## Turning words into parameters

Musicians describe sounds with adjectives. These are the usual moves; combine them and listen.

| Word | Usual moves |
|---|---|
| Warmer | Lower the low-pass cutoff or gently cut 3–8 kHz; softer waveform (triangle, or saw with the filter closed down); gentle saturation that adds low-order harmonics; a little detune |
| Brighter, more cut | Open the filter; richer waveform (saw, FM, sync); saturation; a broad 2–5 kHz lift; a faster attack |
| Darker | Lower cutoff, less resonance, a high shelf cut; fewer upper harmonics at the source |
| Thinner, less boomy | High-pass; cut 150–400 Hz; drop the sub oscillator or the low layer |
| Fatter, thicker | Unison and detune; a sub oscillator or low layer (only if the bass isn't already there); saturation; layering |
| Punchier | Faster attack, shorter decay, lower sustain; transient emphasis; less reverb on the attack |
| Softer, rounder | Slower attack (5–50 ms); less velocity-to-brightness; less resonance; a sine or triangle source |
| Wider | Unison spread, chorus, stereo delay or reverb; keep the low end mono and check mono compatibility |
| Airy | High shelf at 10–12 kHz; a quiet noise layer; a bright, diffuse reverb |
| Gritty, dirty, dusty | Saturation or distortion; bit or sample-rate reduction; vinyl or tape-style noise; band-limit the sound |
| Hollow | Square or pulse waves (odd harmonics); band-pass or notch filtering; comb filtering |
| Metallic, glassy, bell-like | FM with non-integer ratios; resonators; high resonance; long decay with fast attack |
| Moving, wobbly | An LFO on cutoff, pitch, pan or wavetable position, usually synced to the tempo |
| Evolving | Slow LFOs or long envelopes on wavetable position, filter or effect mix; layers that crossfade |
| Closer, drier | Less reverb and delay, shorter decay, more transient and midrange |
| Further away | More reverb relative to dry, fewer highs, softer transient, lower level |

## Choosing the instrument for the part

| Need | Good starting points in Live | Why |
|---|---|---|
| Warm analog-style bass, pad, lead, pluck | Drift | Simple, quick to shape, light on CPU, natural pitch and timbre variation |
| Modern, evolving, wide or aggressive synths (supersaw, reese, growl) | Wavetable | Wavetable position, unison modes, two filters and deep modulation |
| Electric pianos, bells, metallic or punchy basses, synthetic drums | Operator | Four-operator FM plus filter; FM gives bright, precise harmonics |
| Textures, unusual tones, expressive MPE parts, scale-aware layers | Meld | Two engines with characterful oscillators and filters, easy to layer or split |
| One sample played across keys, chopped loops, one-shots | Simpler | Fast to load, three modes (Classic, One-Shot, Slicing), warping |
| Multisampled instruments, velocity layers, round robin | Sampler | Zones by key, velocity and sample select |
| Drum kits | Drum Rack with a Simpler on each pad | Per-pad processing, choke groups, internal returns |
| Realistic acoustic instruments | The musician's sample libraries or Live's Packs | Synths rarely convince as piano, strings or guitar |

Live Suite also has modelled instruments (Electric for electric pianos, Tension for strings, Collision for mallets, Analog for classic subtractive) that are worth trying when they fit. Third-party instruments are welcome when the musician has them; work with them by function (oscillators, filter, envelopes, effects) and read their parameter names before changing anything. Details, parameters and starting ranges for each Live instrument are in `references/instruments.md`.

**Register matters as much as timbre.** A bright pad played in the vocal's octave will fight the vocal however you EQ it. Before reaching for EQ, try moving the part up or down an octave, thinning the voicing, or choosing a sound with less energy in that range.

## Synthesis basics

Most synth sounds follow the same path: **oscillators** make the raw tone, a **filter** removes harmonics, an **amplifier** shapes the level, and **envelopes** and **LFOs** move parameters over time.

- **Waveform sets the harmonic content.** Sine: just the fundamental, pure and round (sub bass, soft leads). Triangle: a few odd harmonics, soft and flute-like. Square or pulse: odd harmonics, hollow; changing the pulse width changes the colour. Saw: every harmonic, bright and full, the usual start for pads, leads and basses. Noise: no pitch, for breath, air, hats and risers.
- **Filter.** A low-pass removes highs; cutoff sets where, resonance emphasises the cutoff region. A 12 dB/octave slope is gentler and more open; 24 dB/octave is darker and more focused. Key tracking opens the filter for higher notes so the timbre stays even across the keyboard.
- **Amp envelope (ADSR) shapes the rhythm of the sound.** Attack: how fast it starts (0–5 ms for plucks and basses, 50 ms to 2 s for swells). Decay and sustain: how it settles. Release: how it ends; long releases blur fast parts and smear the groove.
- **Filter envelope shapes the tone over time.** A fast decay on the filter envelope gives a pluck; a slow attack gives a swell.
- **Modulation brings life.** LFO to pitch: vibrato. LFO to cutoff or wavetable position: movement. Velocity to cutoff or level: playing dynamics. Mod wheel or macro to a few parameters at once: one control the musician can ride.
- **Unison and detune** thicken a sound but spread its energy across the stereo field; check it in mono and keep basses mostly mono.

Recipes for specific synth sounds (sub bass, reese, pluck, pad, supersaw, FM keys and bells, risers, drones) are in the synths sub-skill.

## Layering

Layer when one sound can't do every job: one layer for the attack, one for the body, one for the air or tail.

- **Give each layer one job and its own range.** High-pass the upper layers so only one layer owns the low end. Two layers fighting for the same octave make mud, not size.
- **Split by time as well as frequency.** A short transient layer (click, noise burst, plucked attack) in front of a soft body sounds tighter than two sustained layers.
- **Keep them together.** Put layers in an Instrument Rack so they play as one instrument, with macros for the shared controls (cutoff, layer balance, width).
- **Check phase and tuning.** Layered low sounds can cancel each other; flip polarity or shift one slightly and keep the version with more low end. Detuned layers sound wide in stereo and can thin out in mono.
- **Fewer is usually better.** If a third layer doesn't make an obvious difference in the full mix, remove it.

## Sampling and resampling

- **Simpler modes.** Classic for playing one sample melodically with looping and envelopes; One-Shot for drums and hits that should play through; Slicing for chopping loops by transient, beat, region or manually.
- **Warp modes.** Beats for drums and percussive loops, Tones for monophonic pitched material (bass, vocals, single-note lines), Texture for pads and noisy material, Complex or Complex Pro for full mixes and chords, Re-Pitch when speed and pitch should change together like a record. Pick the mode that leaves the fewest artefacts at the new tempo.
- **Tune samples to the song.** Check the pitch of tonal samples (and of kicks and 808s) and transpose so they sit in key; detune by cents if needed.
- **Trim and fade.** Start at the transient, add short fades at the start and end of loops to avoid clicks.
- **Resample to commit.** Record a sound with its effects to a new audio track (or freeze and flatten) when the musician likes it. This frees CPU and opens audio-only moves: reverse, re-pitch, chop, stretch, slice the result back into Simpler.

## Sounds isolated from recordings

Stem separation can pull one sound ("the guitar", "the vocal", "the drums") out of a recording so it can become a sample, a Drum Rack pad or an audio clip.

- **What separates well:** a clear, distinctive source that is loud in the recording (lead vocal, drums, bass, a prominent guitar). Dense mixes, sounds that share a range with others, and heavy reverb separate less cleanly.
- **Listen for artefacts:** bleed from other instruments, a watery or phasey tone, smeared transients, holes where another sound was louder. Describe them honestly to the musician.
- **Clean up with ordinary tools.** EQ out bleed outside the sound's range, gate or fade the gaps, shorten the tail, and layer a clean transient over a soft attack. Artefacts that remain can become character: filtered, re-pitched or drenched in reverb, an imperfect stem can make a good texture.

## Generated sounds

A sound can be generated from a description when nothing in the musician's library fits.

- **Write a precise description:** the source ("felt piano", "metal pipe hit", "breathy synth"), pitch or key if tonal, length, envelope ("sharp attack, short decay"), character ("dusty, lo-fi, slightly detuned"), and space ("completely dry, no reverb"). Ask for dry sounds; it's easier to add space in the mix than to remove it.
- **Ask for several variations** and let the musician pick, then treat the result like any sample: trim, fade, tune, set its level, check for clicks and noise.

## Rights: generated, separated and sampled sounds

Ode is for songs the musician will release, so every sound in the song has to be one they are free to publish.

- **Generated sounds:** only use generated material from models or services whose terms allow commercial use and leave the musician the rights to the results.
- **Sounds isolated from recordings** are only cleared if the musician owns the source recording or has cleared it. Their own old demo is fine; a sound lifted from someone else's record needs clearance (usually both the recording and the composition) or should be replaced before release. Say so plainly when you see it, without lecturing.
- **Samples from libraries** come with a licence; most sample packs allow use inside a song, but check the terms when the musician isn't sure.
- **Keep a note of where each generated or sampled element came from** (the source recording or library, or that it was generated and from what description), so it can go into the credits and the clearance list checked before release.

## Effects as sound design

Effects are part of the sound, not only the mix. The order of a chain changes the result: distortion before a filter gives a bright, buzzy source that the filter tames; distortion after a resonant filter makes the resonance scream. Reverb before distortion turns the tail into a dense wash; reverb after keeps the distortion clean and puts it in a space.

Useful creative moves: saturation or Roar to add harmonics so a bass is heard on small speakers; Auto Filter with an LFO or envelope follower for movement; Echo or Delay as a rhythmic part of the sound; a long reverb, frozen or resampled, as a pad; Corpus or resonators to give noise a pitch; parallel chains in an Audio Effect Rack to keep the dry attack while distorting a copy. Device-by-device ideas and starting values are in `references/effects.md`.

## Shaping a sound in the mix

Sound design is the first mix decision. A sound chosen to fit needs less EQ later.

- **Leave space in frequency.** Pick sounds whose main energy doesn't sit where the vocal or lead sits. Where they must overlap, thin one of them at the source.
- **Leave space in time.** Short decays and releases keep a groove clear; long ones fill space and suit slower, sparser sections.
- **Keep the low end mono and owned by one part** (usually kick and bass). Sub oscillators and wide unison on chords and pads add rumble and mono problems.
- **Leave headroom.** Turn the instrument or sample down rather than letting it hit the track hard; resonant filters and unison can jump in level. Read the track meter after big changes.
- **Hand over cleanly.** When the sound is right, say what the mix stage should know ("the pluck has a lot of energy at 3 kHz, close to the vocal").

## Checks before handing a sound back

- Played with the rest of the section, not just in solo.
- Masking checked against the parts that share its range (vocal, lead, bass, kick).
- Level and peaks reasonable on the track meter; no clipping or sudden jumps.
- Mono: the sound doesn't vanish or thin out badly when summed.
- Low volume: the important part of the sound is still heard.
- In key and in time; no clicks at sample starts and ends.
- Rights: any generated or sampled element is cleared for release and its source is noted.
- Locked parts untouched; the original sound is still recoverable.

## Worked examples

**"The pluck disappears in the chorus."** A Wavetable pluck sits under supersaw pads and a vocal. Masking shows the pluck and the pads overlap at 1–3 kHz. Plan: raise the filter cutoff and shorten the filter-envelope decay so the attack is brighter and the notes are shorter (from 600 ms to roughly 200–300 ms), add light saturation for upper harmonics, and high-pass the pluck around 200–300 Hz so it stops thickening the pads. Make the filter change first, ask the musician to listen, then continue. If it still hides, suggest moving the pluck up an octave instead of more EQ.

**"Make the pad warmer, it's buzzy."** A Drift pad uses two detuned saws with the filter wide open. Move one oscillator to triangle or lower the cutoff to roughly 1.5–3 kHz with resonance low, set the attack to about 150–400 ms and the release to 1–2 s so chords bloom and overlap, and add a little Chorus-Ensemble for width. Then check against the vocal; if the pad still crowds it, a gentle EQ dip of 2–3 dB around the vocal's presence range on the pad does more than further filtering.

**"Turn my old phone recording into an instrument."** The musician recorded a guitar riff over a drum machine years ago. Isolate the guitar, note the leftover drum bleed and soft transients, clean it with a high-pass and fades, check its pitch and transpose to the song's key, then load it into Simpler: Slicing to play the riff's phrases from pads, or Classic with a single sustained note to play new melodies. Because it is the musician's own recording, it is cleared; note its source for the credits.

## Reference files

| File | Read when |
|---|---|
| `references/instruments.md` | Programming or choosing between Drift, Wavetable, Operator, Meld, Simpler, Sampler, Drum Rack or Instrument Racks, and you need parameters and starting ranges |
| `references/effects.md` | Using Saturator, Roar, Auto Filter, Delay, Echo, Reverb, Hybrid Reverb or other effects creatively, with starting values |

## Sub-skills

Paths are relative to this skill's folder.

| Path | Read when |
|---|---|
| `synths/SKILL.md` | Building or reshaping a specific synth sound: sub or reese bass, pluck, pad, supersaw, lead, FM keys or bells, risers and FX, drones and textures |
| `drums/SKILL.md` | Choosing, layering, tuning, synthesising or processing drum sounds (kick, snare, clap, hats, percussion, 808), building a Drum Rack, or drums isolated from recordings |
