---
name: mastering
description: Master a song in Ableton Live with Live's devices (EQ Eight, Glue Compressor, Multiband Dynamics, Saturator, Limiter, Utility) or the musician's mastering plug-ins — preparing the mix, building and tuning the chain, loudness (LUFS) and true peak targets per release platform, measuring before and after every change, keeping dynamics, checking translation, and exporting the right files. Use this whenever the musician wants a master, asks how loud the song should be, mentions LUFS, true peak, a limiter, streaming, club or CD versions, says the song is too quiet or squashed compared with others, or is ready to export for release, even if they never say "mastering".
---

# Mastering

Mastering is the last stage before release: a consistent, flattering tonal balance, controlled dynamics, a loudness that suits the music and where it will be played, peaks that survive encoding, and correctly exported files. Good mastering is mostly small moves made with care. Big problems (a buried vocal, a boomy bass, a harsh synth) are mix problems; fix them in the mix, which in Live is usually one click away, rather than bending the whole master around them.

The musician is the author. Measure before and after every change, compare at matched loudness, change one stage at a time, explain each change in a sentence with the values, and keep the chain easy to bypass. Leave locked parts alone, including a locked mix: work only on the mastering chain unless the musician unlocks something.

## How to work

1. **Check the mix is ready** (next section).
2. **Listen to the whole song and measure it:** integrated loudness over the full song, short-term loudness in the loudest section, true peak, and the spectrum. Compare the tonal balance with two or three loudness-matched reference tracks the musician likes.
3. **Write down what the master needs** in plain words: "a little dull above 8 kHz, the low end booms on two notes, quite dynamic, needs about 5 dB more loudness for streaming".
4. **Build the chain one stage at a time**, each only if it solves something on that list.
5. **Measure after each stage** and compare with the stage bypassed at matched loudness.
6. **Check translation** (speakers, mono, low volume, after encoding).
7. **Export** the right files and measure the exported files again.

## Preparing the mix

- **Headroom:** the mix should peak around −6 to −3 dBFS with no clipping anywhere.
- **No limiter on the mix bus while mixing.** A limiter hides overs and squashes the loud parts the mix is being balanced on. If the musician's sound depends on Master-bus processing (a clipper or glue compressor they love), keep it as part of the mix and master on top of it, knowing it's there.
- **Where to master:**
  - *On the Master track of the mix Set:* quick, and mix fixes stay one step away. Good for checking and iterating.
  - *In a new Set with the bounced mix:* cleaner and lighter on CPU, and the master can't change if someone touches the mix. Better for the final release master.
- **Bouncing the mix:** WAV at the project's sample rate, 24-bit or 32-bit float, full length including reverb and delay tails, normalisation off, no dither on 32-bit float. Listen to the bounce's start and end for clicks or cut-off tails.

## The chain

A typical order, using only the stages the song needs. Mastering moves are small: EQ moves are usually 0.5–2 dB, compression 1–2 dB of gain reduction.

1. **Utility** — trim the input so the chain sees a sensible level.
2. **EQ Eight, corrective** — a gentle low cut (12 dB/octave around 20–30 Hz) only if there is rumble below the music; narrow cuts for resonances; mid/side moves only when there's a clear reason.
3. **Glue Compressor** — ratio 2, attack 10 or 30 ms, release Auto, 1–2 dB of gain reduction on the loud parts. A high-pass on its sidechain (around 80–150 Hz) stops the kick and bass from pumping the whole mix.
4. **Multiband Dynamics, only when needed** — when one band misbehaves (low end booming on some notes, harsh top on loud passages): gentle ratios (1.5:1–3:1), 1–2 dB on that band only.
5. **Saturation, optional** — Saturator or Roar at low settings for density and a little loudness without peak level; a clipper (the musician's clipper plug-in, or Saturator's clipping curves set carefully) can shave 1–2 dB off the sharpest peaks so the limiter works less.
6. **EQ Eight, tonal** — broad shelves or bells of 0.5–1.5 dB to set the final balance against the references.
7. **Limiter, last** — ceiling −1 dBTP for streaming (use its true peak mode where your version of Live has one, and measure true peak either way); raise the gain until the target is reached or the sound starts to suffer, whichever comes first.

Third-party mastering plug-ins are welcome when the musician has them; the same order and the same small moves apply. Detailed settings for each device, with reasons, are in `references/chain-settings.md`.

## Loudness and true peak

**Loudness normalisation changes the question.** Most streaming services turn loud tracks down to a reference level for playback, and some raise quiet ones only as far as their peak headroom allows. A master much louder than the platform's reference gets turned down, keeping its squashed dynamics without being any louder for the listener. Past that point, extra loudness buys nothing but a different sound.

**Typical values** (platforms publish and occasionally change these; confirm the current figure when precision matters):
- Streaming in general: around **−14 LUFS integrated** with a **−1 dBTP** true peak ceiling is a common, safe target.
- Apple Music normalises to around −16 LUFS; a −14 LUFS master is simply turned down a little.
- Masters louder than about −14 LUFS are safer with a −2 dBTP ceiling, because lossy encoding adds peaks.
- Club play, DJ use, CD and downloads have no normalisation: loudness is an artistic choice, but true peaks still need a margin below 0 dBTP.

