---
name: mixing-vocals
description: Mix lead vocals, doubles, harmonies, backing vocals, ad-libs and rap vocals in place in Live — high-pass and corrective EQ, serial compression, de-essing with Live's devices, presence and air, saturation, reverb and delay on returns, and making room for the vocal in the parts around it — with the checks vocals need (words clear, steady level, sibilance, mono). Read this after the mixing skill whenever a vocal is being mixed or sounds buried, harsh, sibilant, muddy, uneven, too dry or too wet.
---

# Mixing vocals

When the vocal carries the words, clarity, steady level and a natural tone can help. A buried, distorted, uneven or texture-like voice may instead be the artist's intention; use the settings below as starting points for that goal. The loop, the checks and the one-line result are in the parent mixing skill; this file holds what is specific to vocals. Change the vocal's own chain, its sends and the parts around it in place, and tune the chain that is already there, keeping one chain per vocal.

Judge every setting from the recording itself. A voice's fundamental, its problem frequencies and its sibilance depend on the singer and the melody alone; leave the singer's gender, age and background out of every judgement.

## Before processing

- **The performance comes first.** When pitch, clipping or distortion is unwanted, identify what processing can address and what may need another take. Preserve an intentionally rough performance.
- **Noise and plosives:** a gentle gate or downward expansion lowers noise between phrases (a Floor of −20 to −40 dB stays natural); a high-pass and a dynamic low band soften pops. Breaths are part of a natural vocal: turn them down and keep them.
- **Uneven phrases:** two gentle compression stages even them out more naturally than one heavy stage.

## A typical chain

1. High-pass and corrective EQ
2. Compression, stage 1: catching peaks
3. De-essing
4. Compression, stage 2: evening out the level
5. Tone EQ (presence, air)
6. Saturation, if needed
7. Sends to the reverb and delay returns

Move de-essing before the first compressor when loud sibilance makes the compressor clamp down on every "s". Every stage is optional; a well-recorded vocal in a sparse song may need only a few.

## High-pass and corrective EQ

- **High-pass** usually between 70 and 120 Hz; raise it until the voice starts to lose warmth, then back off. In dense mixes backing vocals can go higher.
- **Proximity boom** (from singing close to the microphone) shows as excess around 100–250 Hz: a broad cut of 2–4 dB.
- **Mud** at 200–400 Hz, **boxiness** at 400–800 Hz, a **nasal** tone at 800 Hz–1.5 kHz: broad or medium cuts of 2–3 dB where they bother you.
- **Harshness** at 2.5–5 kHz: a medium cut of 1–3 dB, or a dynamic cut that acts only on loud notes (a Multiband Dynamics band) if it is harsh only when the singer pushes.
- **Narrow resonances** (a ringing room or microphone): Q 4–10, cut 3–6 dB.

## Compression

Two gentle stages usually sound more natural than one heavy one.

| Stage | Device | Ratio | Attack | Release | Gain reduction |
|---|---|---|---|---|---|
| 1. Peaks | Compressor, Peak mode | 4:1–8:1 | 0.5–5 ms | 30–80 ms | 2–5 dB on the loudest moments only |
| 2. Level | Compressor in RMS mode, or Glue Compressor at ratio 2 | 2:1–3:1 | 10–30 ms (Glue: 3 or 10 ms) | 60–150 ms or Auto | 2–4 dB, fairly constant |

- A slower attack on stage 2 keeps consonants crisp; too fast dulls the words.
- **Parallel compression** for a dense, upfront vocal: a heavily compressed signal (on a return, or through Dry/Wet) blended 20–30% under the main vocal.
- Pumping, or breaths jumping up between phrases, means too much gain reduction or too fast a release.

## De-essing with Live's devices

Sibilance ("s", "sh", "t") usually sits somewhere around 5–9 kHz; find where it sits on this voice.

- **Multiband Dynamics:** the high band with its crossover around 5–6 kHz, compressing above threshold (ratio 3:1–6:1, fast attack, release 50–100 ms) so sibilant moments drop by 3–6 dB and the rest of the top end is untouched.
- **Compressor with sidechain EQ:** a band-pass on the sibilance in the sidechain EQ turns the whole signal down on each "s". Good for light de-essing; heavier settings dull the voice.
- **The musician's de-esser plug-in**, when it is on the vocal track, is usually the most transparent option.
- Too much de-essing makes the singer lisp; judge whole phrases, the sounds around each "s" included.
- Sibilance gets worse in reverb and when vocals are stacked: send to the reverb from after the de-esser, or de-ess the reverb return, and de-ess backing vocals more than the lead.

## Tone, saturation and level

