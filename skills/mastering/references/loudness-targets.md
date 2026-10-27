# Loudness and true peak targets

What the numbers mean, how normalisation works, and typical targets per platform and format. Platforms publish and occasionally change their figures, so treat the values below as typical, check the platform's current documentation when precision matters, and remember that the song decides: a target is a ceiling for usefulness, not a goal to hit at any cost.

## Contents
- What the measurements mean
- How loudness normalisation works
- Streaming platforms
- Formats without normalisation
- Choosing a target
- Explaining it to the musician

## What the measurements mean

- **LUFS (loudness units relative to full scale)** measures perceived loudness, weighted to match how we hear, following ITU-R BS.1770 (the same standard EBU R128 builds on). 1 LU equals 1 dB.
- **Integrated loudness** is the average over the whole song, with very quiet passages gated out. Streaming platforms normalise on this number. It needs the whole song to be measured.
- **Short-term loudness** uses a 3-second window; useful while adjusting and for comparing sections (the loudest chorus, the quietest verse).
- **True peak (dBTP)** estimates the peak level between samples, which a digital-to-analog converter or an encoder can reach even when every sample is below 0 dBFS. It is higher than or equal to the sample peak.
- **Crest factor** is the gap between peak and average level. A large gap means dynamic, punchy material; a small gap means dense, heavily limited material.

## How loudness normalisation works

- The platform measures each track's integrated loudness and plays it back with a gain change that brings it to the platform's reference level.
- **Louder tracks are turned down.** A master at −8 LUFS on a −14 LUFS platform plays 6 dB quieter, keeping its limited, dense sound without being louder than anything else.
- **Quieter tracks may be turned up, but only partly on some services:** some raise a track only as far as its peak headroom allows, so a quiet master with high peaks may stay quieter than the reference.
- **Album playback** on some services normalises an album as a whole, so a quiet ballad stays quieter than the single next to it, as intended.
- Listeners can sometimes switch normalisation off or choose louder and quieter settings, so masters should sound good both ways.

## Streaming platforms

Typical values as commonly published or reported:

| Platform | Typical playback reference | True peak advice |
|---|---|---|
| Spotify | Around −14 LUFS integrated (the default setting; listeners can choose louder or quieter settings) | Around −1 dBTP; around −2 dBTP for masters louder than −14 LUFS |
| Apple Music | Around −16 LUFS | Around −1 dBTP |
| YouTube | Around −14 LUFS | Around −1 dBTP |
| Amazon Music | Around −14 LUFS | Around −1 to −2 dBTP |
| Tidal | Around −14 LUFS | Around −1 dBTP |
| Deezer | Around −15 LUFS | Around −1 dBTP |
| Services that don't normalise (often reported for SoundCloud and Bandcamp) | The file plays as it is | Around −1 dBTP if the service encodes to a lossy format |

**One master usually serves every streaming platform.** A master around −14 LUFS with a −1 dBTP ceiling plays at close to its natural level almost everywhere, and is turned down slightly where the reference is lower. There is rarely a reason to make a separate master per streaming service.

**Why −1 dBTP:** lossy encoding (as most streaming uses) reconstructs the signal with filtering that can raise peaks above the original. A margin of 1 dB, or 2 dB for loud, dense masters, keeps the encoded file from clipping.

## Formats without normalisation

| Format | What matters |
|---|---|
| Club and DJ use | No normalisation; DJs set levels by ear and by gain. Dense dance masters often land around −9 to −6 LUFS integrated, but only when they still sound clean. Big systems expose distortion: a slightly quieter, cleaner master often sounds bigger. Keep true peak below 0 dBTP with a margin. |
| CD | 16-bit, 44.1 kHz, dithered. Loudness is an artistic choice; keep the true peak below 0 dBTP with a small margin (around −0.3 to −1 dBTP). |
| Downloads and lossless stores | Usually the same master as streaming. |
| Vinyl | Ask the cutting engineer. Usually a separate master with less limiting, controlled sibilance and harsh highs, and mono low end. |
| Broadcast | The broadcaster normalises to its own standard (for example −23 LUFS under EBU R128 in Europe, −24 LKFS under ATSC A/85 in the US); deliver whatever their specification asks for. |
| Sync (film, TV, adverts) | Deliver to the requested specification; instrumental and stem versions are often requested too. |

## Choosing a target

1. Start from the loudness target in the musician's Personalisation settings.
2. Consider where the song will be played most (streaming, club, CD, vinyl).
3. Measure the musician's own reference tracks for context, as information rather than a rule.
4. Raise loudness until either the target is reached or the music starts to suffer (punch lost, distortion, the chorus no longer bigger than the verse). Stop at whichever comes first.
5. Make a separate master only when there is a real reason: a club version, a vinyl cut, a CD with a different loudness.

Never present a loudness figure as checked unless it was measured on the master, and measure the exported file as well as the playback.

## Explaining it to the musician

A plain explanation usually works best:

"Streaming services turn every song to about the same loudness. If we push this master much louder than around −14 LUFS, Spotify and YouTube will just turn it down, and we'll have lost punch for nothing. If you want it to feel louder next to other songs, the bigger win is in the mix: a clearer low end and a more forward vocal. For the club version we can go louder, as long as the kick stays clean."
