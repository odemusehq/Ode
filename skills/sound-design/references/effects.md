# Effects as sound design

Creative uses of Live's effects, with settings to start from. For corrective mix use of the same devices (gain staging, EQ, compression, sends), see the mixing skill. Values are starting points: listen in the track and move from there.

## Contents
- Order and parallel chains
- Saturation and distortion: Saturator, Roar, Pedal, Drum Buss, Redux, Erosion, Vinyl Distortion
- Filters: Auto Filter
- Delays: Delay, Echo, Grain Delay, Beat Repeat
- Reverbs: Reverb, Hybrid Reverb
- Modulation: Chorus-Ensemble, Phaser-Flanger, Shifter, Auto Pan
- Resonators and spectral effects: Corpus, Spectral Resonator, Spectral Time
- Resampling effects into new sounds

## Order and parallel chains

The same devices in a different order make a different sound.

| Order | Result |
|---|---|
| Distortion → filter | Bright, buzzy source tamed by the filter; the classic synth-bass sound |
| Resonant filter → distortion | The resonance drives the distortion: aggressive, vocal, squelchy |
| Distortion → reverb | Clean distortion in a space; keeps the tail smooth |
| Reverb → distortion | The tail itself distorts into a dense wash; good for textures, too much for most lead parts |
| Delay → reverb | Repeats sit inside the space; softer and further away |
| Compressor → saturation | Even level into the saturator gives a steady, consistent colour |

**Parallel chains** keep the dry attack while a copy is processed. Use an Audio Effect Rack with a dry chain and an effected chain (balance them with chain volumes), or the Dry/Wet control where a device has one. Parallel distortion on bass and drums adds edge without losing weight.

**Watch the level.** Distortion, resonance and feedback raise the level; louder sounds better to everyone, so match the output to the input before judging. Read the track meter after each change.

## Saturation and distortion

**Saturator.** A waveshaper with several curves: Analog Clip and Soft Sine for gentle, warm harmonics; Medium and Hard Curve for more edge; Sinoid Fold for folded, metallic harmonics; Digital Clip for hard clipping; Bass Shaper for low-end-focused saturation; Waveshaper for a fully adjustable curve. Colour adds tone shaping around the shaper, Soft Clip catches the output's peaks, and Dry/Wet allows parallel use.

| Use | Start from | Why |
|---|---|---|
| Subtle warmth | Analog Clip or Soft Sine, drive 2–6 dB, output down by about the same | Low-order harmonics thicken without obvious distortion |
| Bass heard on small speakers | Drive 6–15 dB, Dry/Wet 20–40% | Harmonics an octave and more above the fundamental let small speakers imply the low note |
| Aggressive lead or drum edge | Hard Curve or Waveshaper, drive 10–20 dB, Dry/Wet to taste | Strong upper harmonics cut through |

**Roar.** A multi-stage saturation and colouring effect. Up to three shaper stages, each followed by a filter, routed as Single, Serial, Parallel, Multiband, Mid/Side or Feedback, with a compressor, a feedback section and modulation (LFOs, an envelope follower, noise). Shaper types range from gentle (Tube Preamp, Soft Sine) to harsh (Diode Clipper, Bit Crusher and others).

- **Multiband routing** distorts the mids and highs while the low band stays clean: grit on a bass without losing the sub.
- **Mid/Side routing** keeps the centre clean and roughs up the sides, or the reverse.
- **Feedback routing** turns Roar into a resonant, pitched effect; tune the feedback to the song's key or sync it to the tempo.
- **Modulation** on shaper amount or filter frequency makes the colour move with the groove.
- Start with low amounts and add stages only when one stage can't get there.

**Pedal.** Guitar-pedal style Overdrive, Distortion and Fuzz with a simple tone stack. Quick character on synths, drums and vocals, not just guitars.

**Drum Buss.** Drive and Crunch for saturation, Damp to roll off harshness, Transients to sharpen or soften attacks, and Boom for a tuned low resonance. Built for drums but useful on any percussive sound (see the drums sub-skill).

**Redux.** Bit-depth and sample-rate reduction. Downsampling adds aliased, gritty highs; bit reduction adds noise and crunch. Small amounts give lo-fi dust; large amounts give a broken, video-game edge.

**Erosion.** Adds noise- or sine-modulated distortion at a set frequency. Good for a brittle, digital top end on hats and textures.

**Vinyl Distortion.** Crackle and record-style distortion for an old-record feel. Keep crackle on its own return or a separate texture track, so its level can be set apart from the music.

## Filters

**Auto Filter.** Low-pass, high-pass, band-pass, notch and morphing filter types with resonance, an LFO with tempo sync, an envelope follower and a sidechain input.

