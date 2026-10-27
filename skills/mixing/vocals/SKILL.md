---
name: mixing-vocals
description: Mix lead vocals, doubles, harmonies, backing vocals, ad-libs and rap vocals in Live — clean-up, level rides, high-pass and corrective EQ, serial compression, de-essing with Live's devices, tone, saturation, reverb and delay on returns, and making room for the vocal in the mix. Read this whenever vocals are being mixed or a vocal sounds buried, harsh, sibilant, muddy, uneven, too dry or too wet, after the general mixing skill.
---

# Mixing vocals

The vocal usually carries the song: the words must be clear, the level steady, the tone natural, and the voice in front of the music without sounding pasted on top. This sub-skill holds what is specific to vocals; the general approach (measure, one change at a time, matched-level comparisons, locked parts) is in the parent mixing skill.

Judge every setting from the recording itself. A voice's fundamental, its problem frequencies and its sibilance depend on the singer and the melody, never on assumptions about the singer's gender, age or background.

## Before processing

- **Listen to the performance first.** Mixing can't fix a take the musician isn't happy with; say so if a line would be better re-recorded or replaced with another take.
- **Clean up.** Remove noise and bumps between phrases with clip edits or a gentle gate. Turn breaths down rather than deleting them; a vocal without breaths sounds unnatural. Remove clicks and mouth noises. Lower plosive pops with clip gain or a high-pass on that moment.
- **Even out the level before compression.** Use clip gain to bring loud and quiet phrases closer together. Compressors then work less and sound more natural.

## A typical chain

1. High-pass and corrective EQ
2. Compression, stage 1: catching peaks
3. De-essing
4. Compression, stage 2: evening out the level
5. Tone EQ (presence, air)
6. Saturation, if needed
7. Sends to reverb and delay returns

Move de-essing before the first compressor when loud sibilance makes the compressor clamp down on every "s". Every stage is optional; a well-recorded vocal in a sparse song may need only a few of them.

## High-pass and corrective EQ

- **High-pass** usually between 70 and 120 Hz; raise it until the voice starts to lose warmth, then back off. In dense mixes, backing vocals can go higher.
- **Proximity boom** (from singing close to the microphone) shows as excess around 100–250 Hz: a broad cut of 2–4 dB.
- **Mud** at 200–400 Hz, **boxiness** at 400–800 Hz, **nasal** tone at 800 Hz–1.5 kHz: broad or medium cuts of 2–3 dB where they bother you.
- **Harshness** at 2.5–5 kHz: a medium cut of 1–3 dB, or a dynamic cut only on loud notes (a Multiband Dynamics band) if it's only harsh when the singer pushes.
- **Narrow resonances** (a ringing room or microphone): Q 4–10, cut 3–6 dB.

## Compression

Two gentle stages usually sound more natural than one heavy one.

| Stage | Device | Ratio | Attack | Release | Gain reduction |
|---|---|---|---|---|---|
| 1. Peaks | Compressor, Peak mode | 4:1–8:1 | 0.5–5 ms | 30–80 ms | 2–5 dB on the loudest moments only |
| 2. Level | Compressor in RMS mode, or Glue Compressor at ratio 2 | 2:1–3:1 | 10–30 ms (Glue: 3 or 10 ms) | 60–150 ms or Auto | 2–4 dB, fairly constant |

- A slower attack on stage 2 keeps consonants crisp; too fast dulls the words.
- **Parallel compression** for a dense, upfront vocal: a heavily compressed copy (on a return or through Dry/Wet) blended 20–30% under the main vocal.
- If you hear pumping or breaths jumping up between phrases, reduce gain reduction or slow the release.

## De-essing with Live's devices

Sibilance ("s", "sh", "t") usually sits somewhere around 5–9 kHz; find the exact area on this voice by ear.

- **Multiband Dynamics:** use the high band with the crossover around 5–6 kHz, compress above threshold (ratio 3:1–6:1, fast attack, release 50–100 ms) so sibilant moments drop by 3–6 dB and the rest of the top end is untouched.
- **Compressor with sidechain EQ:** set the sidechain EQ to a band-pass on the sibilance; the whole signal turns down on each "s". Good for light de-essing; heavier settings dull the voice.
- **The musician's de-esser plug-in**, if they have one, is usually the most transparent option.
- Too much de-essing makes the singer sound lisping; listen to whole phrases, not just the "s".
- Sibilance gets worse in reverb and when vocals are stacked: send to the reverb from after the de-esser, or de-ess the reverb return, and de-ess backing vocals more than the lead.

## Tone, saturation and level

