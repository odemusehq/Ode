---
name: mastering
description: Master the song in place in Ableton Live — build or tune the mastering chain on the Main track (Utility, EQ Eight, Glue Compressor, Multiband Dynamics when needed, saturation or a clipper, Limiter) with Live's devices or the musician's mastering plug-ins, aimed at the loudness target (around −14 LUFS integrated and −1 dBTP for streaming, or the loudness target in the musician's settings for club, CD or other uses) — then measure integrated and short-term loudness, true peak and mono on the Main track, check that the song keeps its dynamics, and report the measured numbers in one line. Use this whenever the musician clicks "Master for streaming", asks for a master, says the song is too quiet, too loud or squashed next to other songs, mentions LUFS, true peak, a limiter, streaming, club or CD versions, or is getting ready to export for release, even if they never say "mastering".
---

# Mastering

Mastering is the last stage before release: a consistent, flattering tonal balance, controlled dynamics, a loudness that suits the music and where it will be played, and peaks that survive encoding. Good mastering is mostly small moves made with care. Big problems (a buried vocal, a boomy bass, a harsh synth) are mix problems: fix them in the mix, which in Live is one step away, rather than bending the whole master around them.

Ode masters in place on the Main track: it builds the chain once and tunes its values on later requests, rather than stacking another chain on top.

## The loop

1. **Read.** The Main track's devices (the Ode device, any chain the musician already has, Master-bus processing their sound depends on), the target (named in the request — streaming, club, CD — or else the loudness target in the musician's settings), the genre, the sections and which one is loudest, and anything locked (a locked mix means the Main track chain only). Measure before changing anything: integrated loudness over the whole song, short-term loudness and true peak in the loudest section, and the spectrum.
2. **Decide** what the master needs, in plain words ("a little dull above 8 kHz, the low end booms on two notes, about 5 dB below the target"), and which stages of the chain solve it. When a small mix fix is clearly better (one boomy bass note), make it with the mixing skill and say so in the result line.
3. **Change it in place**, as one undo step:
   - Build the chain on the Main track before the Ode device and keep the Ode device last: it measures what reaches it, so a device after it would go unmeasured.
   - Use only the stages the song needs, in the order below. On later requests, tune the chain that is there; when the musician has their own chain, tune it rather than adding another.
   - Raise the Limiter's gain until the target is reached or the music starts to suffer, whichever comes first.
4. **Verify** with the checks below, fixing until they pass (up to three rounds); otherwise the result line says what still fails. Measure after the last change, and never give a loudness or peak figure that wasn't measured.
5. **Let them hear it.** When your turn ends, Ode plays the loudest section. Don't start playback for that yourself.
6. **Report in one line** with the measured numbers. For example:
   - "Mastered for streaming: EQ Eight, Glue 1.5 dB, Limiter at −1 dBTP · −14.1 LUFS integrated, −1.2 dBTP, chorus still 2 LU above the verse."
   - "Limiter eased 2 dB, Saturator clipping shaves the kick peaks · −9.0 LUFS, −1.0 dBTP, kick clean again."
   - "Low end steadier: low band compressed 1.5 dB on the booming notes · −14.0 LUFS, −1.1 dBTP, mono holds."

**Again** is another take: the Set is back as it was, so make a clearly different master on the same target (more glue and less limiting, a darker or brighter balance), not the same chain nudged.

**Outside the usual style.** When a master goes beyond the artist's usual releases (much denser, much brighter), the result line says so.

## Checks

| Check | When | Correct when |
|---|---|---|
| Loudness | Every change | Integrated loudness over the whole song is within ±1 LU of the target. Tune with the loudest section's short-term loudness, then confirm over the whole song: a short stretch gives the wrong integrated number |
| True peak | Every change | At or below the ceiling: −1 dBTP for streaming, −2 dBTP for masters louder than about −14 LUFS, below 0 dBTP with a margin for club and CD |
| Dynamics | Limiter and compression changes | The chorus or drop still measures louder than the verse, and another dB of limiter gain still buys close to a dB of loudness. When it buys clearly less, the limiter is flattening the peaks: stop there |
| Tonal balance | EQ changes | The spectrum moved the way the plan said (air up, low end steadier) and no further; against a reference the musician supplied, compared at matched loudness |
| Mono | Width or mid/side changes, and the final check | Summed to mono, the master loses no more than about 3 LU and the low end holds |

## Questions

The target comes from the request or from the musician's settings, so don't ask how loud. When the musician says how loud they want their masters (a LUFS figure, "club loud"), store it as their loudness target setting. Mastering changes are edits in place that Undo reverses, and the mode decides whether a change waits for Apply. Ask one line with buttons only when the answer changes what you would do: the fix would mean removing Master processing the musician put there themselves, rather than tuning it.

## Preparing the mix