| Use | Start from | Why |
|---|---|---|
| Rhythmic movement | LFO synced to 1/8 or 1/16, moderate depth, resonance 20–40% | Movement in time with the groove reads as part of the rhythm |
| Envelope-follower "wah" | Band-pass or low-pass; envelope amount positive; fast attack, release 50–200 ms | The filter opens with each hit, so the sound responds to playing |
| Sweep in a build | High-pass moved from about 30 Hz up to 300–1000 Hz over the build, or a low-pass opening from 300 Hz to fully open | Removing or revealing the lows and highs signals that something is coming |
| Telephone or radio sound | Band-pass around 1–2 kHz, fairly narrow | Strips lows and highs so the sound feels small and distant |

Sweeps over several bars usually need automation; if you can't write it yourself, give the musician the start and end bars and values.

## Delays

**Delay.** Left and right times (synced or in milliseconds), Link, Ping Pong, Feedback, a band-pass filter on the repeats, modulation, Freeze, and a transition mode (Repitch, Fade, Jump) that sets what happens when the time changes.

- Rhythmic repeats: 1/8 dotted or 1/4, feedback 20–40%, the filter narrowing the repeats so they stay out of the low end and are softer than the source.
- Width: Ping Pong, or slightly different left and right times.
- Stutters and drones: Freeze captures the buffer and repeats it; resample the result.
- Tape-like pitch bends: Repitch mode while changing the time.

**Echo.** A character delay: tape and analog colour, Stereo, Ping Pong and Mid/Side modes, high- and low-pass filters, modulation, a Character section (gate, ducking, noise, wobble) and a reverb section.

- Old-tape repeats: noise and wobble low, high-pass 200–500 Hz, low-pass 3–6 kHz, feedback 30–50%.
- Ducking lowers the repeats while the source plays and lets them rise in the gaps; repeats stay out of the way of the part itself.
- High feedback with the filter resonant makes self-oscillating swells; keep a hand on the output level.

**Grain Delay.** Short delays with pitch shift and randomisation: shimmering, scattered textures from any source.

**Beat Repeat.** Repeats slices of the input in time: stutters, glitches and fills. Keep its chance and length controls modest for occasional variation rather than constant chopping.

## Reverbs

**Reverb.** Algorithmic. Input filters (low and high cut), early reflections, size, decay time, pre-delay, diffusion, a Freeze switch, and Dry/Wet.

- A held pad from any sound: high decay or Freeze, 100% wet on a return or a resampled track, then filter and fade.
- Huge, dark atmospheres: decay 8–20 s, high cut 2–4 kHz, resampled and pitched down an octave.
- Reverse reverb: render the reverb tail of a word or hit, reverse it, and place it to swell into the original (see the arrangement skill's transitions reference).

**Hybrid Reverb.** Convolution and algorithmic engines that can run in serial or parallel, blended. Algorithms include Dark Hall, Quartz, Shimmer, Tides and Prism; there is an EQ, a Vintage control for early-digital character and a Bass Mono option.

- Shimmer for tails that rise in pitch: ambient pads and transitions.
- Tides for moving, modulated tails.
- Convolution with texture-type impulse responses for spaces that don't exist: metallic, grainy or rhythmic tails.

## Modulation

**Chorus-Ensemble.** Classic chorus, a richer Ensemble mode and a Vibrato mode. Width and movement on pads, keys and leads; rate around 0.3–1.5 Hz with Dry/Wet 20–50% stays musical. Check mono, since chorus width can thin out when summed.

**Phaser-Flanger.** Phaser, Flanger and Doubler modes. Slow phasing (one cycle over one or two bars, synced) adds motion to pads and hats; flanging with feedback gives jet-like sweeps for transitions.

**Shifter.** Pitch and frequency shifting with modulation. Small frequency shifts thicken and detune; larger ones give metallic, inharmonic tones.

**Auto Pan.** Tremolo and rhythmic chopping (amount high, synced rate, square-like shape) as well as stereo movement.

## Resonators and spectral effects

**Corpus.** Simulates resonating bodies (beams, strings, membranes, plates, pipes, tubes). Feeding it noise or drums gives pitched, physical tones; tune it to the song's key or let MIDI set its pitch.

**Spectral Resonator.** Resonates the input's spectrum at set pitches; turns drums or noise into chords and adds metallic halos.

**Spectral Time.** Spectral freeze and delay; smears sounds into evolving washes, glassy textures and frozen chords.

## Resampling effects into new sounds

Effects become new instruments when printed to audio:
1. Record the processed sound to a new audio track (or freeze and flatten).
2. Edit the audio: reverse, re-pitch, cut out the best second, crossfade a loop.
3. Load the result into Simpler or a Drum Rack pad and play it.

This is how a vocal word becomes a pad, a reverb tail becomes a riser, or a distorted noise burst becomes a snare layer. Note the source of the original audio, so its rights carry over to the new sound.