- **Presence:** a broad lift of 1–3 dB somewhere in 2–5 kHz helps a vocal cut; carving the competing instruments in that range often works better than boosting the vocal.
- **Air:** a high shelf of 1–3 dB from 10–12 kHz adds openness; check that sibilance doesn't come back.
- **Warmth for a thin voice:** a small, broad lift around 150–300 Hz.
- **Saturation:** Saturator (Soft Sine or Analog Clip, drive 1–4 dB, output matched) or Roar (Tube Preamp, low amount) adds harmonics that help the vocal be heard at a lower level. Watch harshness and sibilance.
- **Level rides:** the vocal should feel steady against the music, so ride phrases and dipping words with clip gain or automation. Choruses often need the vocal slightly louder because the music is denser. Check at low volume: every word should still be understood.

## Space: reverb and delay

- **Plate-like reverb** on a return: decay 1.2–2.5 s, pre-delay 20–80 ms (or a short note value at the tempo), high-pass 300–500 Hz and low-pass 6–9 kHz on the tail. Pre-delay keeps the words clear of the reverb.
- **Short room** (0.4–1 s) at a low level puts the voice in the same space as the band without sounding obviously wet.
- **Delay:** 1/4 or 1/8 dotted, feedback 15–35%, repeats filtered to roughly 300 Hz–5 kHz. A slapback (one repeat at 80–140 ms) gives a close, vintage feel.
- **Duck the returns** with the dry vocal as the sidechain (or Echo's ducking) so tails bloom between phrases instead of under the words.
- **Throws:** extra delay or reverb on the last word of a line, for emphasis and to carry into the next section.
- **Match the amount to the song:** sparse songs can carry more reverb; dense songs need less, with more pre-delay. Verses can be drier and choruses wetter to add size.

## Doubles, harmonies and backing vocals

- **Tuck them under the lead,** often 6–12 dB lower, so they support rather than compete.
- **Thin them:** high-pass higher than the lead (150–300 Hz in dense mixes) and cut a little low-mid body; the lead keeps the weight.
- **Pan for width:** doubles left and right (or one centred double to thicken the lead), harmonies spread, ad-libs placed off-centre.
- **Compress and de-ess more** than the lead; stacked parts multiply sibilance and level jumps.
- **Group them** on a backing-vocal bus with shared compression, EQ and reverb so they act as one section, and send a little more reverb than the lead to sit them further back.
- **Tight timing:** doubles sound best when word starts and the ends of consonants line up; suggest trimming word endings and aligning starts where they flam. Timing edits on recorded vocals go through the musician.

## Dense, rhythmic vocals (rap and spoken parts)

- Usually drier and closer: a short room or slapback rather than long reverb, with delay throws for emphasis.
- More consistent level: a bit more compression, and careful rides so every syllable is heard.
- Clear consonants: presence around 2–5 kHz, carved out of the beat if needed.
- Doubles or stacks on key words, tucked under and panned, add weight to the line endings.

These follow from word density, not from the genre's label; apply them to any vocal that is dense and rhythmic.

## Pitch correction

Pitch correction is a creative and taste decision. Suggest it only when asked or when a note is clearly off, use the musician's own plug-in, and say whether the setting is meant to be transparent or audible. Never apply it by default.

## Demo vocals

A demo vocal sung by a voice model in the artist's own voice is mixed like any vocal, but keep it clearly named as a demo. Listen for artefacts typical of generated voices (metallic or smeared consonants, odd breaths), and keep the processing light so the musician hears the melody and lyric, not the mix.

## Making room for the vocal

- First look at the arrangement: parts playing in the vocal's octave, counter-melodies on top of words.
- Then carve: cut 2–3 dB around the vocal's presence range on pads, guitars, keys and leads.
- For overlap that comes and goes: Multiband Dynamics on the competing part, keyed by the vocal, dipping its mid band by 1–3 dB only while the vocal sings.
- Check masking between the vocal and each competing part after every change.

## Checks

- Every word is clear at low volume and on small speakers.
- Level feels steady from verse to chorus; no phrase drops out or jumps forward.
- Sibilance controlled, including in the reverb and in stacked parts.
- No pumping, no breaths jumping up between phrases.
- The vocal sits in front of the music and in the same space, not pasted on top.
- The lead vocal stays centred and solid in mono.

## Worked example

"The vocal is harsh and the s's spit." A lead vocal over acoustic guitar and piano. Measurements show peaks in the vocal around 3 kHz on loud notes and strong sibilance near 7 kHz; the stage-1 compressor reacts to every "s". Steps, one at a time: move de-essing before the compressor using Multiband Dynamics (high band from about 6 kHz, 3–5 dB of reduction on sibilants); add a dynamic cut of 2–3 dB around 3 kHz that only acts on loud notes; then lower the plate send's high cut to about 7 kHz so the reverb stops splashing on "s". Report each change and ask the musician to listen to the second verse, where it was worst.