- **Headroom:** the mix peaks around −6 to −3 dBFS with nothing clipping. When it doesn't, bring the mix levels down first (mixing skill) rather than trimming the problem away at the master.
- **No limiter doing the work on the mix.** Master-bus processing the musician's sound depends on (a clipper or glue compressor they love) stays; the chain goes after it, knowing it is there.

## The chain

A typical order, using only the stages the song needs. Mastering moves are small: EQ moves usually 0.5–2 dB, compression 1–2 dB of gain reduction.

1. **Utility** — trim the input so the chain sees a sensible level.
2. **EQ Eight, corrective** — a gentle low cut (12 dB/octave around 20–30 Hz) only if there is rumble below the music; narrow cuts for resonances; mid/side moves only with a clear reason.
3. **Glue Compressor** — ratio 2, attack 10 or 30 ms, release Auto, 1–2 dB of gain reduction on the loud parts. A high-pass on its sidechain (around 80–150 Hz) stops the kick and bass from pumping the whole mix.
4. **Multiband Dynamics, only when needed** — when one band misbehaves (low end booming on some notes, a harsh top on loud passages): gentle ratios (1.5:1–3:1), 1–2 dB on that band only.
5. **Saturation, optional** — Saturator or Roar at low settings for density and a little loudness without peak level; a clipper (the musician's clipper plug-in, or Saturator's clipping set carefully) can shave 1–2 dB off the sharpest peaks so the limiter works less.
6. **EQ Eight, tonal** — broad shelves or bells of 0.5–1.5 dB to set the final balance.
7. **Limiter, last before the Ode device** — ceiling −1 dB for streaming (with true-peak limiting where the Limiter offers it, and true peak measured either way); gain raised until the target is reached or the sound starts to suffer.

Third-party mastering plug-ins are welcome when the musician has them; the same order and the same small moves apply. Detailed settings for each device, with reasons, are in `references/chain-settings.md`.

## Loudness and true peak

**Loudness normalisation changes the question.** Most streaming services turn loud tracks down to a reference level for playback, and some raise quiet ones only as far as their peak headroom allows. A master much louder than the platform's reference gets turned down, keeping its squashed dynamics without being any louder for the listener.

**Typical values** (platforms publish and occasionally change them):
- Streaming in general: around **−14 LUFS integrated** with a **−1 dBTP** true-peak ceiling is a common, safe target.
- Apple Music normalises to around −16 LUFS; a −14 LUFS master is simply turned down a little.
- Masters louder than about −14 LUFS are safer with a −2 dBTP ceiling, because lossy encoding adds peaks.
- Club play, DJ use, CD and downloads have no normalisation: loudness is an artistic choice, but true peaks still need a margin below 0 dBTP.

**The music decides.** The target is the default, but a dense club track may sound right at −9 to −7 LUFS, while an acoustic ballad may sound best at −14 to −16 LUFS or lower. Stop where the song still breathes. Per-platform details are in `references/loudness-targets.md`.

## Keeping dynamics

- **Watch the limiter.** Regularly taking off more than about 3–4 dB, it costs punch and clarity. Get loudness earlier (gentle compression, saturation, a clipper, or a mix fix) or accept a lower target.
- **The drums still hit.** If the kick and snare soften or crackle, back off.
- **The song keeps its shape.** The chorus still feels bigger than the verse; mastering narrows the gap between peak and average level a little, not a lot.

## Translation

- Mono and small speakers: summed to mono nothing important vanishes; on small speakers the bass is carried by its harmonics (low-end mixing sub-skill).
- The very start and end: fade-ins and tails complete, no clicks, a sensible amount of silence.
- Lossy encoding (as streaming uses) adds peaks; −1 dBTP, or −2 dBTP for loud masters, leaves room for it.

## Exporting

Settings for the final files, which the release skill checks:
- **Main master:** WAV or AIFF, 24-bit at the project's sample rate (44.1 or 48 kHz) unless the distributor asks otherwise; the full song including tails; normalisation off.
- **Dither** only when reducing bit depth, once, as the very last step (16-bit for CD); never on 32-bit float files.
- **No MP3s to distributors;** they encode from the WAV.
- **Alternate versions** (instrumental, clean or radio edit, a cappella) go through the same chain with the same settings so they match; a club master gets its own limiter settings.
- **File names** carry the title, version and format, for example "Title - Main Master - 24bit 44k1.wav".

When a master is done, the result line can end with these settings in a few words ("export 24-bit WAV, normalisation off").

## Albums and EPs

Master the songs as a set: similar perceived loudness and tonal character from track to track (not identical LUFS numbers; a quiet ballad should still feel quieter than the single), consistent ceilings, and gaps and transitions that suit the sequence.

## Reference files

| File | Read when |
|---|---|
| `references/loudness-targets.md` | Choosing a loudness and true-peak target for a platform or format, or answering "why?" about normalisation |
| `references/chain-settings.md` | Setting up EQ Eight, Glue Compressor, Multiband Dynamics, Saturator, Roar, Limiter or Utility on a master, with starting values and reasons |
