# Mastering chain settings

Starting values and reasons for each device on a master. Mastering moves are small; if a stage needs large settings, the mix probably needs a fix instead. Keep each stage's output level close to its input so bypassing a stage compares like with like.

## Contents
- Utility
- EQ Eight
- Glue Compressor (and Compressor as an alternative)
- Multiband Dynamics
- Saturator and Roar
- Clipping before the limiter
- Limiter
- Order and gain staging
- Things to keep off the master

## Utility

- **First in the chain:** trim the input so the following stages see a sensible level (peaks around −6 to −3 dBFS).
- **Bass Mono:** only if the mix has wide low end that shouldn't be there; set it low (around 80–120 Hz) and check that intentionally wide low parts aren't harmed. Better fixed in the mix.
- **Width:** small changes only (around 90–110%); check mono after any change.
- **After the limiter, while comparing:** lower the gain to match the unprocessed loudness for a fair comparison, then remove it.

## EQ Eight

| Job | Settings | Why |
|---|---|---|
| Rumble below the music | Low cut 12 dB/oct around 20–30 Hz | Removes energy nobody hears that still uses headroom; only if the mix has it |
| Resonance or a harsh spot | Bell, Q 2–6, cut 0.5–2 dB | Small cuts change a whole mix noticeably |
| Air | High shelf around 10–12 kHz, +0.5–1.5 dB | Openness without harshness |
| Weight | Low shelf around 60–100 Hz, ±0.5–1.5 dB | Sets the low-end balance against references |
| Tighter low end | M/S mode, low cut on the Side channel around 100–200 Hz | Keeps the low end mono without touching the centre |
| More width in the top | M/S mode, high shelf on the Side channel, +0.5–1 dB | Brightens the edges without making the centre harsh |

- Turn on oversampling for high-frequency boosts so the curve stays accurate near the top of the range.
- Scale is a quick way to try a whole curve at half or double strength.
- Corrective EQ usually goes before compression; tonal EQ often after it, so tonal boosts don't drive the compressor.

## Glue Compressor (and Compressor as an alternative)

| Setting | Start from | Why |
|---|---|---|
| Ratio | 2 | Gentle enough to be transparent on a full mix |
| Attack | 10 or 30 ms (Compressor: 10–30 ms) | Lets transients through, so the master keeps its punch |
| Release | Auto, or 0.2–0.4 s | Auto adapts to the material; a fixed release can be timed to the groove |
| Threshold | 1–2 dB of gain reduction on the loud parts | Glue, not squash |
| Sidechain EQ | High-pass around 80–150 Hz | The kick and bass stop pumping the whole mix |
| Range | Limit the maximum gain reduction to a few dB | A safety net against overdoing it |
| Soft Clip | Off, unless its sound is wanted | It changes how peaks sound |
| Dry/Wet | 100%, or 50–70% for parallel glue | Parallel keeps more of the original dynamics |

**Compressor instead:** RMS mode, ratio 1.5:1–2:1, a soft knee (6–12 dB), attack 10–30 ms, release 100–300 ms or Auto, 1–2 dB of gain reduction.

## Multiband Dynamics

Use only when one frequency range misbehaves on its own: a low end that booms on some notes, a top end that gets harsh only in loud passages.

- Crossovers set around the problem, for example 120–200 Hz for the low band and 2.5–5 kHz for the high band.
- Compress above threshold with gentle ratios (1.5:1–3:1); 1–2 dB of gain reduction on the problem band only; other bands left at 1:1.
- Slower attack and release on the low band (low frequencies need time: attack 10–30 ms, release 100–300 ms); faster on the high band.
- Use the global Amount control to dial the whole effect back.
- Avoid upward compression on a master: it raises noise, reverb tails and hiss, and flattens the mix. Heavy multiband presets made for sound design don't belong here.

## Saturator and Roar

- **Saturator:** Analog Clip or Soft Sine, drive 0.5–3 dB, output lowered to match, Dry/Wet 20–60%. Adds density and a little loudness for the same peak level. Turn on the high-quality (oversampling) option where available to keep the top end clean.
- **Roar:** one stage, Tube Preamp or Soft Sine shaper at a low amount, Dry/Wet for parallel use. Multiband routing can colour only the mids and highs while the low end stays clean.
- Listen for harshness around 2–5 kHz and for the low end getting woolly; both mean too much.

## Clipping before the limiter

Shaving the sharpest peaks before the limiter lets the limiter work less, which often sounds cleaner than limiting alone.
- Use the musician's clipper plug-in, or Saturator with a clipping curve, set so it only touches the peaks.
- Aim for 1–2 dB of clipping on the loudest transients; more starts to distort kick and snare.
- Measure true peak after the limiter as usual; clipping doesn't replace the limiter's ceiling.

## Limiter

| Setting | Start from | Why |
|---|---|---|
| Ceiling | −1 dBTP (−2 dBTP for loud, dense masters) | Margin for lossy encoding and for peaks between samples |
| True peak mode | On, where your version of Live offers it | Limits peaks between samples, not only the samples themselves; still measure true peak afterwards |
| Gain | Raise until the loudness target is reached or the sound starts to suffer | Loudness comes from here, but only as far as the music allows |
| Release | Auto, or 50–300 ms | Shorter is louder but can distort; longer is cleaner but can pump |
| Lookahead | Longer for cleaner limiting | Gives the limiter time to react smoothly |
| Stereo linking | Both channels limited together (stereo or fully linked, not left/right or mid/side) | Prevents the stereo image from shifting when one side is limited harder |

- For dynamic masters, keep the limiter's gain reduction around 1–3 dB on the loudest peaks. Dense club masters may take more if the kick and snare stay clean.
- Only one limiter at the end of the chain. Stacking limiters adds distortion without adding loudness.

## Order and gain staging

Typical order: Utility (trim) → EQ Eight (corrective) → Glue Compressor → Multiband Dynamics (if needed) → Saturator or Roar (optional) → EQ Eight (tonal) → clipper (optional) → Limiter → the Ode device.

- The Ode device stays last on the Main track: it measures what reaches it, so every mastering device goes before it.
- Swap the compressor and the corrective EQ if a problem frequency is driving the compressor.
- After each stage, match its output to its input so bypassing it only changes the tone, not the level.

## Things to keep off the master

- Monitoring tools: room correction, headphone correction or speaker simulation belong to monitoring only; switch them off or remove them before exporting.
- Analysers and meters are harmless, but make sure nothing between the limiter and the Ode device changes the level.
- A Utility left in mono or at a reduced gain after a check.
