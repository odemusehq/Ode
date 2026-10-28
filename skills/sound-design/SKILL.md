---
name: sound-design
description: Change how a part sounds, in place, in Ableton Live — reshape the instrument and effects already on the track (oscillators, filter, envelopes, modulation, saturation, width, space), load a better instrument, preset or sample onto that track, layer in a rack, tune and trim samples, isolate a sound from a recording or generate one — then check the part's level, its register against the parts around it and mono, and report in one line. Use this whenever the musician taps or types anything about how a part sounds ("warmer", "darker", "brighter", "punchier", "wider", "softer", "less harsh", "dusty", "glassy", "fatter"), selects an instrument or effect and wants it changed, needs a new sound, patch, preset or sample for a part, or wants a sound pulled from a recording or generated, even if they never say "sound design".
---

# Sound design

Choose and shape sounds so every part does its job in this song: the bass holds the floor, the lead speaks over everything, the pad fills without crowding, the texture adds life without asking for attention. A sound that is great in solo can be wrong in the track, so judge every change in the section where the part plays.

Ode changes the sound where it lives — the instrument and effects already on the track, or a new instrument or effect on that same track — and the musician hears it straight away. Undo and the version history are the way back, so nothing needs copying.

## The loop

1. **Read.** The project map gives the selected track's instrument and effects with their main values, the clips it plays, what else plays in the same bars, the key, the tempo and the hand edits since the last request. Read the device's full parameters and the part's notes: the lowest and highest notes set its register, the note lengths set its envelope times. Note the part's level in its section before changing anything, so the level check has something to compare with. Hand edits are the musician's own moves, so build on them. Check the lead sheet's locked parts, and recall the sounds and plug-ins the artist likes.
2. **Decide** the part's role (foundation, rhythm, harmony bed, lead, counter-melody, texture) and register, turn the musician's words into parameter moves (table below), and choose the stage to change: source, filter, envelopes, modulation, then effects. Reshape what is on the track before replacing it; a sound built in an instrument the musician knows is easier for them to keep shaping.
3. **Change it in place**, as one undo step:
   - Set the parameters of the instrument and effects already there. Add an effect after the instrument, on the same track, when the instrument can't get there alone.
   - Replace the instrument on the same track only when the sound needs another engine (FM for a bell, a multisample for a real piano); the notes stay as they are.
   - Never duplicate the track or the device to compare, and never put the new sound on a new track: Again gives another take and the history keeps the old one.
   - Keep the part's level. When a move changes it (resonance, unison, saturation, a lower cutoff), set the instrument's or effect's output so the musician hears a new tone, not a louder or quieter part.
   - Leave locked parts alone; if one is the problem, change what is around it and say so.
4. **Verify** with the checks below, fixing until they pass (up to three rounds); otherwise the result line says what still fails. Never present as checked what no check measured.
5. **Let them hear it.** When your turn ends, Ode plays the section where the part sounds. Don't start playback for that yourself, and don't ask the musician to listen.
6. **Report in one line:** what changed, with the values that matter, then " · " and what was checked. For example:
   - "Pad warmer: filter 18 kHz → 2.6 kHz, resonance down, osc 2 to triangle · level matched, no clipping."
   - "Kick tuned to D and shortened to 260 ms · ends before the next bass note, no clipping."
   - "Lead gritty: saw through Roar, band-pass at 1.8 kHz · level matched, holds in mono; rougher than your usual leads."

**Again** is another take of the same request. The Set is back as it was, so take a clearly different route (another waveform, filter type or instrument), not the same move made smaller.

**Outside the usual style.** When a take goes beyond the artist's usual sounds — judged only from their own songs and what they have said, never from their name, gender, age, nationality or genre clichés — the result line says so.

**"Like [artist]"** becomes general qualities you can name and build: bright or dark, short or sustained, clean or distorted, dry or roomy, centred or very wide, simple or evolving. Never recreate another artist's signature sound or a specific record's patch.

## Checks

