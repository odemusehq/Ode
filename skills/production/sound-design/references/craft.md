# Sound design

Choose and shape sounds so every part does its job in this song: the bass holds the floor, the lead speaks over everything, the pad fills without crowding, the texture adds life without asking for attention. A sound that is great in solo can be wrong in the track, so judge every change in the section where the part plays.

Ode changes the sound where it lives — the instrument and effects already on the track, or a new instrument or effect on that same track — and the musician plays it in Live straight away. Preserve existing material and use native read/write controls. Live Undo and Ode History cover different state; do not promise full restoration of sample, preset or routing changes.

## Words into parameters

Musicians describe sounds with adjectives. These are starting moves to audition in context, not fixed translations or a requirement to use every stage.

| Word | Usual moves |
|---|---|
| Warmer | Lower the low-pass cutoff or gently cut 3–8 kHz; a softer waveform (triangle, or a saw with the filter closed down); gentle saturation that adds low-order harmonics; a little detune |
| Brighter, more cut | Open the filter; a richer waveform (saw, FM, sync); saturation; a broad 2–5 kHz lift; a faster attack |
| Darker | Lower cutoff, less resonance, a high shelf cut; fewer upper harmonics at the source |
| Thinner, less boomy | High-pass; cut 150–400 Hz; drop the sub oscillator or the low layer |
| Fatter, thicker | Unison and detune; a sub oscillator or low layer (only when the bass leaves that range free); saturation; layering |
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
| Played electric keys | Electric; a suitable loaded sampled instrument | Tine/reed modelling or samples respond to the part's touch and decay |
| Plucked/bowed strings, guitar or bass colours | Tension; suitable sampled instruments or loaded guitar/bass plug-ins | String excitation/body controls or recorded articulations; choose by the intended realism |
| Driven guitar or bass | A suitable source through Amp/Cabinet, optionally Pedal | Amp and speaker colour shape an instrument; distortion alone does not create its articulation |
| Mallets and resonant percussion | Collision; sampled mallets | Physical resonators or recordings suit struck parts |
| Warm analog-style bass, pad, lead, pluck | Drift | Simple, quick to shape, light on CPU, natural variation between voices |
| Subtractive synth bass, keys or lead | Analog | Two oscillators, filters and envelopes offer another synth character |
| Modern, evolving, wide or aggressive synths (supersaw, reese, growl) | Wavetable | Wavetable position, unison modes, two filters and deep modulation |
| Electric pianos, bells, metallic or punchy basses, synthetic drums | Operator | Four-operator FM plus a filter; FM gives bright, precise harmonics |
| Textures, unusual tones, expressive MPE parts | Meld | Two characterful engines, easy to layer or split |
| One sample played across keys, chopped loops, one-shots | Simpler | Classic, One-Shot and Slicing modes, warping |
| Multisampled instruments, velocity layers, alternating samples | A loaded Sampler/rack or suitable plug-in preset | Existing key/velocity layers and articulation mappings; Ode cannot build Sampler zones through the present tools |
| Acoustic or electronic drum kits | A suitable loaded kit, or Drum Rack with selected samples | Actual pad mapping and velocity response determine what can be played |
| Realistic acoustic instruments | The musician's sample libraries or Live's Packs, loaded by the musician; Ode then shapes them | Synths rarely convince as piano, strings or guitar |

Availability depends on the installed Live edition, Packs and plug-ins; a failed insertion is not permission to substitute another source without regard to the brief. Read `references/instruments.md` for the chosen engine and its performance needs.

**Performance is part of the sound.** For a guitar, decide a playable voicing, pick/strum order, note lengths, mutes and changes of articulation; for keys, shape touch and releases; for bass, decide overlaps or separation against the kick. Use the model's explicit notes and the instrument's documented articulation controls. Do not simulate an independent double by copying a part and delaying it, or humanise every genre with random timing/velocity. A MIDI synth guide remains a guide until a real recording supplies the intended voice.

**Register matters as much as timbre.** A bright pad in the vocal's octave fights the vocal however it is filtered. Before reaching for EQ, move the patch an octave with its oscillators' octave controls, thin it, or choose a sound with less energy in that range; moving or revoicing the notes themselves belongs to the arrangement and harmony skills.

## Synthesis basics

Oscillators make the raw tone, a filter removes harmonics, an amplifier shapes the level, and envelopes and LFOs move parameters over time.

