# Transitions

How to build and place common transitions in Live. A transition signals that a change is coming and hides the seam between two sections. Vary them across the song: the same riser before every chorus stops working by the third time.

## Contents
- Placement at a glance
- Risers and downlifters
- Reverse cymbals and reverse reverbs
- Drum fills and snare builds
- Filter sweeps and width changes
- Silence and drop-outs
- Delay throws
- Tape stops
- Impacts and crashes
- Vocal pickups
- When automation is the musician's to draw

## Placement at a glance

| Transition | Where it sits | Typical length |
|---|---|---|
| Riser | Ends on the downbeat, or a beat before it to leave a gap | 2–16 bars |
| Downlifter | Starts on or just after the downbeat of the calmer section | 1–4 bars |
| Reverse cymbal or crash | Its loudest point (the end) lands exactly on the downbeat | 1–2 bars |
| Reverse reverb | The swell ends exactly where the word or hit begins | 1/2–2 bars |
| Drum fill | The last beats or bar of the outgoing phrase | 1/2–2 bars |
| Snare build | The last 4–8 bars before the arrival | 4–8 bars |
| Filter sweep | Across the build, reset on the downbeat | 4–16 bars |
| Silence | Just before the downbeat | 1 beat to 1 bar |
| Delay throw | The last word or hit of a phrase | Tail over 1–2 bars |
| Tape stop | The end of a section, into silence or a new section | 1/4 beat to 1 beat |
| Impact or crash | On the downbeat | Tail over 1–4 bars |
| Vocal pickup | Starts before the downbeat and leads into it | A few beats |

## Risers and downlifters

- **Noise riser.** Noise (from Drift, Wavetable, Operator or a sample) through a high-pass or band-pass filter that rises over the build, level rising, a reverb whose wet signal grows. Add a tonal layer rising in pitch (a saw or a sine on the song's root) to make it musical.
- **High-pass the riser** at 200–500 Hz so it adds tension without adding low end; the low end should be clearing out before the arrival.
- **End it with intent.** Ending exactly on the downbeat makes a smooth arrival; ending a beat early and leaving silence makes a harder one.
- **Downlifter.** The reverse movement (falling pitch and filter, level fading) after a peak, leading into a calmer section. Often follows an impact.
- Pre-made risers the musician places from their library are fine; trim them to the build length and keep them in key if they are tonal.

## Reverse cymbals and reverse reverbs

- **Reverse cymbal.** Take a crash or cymbal sample, reverse it (the audio clip's reverse function or in a resampled copy), and place it so the end, now the loudest point, lands exactly on the downbeat. Fade its start so it swells in from silence.
- **Reverse reverb (a swell into a word or hit).**
  1. Copy the audio of the first word or hit of the new section to a separate track.
  2. Reverse it.
  3. Add a long reverb (decay 2–5 s) at 100% wet; the musician records or resamples the result to audio in Live.
  4. Reverse that recording, so the reverb tail now comes before the sound.
  5. Place it so the swell ends exactly where the original dry word or hit begins; trim and fade its start.
- High-pass the swell (200–400 Hz) so it keeps the end of the previous section clear.

## Drum fills and snare builds

- **Fills** mark the end of a phrase: a tom or snare figure in the last beats, a cymbal choke, or simply removing the kick for the last bar. The drums skill writes the patterns; the arrangement decides where they go (usually every 4 or 8 bars, bigger at section changes).
- **Snare build.** Snare or clap repeats that speed up over the last 4–8 bars: quarter notes, then eighths, then sixteenths, sometimes thirty-seconds in the last beat. Raise velocity and, optionally, pitch or a high-pass filter as it goes. Stop it for a beat before the downbeat if the arrival should hit harder.

## Filter sweeps and width changes

- **High-pass sweep in a build.** An Auto Filter on the music (a group track, or each part, with the riser left unfiltered) with a high-pass rising from about 30 Hz to 300–1000 Hz over the build, then back to fully open exactly on the downbeat. The low end returning is the impact.
- **Low-pass opening** for intros or the start of a section: from about 300–800 Hz to fully open over 8–16 bars.
- **Width change.** Narrow the music towards mono during the last bars of a build (Utility width from 100% down to around 0–50%), then back to full width on the downbeat. The sudden width makes the arrival feel bigger.

## Silence and drop-outs

- Cutting everything (or every part around the vocal) for a beat to a bar before the downbeat creates suspense and makes the return land hard.
- Make the silence real: reverb and delay tails ringing through it weaken the effect, so shorten or cut them at that moment.
- Drop-outs inside a section (removing the drums for one bar, or the bass for two beats) are small transitions that mark lyrics or phrase ends.

## Delay throws

- Send just the last word of a vocal phrase (or a single hit) to a delay with higher feedback, so the echo carries across the gap into the next section.
- Without automation: put that one word as its own clip on a new audio track sent fully to the delay return, and leave the main vocal's send as it is.
- Filter the repeats (high-pass 300–500 Hz, low-pass 4–6 kHz) so they sit behind the next section.

## Tape stops

- The sound slows down and drops in pitch to silence, like a tape machine stopping. Usually over a quarter beat to one beat at the end of a section, into silence or a new section.
- Resample the last beat to audio and make the pitch and speed fall (for example a fast downward pitch envelope in Simpler, or by re-pitching the warped clip), or set up a tape-stop plug-in the musician already has on the track.
- Use it rarely; it is a strong, recognisable effect.

## Impacts and crashes

- An impact (a low boom with a pitch drop, a noise burst, a long dark reverb) or a crash cymbal on the downbeat marks the arrival.
- Keep it from masking the kick and bass on that downbeat: high-pass the crash, keep the impact's low end short or tuned to the key.
- A downlifter after the impact eases into calmer sections.

## Vocal pickups

A vocal line that begins before the downbeat (a pickup) pulls the listener into the next section, often more naturally than any effect. When the melody allows, starting a chorus line on the last beat or two of the pre-chorus is a strong transition by itself. While the topline is still MIDI, the melody and lyrics skills can add the pickup in place and check it like any melodic change; a recorded vocal stays as it was sung.

## When automation is the musician's to draw

Most transitions work without automation: a fill, a drop-out, a clip that stops a beat early, a riser or reverse cymbal cut to length, a crash on the downbeat. A sound can carry the movement too: a riser sample trimmed to the build, a synth note whose envelopes rise over the whole build, an Auto Filter whose synced LFO does the sweep.

When a move really needs automation, which only the musician can draw, make the rest of the change and end the result line with the one move to draw, in a few words: the track and parameter, the bars, the start and end values. For example: "draw Auto Filter 30 Hz → 800 Hz on the Music group over bars 57–64, back to 30 Hz on bar 65".