**The music decides.** The loudness target set in Personalisation is the default, but a dense club track may sound right at −9 to −7 LUFS, while an acoustic ballad may sound best at −14 to −16 LUFS or lower. Stop where the song still breathes. Per-platform details are in `references/loudness-targets.md`.

## Measuring before and after

- Measure the unprocessed mix first: integrated loudness over the whole song, short-term loudness of the loudest section, true peak, spectrum.
- After each stage, measure again; report the readings exactly as measured, for example: "Integrated −13.9 LUFS, chorus short-term −10.8 LUFS, true peak −1.1 dBTP."
- Integrated loudness needs the whole song; a 30-second loop gives the wrong number. Use short-term loudness while adjusting, then confirm over the full song.
- **Compare at matched loudness.** When judging the chain against the bypassed mix, turn the processed signal down to the same loudness (a Utility after the limiter, only while comparing). Louder always sounds better; matched comparisons tell you whether the master is actually better.
- Measure the exported file too: export settings and sample-rate conversion can change true peak.

## Keeping dynamics

- **Watch the limiter.** If it is regularly taking off more than about 3–4 dB, punch and clarity usually suffer. Get loudness earlier (gentle compression, saturation, a clipper, or a mix fix) or accept a lower target.
- **Listen to the drums.** The kick and snare should still hit; if they soften or crackle, back off.
- **Keep the song's shape.** The chorus should still feel bigger than the verse. Check the gap between peak and average level (crest factor) before and after: mastering usually narrows it a little, not a lot.

## Checking translation

- Listen on everything available: monitors, headphones, earbuds, a laptop or phone speaker, a car.
- Listen quiet (does it still hold together?) and in mono (nothing important vanishes).
- Compare with loudness-matched references for tonal balance only: brightness, low end, overall weight. Don't chase another record's sound.
- Check the very start and end: fade-ins, tails, no clicks, a sensible amount of silence.
- Lossy encoding (as streaming uses) adds peaks; −1 dBTP, or −2 dBTP for loud masters, leaves room for it.

## Exporting

- **Main master:** WAV (or AIFF), 24-bit at the project's sample rate (44.1 or 48 kHz) unless the distributor asks otherwise; full song including tails; normalisation off.
- **Dither** when reducing bit depth, once, as the very last step. On 16-bit files (for example for CD) it matters, so use it; on 24-bit files it makes little audible difference and either choice is accepted. Don't dither a file twice, and don't dither 32-bit float files.
- **Don't send MP3s to distributors;** they encode from your WAV.
- **Alternate versions** (instrumental, clean or radio edit, a cappella, a club master) go through the same chain with the same settings so they match; a club master usually gets its own limiter settings.
- Name files clearly with title, version and format (for example, "Title - Main Master - 24bit 44k1.wav").

## Albums and EPs

Master the songs as a set: similar perceived loudness and tonal character from track to track (not identical LUFS numbers; a quiet ballad should still feel quieter than the single), consistent ceilings, and gaps and transitions that suit the sequence.

## Offering options

When the direction is a matter of taste (how loud, how bright, how much glue), offer three masters that differ in one clear way, at matched loudness for listening, and label one as outside the artist's usual style, judged only from their own past releases and stated preferences. For example: a dynamic master at −14 LUFS, a fuller one at −11 LUFS, and, outside their usual style, a darker, denser master with more saturation.

## Checks before release

- Integrated loudness and true peak measured on the exported file and within the target.
- Limiter not working harder than the song can take; transients intact.
- Tonal balance sensible against loudness-matched references; translates on small speakers, in mono and at low volume.
- Start and end clean; tails complete.
- Correct format, bit depth, sample rate; dither only where bit depth was reduced.
- Alternate versions match the main master.
- Locked parts untouched.

## Worked examples

**A dynamic acoustic song for streaming.** The mix peaks at −4.2 dBFS and measures −19.5 LUFS integrated. Plan: EQ Eight with a 12 dB/octave low cut around 25 Hz and a 1 dB shelf around 10 kHz for air; Glue Compressor at ratio 2, 10 ms attack, Auto release, 1 dB of gain reduction; Limiter with a −1 dBTP ceiling, gain raised until around −14 to −15 LUFS integrated while the limiter takes no more than 2–3 dB on the loudest strums. Measure after each stage, compare with the mix at matched loudness, and explain that Apple Music will play it slightly quieter (around −16 LUFS) and that's fine.

**A club master and a streaming master.** A techno track reads −7.8 LUFS integrated and +1.2 dBTP, and the kick crackles. The true peak overs and the crackle both point to the limiter being driven too hard. For the club master: reduce limiter gain until the kick is clean, shave peaks with a clipper before the limiter if needed, keep the ceiling at −1 dBTP, and accept the loudness where the kick stays clean (often somewhere around −9 to −8 LUFS for dense material). For the streaming master: the same chain with less limiter gain, aiming nearer −14 to −10 LUFS with a −1 to −2 dBTP ceiling; it will be turned down to the platform's reference anyway, so the cleaner version will sound punchier there. Measure both exported files.

## Reference files

| File | Read when |
|---|---|
| `references/loudness-targets.md` | Choosing a loudness and true peak target for a platform or format, or explaining normalisation to the musician |
| `references/chain-settings.md` | Setting up EQ Eight, Glue Compressor, Multiband Dynamics, Saturator, Roar, Limiter or Utility on a master, with starting values and reasons |