- **Presence:** a broad lift of 1–3 dB somewhere in 2–5 kHz helps a vocal cut; carving the competing instruments in that range often works better than boosting the vocal.
- **Air:** a high shelf of 1–3 dB from 10–12 kHz adds openness; check that sibilance stays tamed.
- **Warmth for a thin voice:** a small, broad lift around 150–300 Hz.
- **Saturation:** Saturator (Soft Sine or Analog Clip, drive 1–4 dB, output matched) or Roar (Tube Preamp, low amount) adds harmonics that help the vocal be heard at a lower level. Watch harshness and sibilance.
- **Level:** the vocal should feel steady against the music. Choruses often need it slightly louder because the music is denser; when one phrase drops out and the ride is beyond what you can write, name the bars in the result line.

## Space: reverb and delay

- **Plate-like reverb** on a return: decay 1.2–2.5 s, pre-delay 20–80 ms (or a short note value), high-pass 300–500 Hz and low-pass 6–9 kHz on the tail. Pre-delay keeps the words clear of the reverb.
- **Short room** (0.4–1 s) at a low level puts the voice in the same space as the band without sounding obviously wet.
- **Delay:** quarter or dotted eighth, feedback 15–35%, repeats filtered to roughly 300 Hz–5 kHz. A slapback (one repeat at 80–140 ms) gives a close, vintage feel.
- **Duck the returns** with the dry vocal as the key (or Echo's ducking), so tails bloom between phrases and stay out of the words.
- **Throws:** extra delay or reverb on the last word of a line, for emphasis and to carry into the next section.
- **Match the amount to the song:** sparse songs can carry more reverb; dense songs need less, with more pre-delay. Verses can be drier and choruses wetter to add size.

## Doubles, harmonies and backing vocals

- **Tuck them under the lead,** often 6–12 dB lower, so they support it.
- **Thin them:** high-pass higher than the lead (150–300 Hz in dense mixes) and cut a little low-mid body; the lead keeps the weight.
- **Pan for width:** doubles left and right (or one centred double to thicken the lead), harmonies spread, ad-libs off-centre.
- **Compress and de-ess more** than the lead; stacked parts multiply sibilance and level jumps.
- **Group them** on a backing-vocal bus with shared compression, EQ and reverb so they act as one section, sent a little wetter than the lead to sit them further back.
- **Timing:** doubles sound best when word starts and consonant endings line up. Timing edits on recorded vocals are the musician's: name the words that flam in the result line.

## Dense, rhythmic vocals (rap and spoken parts)

- Usually drier and closer: a short room or slapback carries the space, with delay throws for emphasis.
- A more consistent level: a little more compression, so every syllable is heard.
- Clear consonants: presence around 2–5 kHz, carved out of the beat where needed.
- Doubles or stacks on key words, tucked under and panned, add weight to line endings.

These follow from word density alone; apply them to any vocal that is dense and rhythmic, whatever its genre.

## Pitch correction

Pitch correction is a creative and taste decision. Apply it only when the musician asks, with their own plug-in, which they add to the vocal track, and say whether the setting is meant to be transparent or audible.

## Demo vocals


## Making room for the vocal

- First the arrangement: parts playing in the vocal's octave, counter-melodies on top of words (arrangement skill).
- Then carve: cut 2–3 dB around the vocal's presence range on pads, guitars, keys and leads.
- For overlap that comes and goes: Multiband Dynamics on the competing part, keyed by the vocal, dipping its mid band by 1–3 dB only while the vocal sings.

## Vocal checks

These add to the parent skill's checks.

| Check | What to review |
|---|---|
| Words clear | Review intelligibility in actual processed context when requested; 2–5 kHz overlap alone does not establish masking or require a cut |
| Steady level | Compare actual processed phrases with the intended dynamics; compressor and fader settings alone do not prove a steadier performance |
| Sibilance | Locate unwanted sibilance on this recording, then audition its reduction; 5–9 kHz and 3–6 dB are starting ranges rather than required settings |
| Mono | Review the actual summed vocal and surrounding effects for the playback goal; centre panning is one approach, not proof of mono compatibility |

## Example

The musician selects the Lead Vox track over guitar and piano and types "harsh, and the s's spit". The vocal peaks around 3 kHz on loud notes and has strong sibilance near 7 kHz; its first compressor reacts to every "s". In place on the vocal's chain: Multiband Dynamics before the compressor, high band from about 6 kHz taking 3–5 dB off the sibilants; a 2–3 dB dynamic cut around 3 kHz that acts only on loud notes; the plate return's high cut lowered to about 7 kHz. Result: "S's tamed: de-esser before the compressor, −4 dB above 6 kHz on sibilants, plate darker at 7 kHz · de-esser set on the sibilance the analysis found near 7 kHz, acting only on the s's."
