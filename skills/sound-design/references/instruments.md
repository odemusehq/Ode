# Live instruments for sound design

Strengths, key controls and starting ranges for Live's instruments. Ranges are only starting points, to move from while listening in the track. The reasons matter more than the numbers: once you know why a value is in that range, you know which way to move it.

## Contents
- Drift
- Wavetable
- Operator
- Meld
- Simpler
- Sampler
- Drum Rack
- Instrument and Audio Effect Racks
- Third-party instruments

## Drift

A compact analog-style subtractive synth. Light on CPU, quick to program, with a built-in amount of random variation between voices that makes it sound less static.

**Key controls**
- Two oscillators plus noise. Oscillator 1 has more shapes (sine, triangle, shark tooth, saturated, saw, pulse, rectangle) and a Shape control that changes the waveform's character; oscillator 2 can be detuned against it for thickness.
- A low-pass filter with a gentler and a steeper type, resonance and key tracking, plus a high-pass control.
- Envelope 1 shapes the amplitude; envelope 2 is assignable (commonly to filter cutoff) and can cycle like an LFO.
- An LFO and a small modulation matrix.
- Voice modes: Poly, Mono, Stereo and Unison; glide; the Drift amount (per-voice variation).

**Starting points**
| Sound | Settings to start from | Why |
|---|---|---|
| Bass | Mono mode; saw or rectangle; cutoff 300–800 Hz, resonance low to moderate; amp attack 0–5 ms, decay 200–500 ms, sustain 60–100%, release 30–100 ms; optional glide 30–80 ms | Mono and short release keep notes from overlapping and blurring the low end |
| Pad | Poly; saw plus oscillator 2 detuned 5–15 cents; cutoff 1–4 kHz; attack 200 ms–1 s; release 1–3 s; Drift amount moderate | Slow attack and long release let chords bloom and overlap; detune adds width |
| Pluck | Amp attack 0 ms, decay 150–400 ms, sustain 0; envelope 2 on cutoff with a similar decay; cutoff starting low (300–800 Hz) so the envelope opens it | The filter envelope gives the bright start that defines a pluck |
| Soft lead | Triangle or saw with the filter partly closed; Mono with glide 20–60 ms; LFO to pitch for gentle vibrato, delayed if possible | Glide and vibrato make a single line sing |

## Wavetable

A wavetable synth with two main oscillators, a sub oscillator, two filters and deep modulation. The place for modern, wide, evolving or aggressive tones.

**Key controls**
- Two oscillators that scan a wavetable with the Position control. Each oscillator has an effect mode: FM, Classic (pulse width and sync) or Modern (warp and fold).
- A sub oscillator with its own octave and tone.
- Two filters routed in serial, parallel or split, with low-pass, high-pass, band-pass, notch and morph types, 12 or 24 dB/octave slopes, and circuit types (Clean, OSR, MS2, SMP, PRD) that change the drive and colour.
- Three envelopes, two LFOs and a modulation matrix that also takes velocity, note, mod wheel, pitch bend, aftertouch and MPE.
- Unison modes (Classic, Shimmer, Noise, Phase Sync, Position Spread, Random Note) with an amount control.

**Starting points**
| Sound | Settings to start from | Why |
|---|---|---|
| Supersaw | Saw-based table; Classic unison, 6–8 voices, amount 25–50%; filter cutoff 4–10 kHz; attack 0–20 ms, release 200–600 ms | Many detuned voices give size; too much amount turns it out of tune and phasey in mono |
| Reese bass | Two saw oscillators detuned 10–30 cents (or Classic unison with low amount); Mono; low-pass 400–1200 Hz, 24 dB; slow LFO on detune or position | Slow beating between detuned saws is the defining movement |
| Growl or talking bass | LFO synced to 1/8 or 1/16 on wavetable position and filter cutoff; some FM; a band-pass or morph filter | Moving harmonics in rhythm create the vocal-like movement |
| Evolving pad | Slow LFO (0.05–0.3 Hz) or a long envelope on position; Shimmer or Position Spread unison; long attack and release | Slow change keeps a held chord interesting without new notes |

Keep the sub oscillator off when a separate bass part exists; it adds low end the bass already owns.

## Operator

A four-oscillator FM synth with a filter, LFO and pitch envelope. FM gives precise, bright harmonics: electric pianos, bells, metallic tones, punchy basses and synthetic drums.

**Key controls**
- Oscillators A–D arranged by one of 11 algorithms. A carrier is heard; a modulator changes the carrier's tone. The modulator's level sets brightness; its ratio (Coarse and Fine) sets which harmonics appear.
- Integer ratios (1, 2, 3…) give harmonic, musical tones; non-integer ratios (such as 1.41 or 3.5) give inharmonic, bell-like or metallic tones.
- Waveforms per oscillator (sine plus additive saw and square shapes, noise, user-drawn); Fixed mode for drum-like tones that hold one pitch across the keyboard.
- An envelope per oscillator, a filter with its own envelope, an LFO, a pitch envelope and glide.