- **Waveform sets the harmonics.** Sine: the fundamental only (sub bass, soft leads). Triangle: a few odd harmonics, soft. Square or pulse: odd harmonics, hollow; the pulse width changes the colour. Saw: every harmonic, bright and full, the usual start for pads, leads and basses. Noise: unpitched, for breath, air, hats and risers.
- **Filter.** The low-pass cutoff sets where the highs go; resonance emphasises the cutoff region. 12 dB/octave is gentler and more open, 24 dB/octave darker and more focused. Key tracking keeps the tone even across the keyboard.
- **The amp envelope shapes the rhythm of the sound.** Attack 0–5 ms for plucks and basses, 50 ms to 2 s for swells; long releases blur fast parts and smear the groove.
- **The filter envelope shapes the tone over time.** A fast decay gives a pluck; a slow attack gives a swell.
- **Modulation brings life.** LFO to pitch: vibrato. LFO to cutoff or wavetable position: movement. Velocity to cutoff or level: playing dynamics. A macro on a few parameters: one control the musician can ride.
- **Unison and detune** thicken a sound but spread it across the stereo field; keep basses mostly mono.

Recipes for specific synth sounds are in the synths sub-skill.

## Layering

Layer when the jobs need more than one sound: one layer for the attack, one for the body, one for the air or tail.

- **One job and one range per layer.** High-pass the upper layers so a single layer owns the low end; two layers fighting for the same octave make mud.
- **Split by time as well as frequency.** A short transient layer (click, noise burst, plucked attack) in front of a soft body sounds tighter than two sustained layers.
- **Layers live in an Instrument Rack on the part's track**, playing as one instrument, with macros for the shared controls named in plain words (Brightness, Movement, Width, Dirt).
- **Phase and tuning.** Layered lows can cancel: flip the polarity of one and keep the setting with more low end. Detuned layers sound wide in stereo and can thin out in mono.
- **Fewer is better.** A layer whose difference is hard to hear in the full section comes out.

## Samples

- **Simpler modes.** Classic plays one sample melodically, with looping and envelopes; One-Shot plays drums and hits through; Slicing chops a loop by transient, beat, region or by hand.
- **Warp modes** for audio clips and warped samples: Beats for drums and percussive loops, Tones for monophonic pitched material, Texture for pads and noisy material, Complex or Complex Pro for full mixes and chords, Re-Pitch when speed and pitch should change together. Pick the mode with the fewest artefacts at the song's tempo.
- **Tune to the song.** Find the pitch of tonal samples, kicks and 808s and transpose them onto the key, using cents for the last step.
- **Regions and fades.** Native Simpler sample markers and clip markers can trim playback regions. Simpler can perform its own transient slicing. Fades or macro mappings without an exposed control need a specific musician-performed editor step.

## Effects as sound design

Effects are part of the sound, and their order changes it: distortion before a filter gives a bright, buzzy source that the filter tames; distortion after a resonant filter makes the resonance scream; reverb before distortion turns the tail into a dense wash, reverb after it keeps the distortion clean and puts it in a space. Useful moves: saturation or Roar so a bass is heard on small speakers; Auto Filter with an LFO or the envelope follower for movement; Echo or Delay as a rhythmic part of the sound; Corpus or resonators to give noise a pitch; parallel chains in an Audio Effect Rack to keep the dry attack while a copy of the signal distorts. Device-by-device starting values are in `references/effects.md`.

## Shaping a sound for the mix

Sound design is the first mix decision; a sound chosen to fit needs less EQ later.

- **Space in frequency.** Choose sounds whose main energy sits away from the vocal or lead; where they must overlap, thin one of them at the source.
- **Space in time.** Short decays and releases keep a groove clear; long ones suit slower, sparser sections.
- **Low end mono and owned by one part**, usually kick and bass. Sub oscillators and wide unison on chords and pads add rumble and mono problems.
- **Headroom.** Turn the instrument or sample down so it feeds the track gently; resonant filters and unison jump in level.

## Reference files

| File | Read when |
|---|---|
| `references/instruments.md` | Choosing or programming physical-modelled, sampled or synth instruments, kits and racks; checking what the available controls actually expose |
| `references/effects.md` | Shaping an amp/cabinet/pedal chain or using other native effects creatively |

## Sub-skills

Paths are relative to this skill's folder.

| Path | Read when |
|---|---|
| `synths/SKILL.md` | Building or reshaping a specific synth sound: sub or reese bass, pluck, pad, supersaw, lead, FM keys or bells, risers, drones and textures |
| `drums/SKILL.md` | Choosing, layering, tuning, synthesising or processing drum sounds (kick, snare, clap, hats, percussion, 808), building a Drum Rack kit, or drums isolated from recordings |