| Check | When | Correct when |
|---|---|---|
| Level | Every change | The part's level in its section (its track meter, or the Master measured there) is about what it was before, unless louder or quieter was asked, and neither the track nor the Master clips |
| Register | Every change | The part's main energy doesn't sit on the vocal or lead in the same bars: their note ranges barely overlap, or the overlap is thinned by the filter, the voicing or an octave move |
| Masking | The part and its neighbour are audio tracks | Measured in the section, with no strong band left shared with the vocal or lead. MIDI parts can't be measured this way: compare note ranges and filter settings, and don't call masking measured |
| Mono | After widening (unison spread, chorus, stereo delay, detuned layers) | Mono below about 100–150 Hz; summed to mono, the part keeps most of its level. Wide but in-phase material loses up to about 3 dB; more, or a hollow tone, means the width is cancelling |
| Key | A new sample, a transposed oscillator, a tuned drum | Tonal samples, kicks and 808s sit on the song's key: the root, the fifth or another chord tone for drums |
| Clean edges | A new or trimmed sample | Starts on the transient, with short fades at the start, the end and loop points; no clicks |
| Source | A sound isolated from a recording or generated | Its source is written in the lead sheet's notes, and a source the musician doesn't own and hasn't cleared is named in the result line |

## Questions

Don't ask before changing a sound: it is an edit in place that Undo reverses, and the mode decides whether a change waits for Apply. Ask one line with buttons only when the answer changes what you would do — for example, the part to reshape is on a muted track and neither the hand edits nor the version history explain why. Muted long ago and untouched since usually means parked; muted moments ago while another track was soloed usually means muted to hear the others.

## Words into parameters

Musicians describe sounds with adjectives. These are the usual moves; combine them in the section.