**Starting points**
| Sound | Settings to start from | Why |
|---|---|---|
| FM electric piano | Carrier sine, modulator at ratio 1 with a fast-decaying envelope (decay 0.5–1.5 s, sustain low); optionally a quiet high-ratio modulator (around 14) with a very short envelope for the tine attack; velocity to modulator level | Brightness that fades as the note decays, and harder playing sounding brighter, is what makes it feel like a played instrument |
| Bell | Carrier sine, modulator at a non-integer ratio (e.g. 3.5), modulator level moderate; long amp decay (2–6 s), sustain 0 | Inharmonic partials and a long decay read as struck metal |
| FM bass | Carrier sine, modulator at ratio 1 or 2, level 30–60%, short modulator decay (80–300 ms); Mono with short release | The modulator envelope gives a bright, plucky start over a clean sine body |
| Synthetic kick | One sine in Fixed or low pitch with a pitch envelope falling quickly to the fundamental (see the drums sub-skill) | A fast pitch drop is the sound of most electronic kicks |

## Meld

A two-engine synth (engines A and B) built for textures, layering and expressive playing. Each engine has a characterful oscillator with two macro controls, a filter and its own modulation; the engines can be layered or balanced against each other. It supports MPE, and its oscillators and filters can follow the Set's scale.

**Where it shines**
- Textures and unusual tones, far from the sound of standard subtractive synths.
- Layered sounds in one instrument: a tonal engine plus a noisy or granular-sounding engine for air.
- Expressive parts where pressure or slide should change the tone.

**How to approach it.** Pick an oscillator type by ear first, then shape its two macros, then the filter. Keep one engine simple when the other is complex; two complex engines in one patch usually turn into noise in a mix.

## Simpler

Plays one sample. The quickest way to turn audio into an instrument.

**Modes**
- **Classic:** plays the sample chromatically with looping, amp, filter and pitch envelopes, and an LFO. For melodic use of a single note or chord.
- **One-Shot:** plays the sample through from start to end, with simple fade controls. For drums, hits and effects.
- **Slicing:** cuts the sample by transient, beat, region or manually, one slice per note. For chopping loops and vocal phrases.

**Settings to start from**
| Use | Settings | Why |
|---|---|---|
| Drum one-shot | One-Shot mode; trim the start to the transient; short fade-out if the tail is noisy | A late start softens the hit; noisy tails build up |
| Chopped loop | Slicing by transient (adjust sensitivity until each hit has its own slice) or by beat at 1/8 or 1/16; mono playback so a new slice cuts the previous one | Mono playback keeps chops tight and stops tails piling up |
| Melodic sample | Classic; loop a stable part of the sustain with a short crossfade; attack 0–10 ms, release 50–300 ms | A stable loop region holds notes without a pulsing or clicking loop point |

Use Warp when the sample should follow the tempo; turn it off when it should play at its natural speed and change pitch with the keys.

## Sampler

A full multisampler. Use it when a sound needs more than one sample: realistic instruments, velocity layers, alternating samples so repeated notes sound natural.

- **Zones:** key zones spread samples across the keyboard; velocity zones switch layers by playing strength; sample select zones (including round robin) choose between alternatives.
- **Modulation:** a modulation oscillator for FM or AM, LFOs, auxiliary envelopes, and a filter.
- Map samples close to their root pitch; stretching one sample over many octaves sounds unnatural.

## Drum Rack

A rack of pads; each pad holds a chain with an instrument (usually Simpler) and its own effects.

- **Per-pad mixing:** each chain has volume, pan and sends; level-match hits here first.
- **Choke groups:** put open and closed hi-hats in the same choke group so a closed hat cuts the open one, as on a real kit.
- **Return chains inside the rack:** a room reverb or saturation shared by several pads keeps the kit coherent.
- **Organisation:** keep a consistent pad layout (kick, snare, clap, hats, percussion) so patterns stay readable and swapping kits is easy.

## Instrument and Audio Effect Racks

- **Chains** run in parallel; use them for layers, parallel effects or splits by key or velocity.
- **Chain selector** crossfades between chains with one control: morph from a soft to a hard version of a sound.
- **Macros** map several parameters to one control with set ranges. Give the musician two to four macros that matter (brightness, movement, width, dirt) with names they understand; this keeps the sound easy to adjust later.

## Third-party instruments

Welcome whenever the musician has added them to a track: Ode sets their parameters. Most follow the same structure (oscillators, filter, envelopes, modulation, effects), so the principles above apply.

- Read the parameter names and current values before changing anything.
- A preset close to the target is often the best start: the musician loads it, and Ode shapes it from there; presets made by the instrument's designers often use features that are hard to find by hand.
- Note which instruments and presets the musician reaches for: shape them when they are on the track, and suggest them in the result line when they fit a later take.
