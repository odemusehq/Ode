# Mastering

Mastering is the last stage before release: a consistent, flattering tonal balance, controlled dynamics, a loudness that suits the music and where it will be played, and peaks that survive encoding. Good mastering is mostly small moves made with care. Big problems (a buried vocal, a boomy bass, a harsh synth) are mix problems: fix them in the mix, which in Live is one step away, so the master serves the whole song.

Ode masters in place on the Main track: it builds the chain once and tunes its values on later requests, keeping a single chain.

## Preparing the mix

- **Headroom:** peaks around −6 to −3 dBFS are a convenient starting margin, not a required mix level. Inspect the actual chain and processed output before trimming gain; preserve intentional clipping or drive.
- **Limiting belongs to the master.** Master-bus processing the musician's sound depends on (a clipper or glue compressor they love) stays; the chain goes after it, knowing it is there.

## The chain

A typical order, using only the stages the song needs. Mastering moves are small: EQ moves usually 0.5–2 dB, compression 1–2 dB of gain reduction.

1. **Utility** — trim the input so the chain sees a sensible level.
2. **EQ Eight, corrective** — a gentle low cut (12 dB/octave around 20–30 Hz) only if there is rumble below the music; narrow cuts for resonances; mid/side moves only with a clear reason.
3. **Glue Compressor** — ratio 2, attack 10 or 30 ms, release Auto, 1–2 dB of gain reduction on the loud parts. A high-pass on its sidechain (around 80–150 Hz) stops the kick and bass from pumping the whole mix.
4. **Multiband Dynamics, only when needed** — when one band misbehaves (low end booming on some notes, a harsh top on loud passages): gentle ratios (1.5:1–3:1), 1–2 dB on that band only.
5. **Saturation, optional** — Saturator or Roar at low settings for density and a little loudness without peak level; a clipper (a clipper plug-in the musician already added, or Saturator's clipping set carefully) can shave 1–2 dB off the sharpest peaks so the limiter works less.
6. **EQ Eight, tonal** — broad shelves or bells of 0.5–1.5 dB to set the final balance.
7. **Limiter, last on the Main track** — ceiling −1 dB for streaming (with true-peak limiting where the Limiter offers it, and true peak measured on a bounce when there is one); gain raised toward the target as far as the sound allows.

Third-party mastering plug-ins the musician already added are welcome; the same order and the same small moves apply. Detailed settings for each device, with reasons, are in `references/chain-settings.md`.

## Loudness and true peak

**Loudness normalisation changes the question.** Most streaming services turn loud tracks down to a reference level for playback, and some raise quiet ones only as far as their peak headroom allows. A master much louder than the platform's reference gets turned down, keeping its squashed dynamics without being any louder for the listener.

**Illustrative starting values** (verify current platform requirements when relevant; the artist and delivery brief decide):
- Streaming in general: around **−14 LUFS integrated** with a **−1 dBTP** true-peak ceiling is one possible target, not a professional-quality requirement.
- Apple Music normalises to around −16 LUFS; a −14 LUFS master is simply turned down a little.
- Masters louder than about −14 LUFS are safer with a −2 dBTP ceiling, because lossy encoding adds peaks.
- Club play, DJ use, CD and downloads play each file at its own level: loudness is an artistic choice, and true peaks still need a margin below 0 dBTP.

**The music decides.** The target is the default, but a dense club track may sound right at −9 to −7 LUFS, while an acoustic ballad may sound best at −14 to −16 LUFS or lower. Stop where the song still breathes. Per-platform details are in `references/loudness-targets.md`.

## Keeping dynamics

- **Watch the limiter.** Regularly taking off more than about 3–4 dB, it costs punch and clarity. Get loudness earlier (gentle compression, saturation, a clipper, or a mix fix) or accept a lower target.
- **The drums still hit.** If the kick and snare soften or crackle, back off.
- **The song keeps its intended shape.** Preserve a bigger chorus when that is the plan, or its deliberately level or falling arc. Judge dynamic change against the artist's goal.

## Translation

- Mono and small speakers: summed to mono every important part stays; on small speakers the bass is carried by its harmonics (low-end mixing sub-skill).
- The very start and end: fade-ins and tails complete, free of clicks, a sensible amount of silence.
- Lossy encoding (as streaming uses) adds peaks; −1 dBTP, or −2 dBTP for loud masters, leaves room for it.

## Albums and EPs

Master the songs as a set: similar perceived loudness and tonal character from track to track (each song keeps its own LUFS number; a quiet ballad should still feel quieter than the single), consistent ceilings, and gaps and transitions that suit the sequence.

## Reference files

| File | Read when |
|---|---|
| `references/loudness-targets.md` | Choosing a loudness and true-peak target for a platform or format, or answering "why?" about normalisation |
| `references/chain-settings.md` | Setting up EQ Eight, Glue Compressor, Multiband Dynamics, Saturator, Roar, Limiter or Utility on a master, with starting values and reasons |