| Word | Usual moves |
|---|---|
| Warmer | Lower the low-pass cutoff or gently cut 3–8 kHz; a softer waveform (triangle, or a saw with the filter closed down); gentle saturation that adds low-order harmonics; a little detune |
| Brighter, more cut | Open the filter; a richer waveform (saw, FM, sync); saturation; a broad 2–5 kHz lift; a faster attack |
| Darker | Lower cutoff, less resonance, a high shelf cut; fewer upper harmonics at the source |
| Thinner, less boomy | High-pass; cut 150–400 Hz; drop the sub oscillator or the low layer |
| Fatter, thicker | Unison and detune; a sub oscillator or low layer (only if the bass isn't already there); saturation; layering |
| Punchier | Faster attack, shorter decay, lower sustain; transient emphasis; less reverb on the attack |
| Softer, rounder | Slower attack (5–50 ms); less velocity-to-brightness; less resonance; a sine or triangle source |
| Wider | Unison spread, chorus, stereo delay or reverb; keep the low end mono |
| Airy | High shelf at 10–12 kHz; a quiet noise layer; a bright, diffuse reverb |
| Gritty, dirty, dusty | Saturation or distortion; bit or sample-rate reduction; vinyl or tape-style noise; band-limit the sound |
| Hollow | Square or pulse waves (odd harmonics); band-pass or notch filtering; comb filtering |
| Metallic, glassy, bell-like | FM with non-integer ratios; resonators; high resonance; long decay with a fast attack |
| Moving, wobbly | An LFO on cutoff, pitch, pan or wavetable position, usually synced to the tempo |
| Evolving | Slow LFOs or long envelopes on wavetable position, filter or effect mix; layers that crossfade |
| Closer, drier | Less reverb and delay, shorter decay, more transient and midrange |
| Further away | More reverb against the dry sound, fewer highs, a softer transient, lower level |

## Choosing the instrument for the part

| Need | Good starting points in Live | Why |
|---|---|---|
| Warm analog-style bass, pad, lead, pluck | Drift | Simple, quick to shape, light on CPU, natural variation between voices |
| Modern, evolving, wide or aggressive synths (supersaw, reese, growl) | Wavetable | Wavetable position, unison modes, two filters and deep modulation |
| Electric pianos, bells, metallic or punchy basses, synthetic drums | Operator | Four-operator FM plus a filter; FM gives bright, precise harmonics |
| Textures, unusual tones, expressive MPE parts | Meld | Two characterful engines, easy to layer or split |
| One sample played across keys, chopped loops, one-shots | Simpler | Classic, One-Shot and Slicing modes, warping |
| Multisampled instruments, velocity layers, round robin | Sampler | Zones by key, velocity and sample select |
| Drum kits | Drum Rack with a Simpler on each pad | Per-pad processing, choke groups, internal returns |
| Realistic acoustic instruments | The musician's sample libraries or Live's Packs | Synths rarely convince as piano, strings or guitar |

Live Suite's modelled instruments (Electric for electric pianos, Tension for strings, Collision for mallets, Analog for classic subtractive sounds) are worth loading when they fit. Third-party instruments are welcome when the musician has them: work with them by function (oscillators, filter, envelopes, effects) and read their parameter names and values before changing anything. Parameters and starting ranges for each Live instrument are in `references/instruments.md`.

**Register matters as much as timbre.** A bright pad in the vocal's octave fights the vocal however it is filtered. Before reaching for EQ, move the patch an octave with its oscillators' octave controls, thin it, or choose a sound with less energy in that range; moving or revoicing the notes themselves belongs to the arrangement and harmony skills.

## Synthesis basics

Oscillators make the raw tone, a filter removes harmonics, an amplifier shapes the level, and envelopes and LFOs move parameters over time.

- **Waveform sets the harmonics.** Sine: the fundamental only (sub bass, soft leads). Triangle: a few odd harmonics, soft. Square or pulse: odd harmonics, hollow; the pulse width changes the colour. Saw: every harmonic, bright and full, the usual start for pads, leads and basses. Noise: no pitch, for breath, air, hats and risers.
- **Filter.** The low-pass cutoff sets where the highs go; resonance emphasises the cutoff region. 12 dB/octave is gentler and more open, 24 dB/octave darker and more focused. Key tracking keeps the tone even across the keyboard.
- **The amp envelope shapes the rhythm of the sound.** Attack 0–5 ms for plucks and basses, 50 ms to 2 s for swells; long releases blur fast parts and smear the groove.
- **The filter envelope shapes the tone over time.** A fast decay gives a pluck; a slow attack gives a swell.
- **Modulation brings life.** LFO to pitch: vibrato. LFO to cutoff or wavetable position: movement. Velocity to cutoff or level: playing dynamics. A macro on a few parameters: one control the musician can ride.
- **Unison and detune** thicken a sound but spread it across the stereo field; keep basses mostly mono.

Recipes for specific synth sounds are in the synths sub-skill.

## Layering

Layer when one sound can't do every job: one layer for the attack, one for the body, one for the air or tail.

- **One job and one range per layer.** High-pass the upper layers so a single layer owns the low end; two layers fighting for the same octave make mud, not size.
- **Split by time as well as frequency.** A short transient layer (click, noise burst, plucked attack) in front of a soft body sounds tighter than two sustained layers.
- **Layers live in an Instrument Rack on the part's track**, playing as one instrument, with macros for the shared controls named in plain words (Brightness, Movement, Width, Dirt).
- **Phase and tuning.** Layered lows can cancel: flip the polarity of one and keep the setting with more low end. Detuned layers sound wide in stereo and can thin out in mono.
- **Fewer is better.** A layer that makes no obvious difference in the full section comes out.

## Samples

- **Simpler modes.** Classic plays one sample melodically, with looping and envelopes; One-Shot plays drums and hits through; Slicing chops a loop by transient, beat, region or by hand.
- **Warp modes** for audio clips and warped samples: Beats for drums and percussive loops, Tones for monophonic pitched material, Texture for pads and noisy material, Complex or Complex Pro for full mixes and chords, Re-Pitch when speed and pitch should change together. Pick the mode with the fewest artefacts at the song's tempo.
- **Tune to the song.** Find the pitch of tonal samples, kicks and 808s and transpose them onto the key, using cents for the last step.
- **Trim and fade.** Start at the transient; short fades at the start and end of loops stop clicks.

## Sounds isolated from recordings

Stem separation pulls one described sound ("the guitar", "the snare", "the voice") out of a recording, so it can become a sample, a Drum Rack pad or an audio clip.

- **What separates well:** a clear, distinctive source that is loud in the recording. Dense mixes, sounds that share a range with others and heavy reverb separate less cleanly.
- **Artefacts:** bleed from other instruments, a watery or phasey tone, smeared transients, holes where another sound was louder. Clean what you can and name what remains in the result line.
- **Clean with ordinary tools:** EQ out bleed outside the sound's range, fade the gaps, shorten the tail, layer a clean transient over a soft attack. Leftover artefacts can become character once filtered, re-pitched or put in reverb.
- **Put it where it belongs:** a Simpler or a Drum Rack pad on the part's track, or a new track when it is a new part.
- **Write its source in the lead sheet's notes** (whose recording, and that the sound was isolated from it), so the release clearance list has it.

## Generated sounds

- **Describe precisely:** the source ("felt piano", "metal pipe hit", "breathy synth"), pitch or key if tonal, length, envelope ("sharp attack, short decay"), character ("dusty, slightly detuned") and space ("completely dry"). Ask for dry sounds; space is easier to add than to remove.
- **Treat the result like any sample:** trim, fade, tune and set its level, and keep the one that passes the checks. Again generates another.
- **Write the description in the lead sheet's notes** as the sound's source.

## Rights

Ode is for songs the musician will release, so every sound has to be one they are free to publish.

- **Generated sounds** only from models or services whose terms allow commercial use and leave the musician the rights to the results.
- **Isolated sounds** are cleared only when the musician owns the source recording or has cleared it. Their own old demo is fine; a sound lifted from someone else's record needs clearance (usually for both the recording and the composition) or replacing before release. Say so once, plainly, in the result line.
- **Library samples** come with a licence; most packs allow use inside a song.

## Effects as sound design

Effects are part of the sound, and their order changes it: distortion before a filter gives a bright, buzzy source that the filter tames; distortion after a resonant filter makes the resonance scream; reverb before distortion turns the tail into a dense wash, reverb after it keeps the distortion clean and puts it in a space. Useful moves: saturation or Roar so a bass is heard on small speakers; Auto Filter with an LFO or the envelope follower for movement; Echo or Delay as a rhythmic part of the sound; Corpus or resonators to give noise a pitch; parallel chains in an Audio Effect Rack to keep the dry attack while a copy of the signal distorts. Device-by-device starting values are in `references/effects.md`.

## Shaping a sound for the mix

Sound design is the first mix decision; a sound chosen to fit needs less EQ later.

- **Space in frequency.** Choose sounds whose main energy isn't where the vocal or lead sits; where they must overlap, thin one of them at the source.
- **Space in time.** Short decays and releases keep a groove clear; long ones suit slower, sparser sections.
- **Low end mono and owned by one part**, usually kick and bass. Sub oscillators and wide unison on chords and pads add rumble and mono problems.
- **Headroom.** Turn the instrument or sample down rather than letting it hit the track hard; resonant filters and unison jump in level.

## Reference files

| File | Read when |
|---|---|
| `references/instruments.md` | Programming or choosing between Drift, Wavetable, Operator, Meld, Simpler, Sampler, Drum Rack or racks, and you need parameters and starting ranges |
| `references/effects.md` | Using Saturator, Roar, Auto Filter, Delay, Echo, Reverb, Hybrid Reverb or other effects creatively, with starting values |

## Sub-skills

Paths are relative to this skill's folder.

| Path | Read when |
|---|---|
| `synths/SKILL.md` | Building or reshaping a specific synth sound: sub or reese bass, pluck, pad, supersaw, lead, FM keys or bells, risers, drones and textures |
| `drums/SKILL.md` | Choosing, layering, tuning, synthesising or processing drum sounds (kick, snare, clap, hats, percussion, 808), building a Drum Rack kit, or drums isolated from recordings |
