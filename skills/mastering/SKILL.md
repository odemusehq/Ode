---
name: mastering
description: Configure or tune the existing Main mastering chain for the artist's stated target, measure exact supplied processed bounces, compare retained audio and disclose missing audition/export. Use for mastering, LUFS, true peak, loudness, limiting or delivery requests. The installed SDK cannot capture Main output, export audio or save the project; limiter settings alone never establish a verified or delivered master.
---

# Mastering

Mastering is the last stage before release: a consistent, flattering tonal balance, controlled dynamics, a loudness that suits the music and where it will be played, and peaks that survive encoding. Good mastering is mostly small moves made with care. Big problems (a buried vocal, a boomy bass, a harsh synth) are mix problems: fix them in the mix, which in Live is one step away, so the master serves the whole song.

Ode masters in place on the Main track: it builds the chain once and tunes its values on later requests, keeping a single chain.

## The loop

1. Read the request, reference, artist's target and existing Main chain. Preserve the approved mix and intentional processing. A default platform figure is a starting point, not a universal artistic target.
2. Identify the actual audio available. The installed SDK renders only Arrangement audio before devices and fader. It cannot hear a MIDI instrument, group, return or Main output, save the Set or export a master. Ask for a processed bounce through the chat's file intake when that evidence is required; never substitute a source render.
3. Measure the exact supplied file with `audio_analyze`, retaining its hash, format, frame count and declared signal stage. A supplied bounce's relationship to the current Set is unknown, even when exposed settings look unchanged.
4. Make a justified, limited chain change through supported controls. Recipes below are optional starting points. Parameter values establish configuration only; they do not reveal actual gain reduction, pumping, tone or translation.
5. Compare retained before/after or reference files with `audio_compare` for the artist's stated criterion. Match loudness for tone comparisons; retain levels when balance is the question. Both files must cover comparable musical material. Listening-model judgement is unvalidated and complements the artist's audition in Live.
6. Report briefly what was configured, what exact file was measured, and what still needs a new bounce, audition or export. Use “chain configured” when that is the completed action. Use “delivered” only for an actual retained output file; the SDK cannot create the native export or save/collect the Live project.

## Checks

| Property | Evidence required |
|---|---|
| Loudness and peak | Measurements of the exact proposed final file. Limiter gain and ceiling are settings, not measured outcomes |
| Dynamics and tone | Comparable audio and task-specific listening. A higher chorus LUFS or gentle ratio does not prove retained impact or a better master |
| Mono | Original stereo correlation and mono-power diagnostics, plus audition of the actual output. Bass Mono or Width settings alone do not verify translation |
| Completeness | Correct file, sample rate, channels, bit depth and exact frames, with the agreed start and complete tail checked. Equal frame counts alone do not establish common stem origin |
| Delivery | The requested playable files actually exist. Packaging a supplied bounce is not native Live export; saving and reopening the editable project remains a host/manual requirement |

Do not repeatedly change a chain to make a source-only heuristic pass. Intentional distortion, a quiet master or no change can be the right result.

## Questions

The target comes from the request or from the musician's settings, so take it from there without asking how loud. Keep this song's loudness target in lead_sheet.settings; use an artist preference only when the musician explicitly makes it enduring. Mastering changes are edits in place that Undo reverses, and the mode decides whether a change waits for Apply. Ask one line with buttons only when the answer changes what you would do: the fix would mean removing Master processing the musician put there themselves; tuning it goes ahead without a question.

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

## Exporting

The following are delivery requirements for a native export performed in Live. Ode can inspect supplied files and package existing audio; it cannot execute this export through the installed SDK:
- **Main master:** WAV or AIFF, 24-bit at the project's sample rate (44.1 or 48 kHz) unless the distributor asks otherwise; the full song including tails; normalisation off.
- **Dither** only when reducing bit depth, once, as the very last step (16-bit for CD); 32-bit float files stay undithered.
- **Only lossless files go to distributors;** they encode from the WAV.
- **Alternate versions** (instrumental, clean or radio edit, a cappella) go through the same chain with the same settings so they match; a club master gets its own limiter settings.
- **File names** carry the title, version and format, for example "Title - Main Master - 24bit 44k1.wav".

State export settings as instructions until an actual file has been supplied and checked. Do not call the task mastered or delivered from these settings alone.

## Albums and EPs

Master the songs as a set: similar perceived loudness and tonal character from track to track (each song keeps its own LUFS number; a quiet ballad should still feel quieter than the single), consistent ceilings, and gaps and transitions that suit the sequence.

## Reference files

| File | Read when |
|---|---|
| `references/loudness-targets.md` | Choosing a loudness and true-peak target for a platform or format, or answering "why?" about normalisation |
| `references/chain-settings.md` | Setting up EQ Eight, Glue Compressor, Multiband Dynamics, Saturator, Roar, Limiter or Utility on a master, with starting values and reasons |
