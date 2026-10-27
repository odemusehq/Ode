---
name: mixing-low-end
description: Mix the low end in Live — kick and bass or 808 relationship, who owns the sub, tuning, complementary EQ, sidechain ducking, phase and polarity, mono below about 100–150 Hz, even bass notes, harmonics so bass is heard on small speakers, and checking low end you can't trust in your room. Read this whenever kick and bass fight, the low end is boomy, weak, muddy, uneven or disappears on phones, an 808 clashes with the kick, or the low end eats the headroom, after the general mixing skill.
---

# Mixing the low end

The low end holds the song up and moves the body, and it is the hardest part of a mix to judge: most rooms and headphones misrepresent bass, low frequencies use most of the mix's energy and headroom, and small speakers can't reproduce the sub at all. This sub-skill holds what is specific to the low end; the general approach (measure, one change at a time, matched-level comparisons, locked parts) is in the parent mixing skill.

## Decide who owns what

Two parts filling the same low range at the same moment either pile up (boomy, eats headroom) or cancel (thin, hollow). Decide the roles before reaching for EQ.

| Approach | Kick | Bass or 808 | Suits |
|---|---|---|---|
| Kick punches, bass carries the sub | Owns roughly 60–120 Hz punch and the attack | Owns the sub and the low mids | Most songs with a sustained bass |
| Bass gives way to the kick | Owns the low end at each hit | Ducks under each kick (sidechain), fills the space between | Steady four-on-the-floor kick with a long bass |
| 808 is the sub | Short, with little sub, mostly attack | Owns everything below about 80 Hz | Songs where the 808 is the bass line |

The arrangement often settles it for free: short bass notes that leave space for the kick, a bass line that plays between kicks, or the bass moved up an octave in a busy section.

## Tuning

- Find the kick's fundamental and the bass's most common notes (see the note table in the parent skill's frequency guide). A kick a few hertz away from the bass's main notes beats and clashes against them.
- Tune the kick to the root or fifth of the key (or another chord tone it agrees with). An 808 is a bass part and must follow the song's notes exactly.
- Kicks usually sit with their fundamental around 45–65 Hz; there is room to tune them a few semitones either way.

## EQ

- **Complementary EQ:** where the kick has its punch, cut the bass 1–3 dB (and the other way round where the bass has its definition). Don't boost both in the same area.
- **Remove what nobody uses:** a gentle high-pass below the lowest musical note (often 25–35 Hz) on the bass and kick clears rumble that only eats headroom. Check that it doesn't take the weight with it.
- **Leave the low end to the low parts:** high-pass pads, keys, guitars, vocals and especially reverb and delay returns (often 200–500 Hz on returns). Each one adds only a little low end, but together they cloud the kick and bass.
- **Boomy notes:** a single note that booms (from the instrument, the room or a resonant synth) gets a narrow cut at its frequency, or compression on the low band so it only drops when that note plays.

## Sidechain

- **Duck the bass under the kick:** Compressor on the bass, kick as the sidechain input, attack 0.1–1 ms, release 50–150 ms timed so the bass is back before the next kick, ratio 4:1 or higher, 3–6 dB of gain reduction for space without obvious pumping.
- **Duck only the lows:** Multiband Dynamics on the bass with the kick as its sidechain, compressing only the low band (crossover around 100–150 Hz); the bass's upper harmonics, which carry the line, stay steady.
- **Shorter notes can replace sidechain.** If the bass has a gap where each kick hits, it doesn't need ducking.
- **Duck the 808 under the kick** the same way when both have sub at the same moment.

## Phase and polarity

- Low frequencies from two sources can cancel: kick and bass, layered kicks, a bass recorded through two sources (direct and amp), a sub layer and a mid layer.
- Flip the polarity of one with Utility and keep the setting with more low end. If neither is clearly better, nudge one by a few milliseconds and listen again.
- Check after every change of samples or layers; a new kick sample can bring back a cancellation you fixed earlier.

## Mono below about 100–150 Hz

- Low frequencies are hard to place in stereo and play in mono on club systems and many speakers, so keep them mono: Utility's Bass Mono (typically 100–150 Hz) on wide basses and synths.
- Stereo effects on bass (chorus, wide unison, stereo delay) belong above that range; keep the bass's foundation centred.
- Sum the Master to mono briefly and check that the low end doesn't drop or change character.

## Even, controlled bass

- **Every note at a similar level:** compression on the bass (3:1–6:1, attack 5–30 ms, release 50–150 ms, 3–6 dB), velocity fixes in MIDI parts, or clip gain on recorded notes.
- **Long and short notes:** long 808 or sub notes carry much more energy than short ones; check that sustained notes don't swamp the mix.
- **Don't over-compress the kick.** Its attack is what lets it be heard over the bass.

## Bass on small speakers

Phones, laptops and small speakers can't reproduce the sub, so a bass made only of sub disappears on them.
- Add harmonics: Saturator (Bass Shaper or Soft Sine, parallel at 20–40% wet) or Roar with Multiband routing, saturating only the upper band so the sub stays clean.
- Or add a mid layer that plays the same notes, high-passed around 100–150 Hz (see the sound-design synths sub-skill).
- Check on a phone or laptop speaker: the bass line should still be followable, even without weight.

## How much low end

- Too much sub eats headroom, makes the master quieter at the same peak level and makes the mix sound woolly on big systems.
- Compare the low end with two or three loudness-matched reference tracks the musician likes, for tonal balance only: is the low end heavier or lighter, steadier or more uneven?
- On the spectrum, a healthy sub is steady from note to note rather than jumping with certain notes.

## Checking low end you can't trust

- Monitors in a treated room are best; most rooms boost some bass notes and cancel others depending on where you sit.
- Headphones show sub detail and note-to-note consistency well, but exaggerate or hide bass depending on the model.
- Use measurements to back up your ears: the spectrum on the Master, track meters for low-end peaks dominating the level, masking between kick and bass.
- Check in a car and on small speakers; compare against loudness-matched references.

## Checks

- One clear owner of the sub at any moment; kick and bass both heard, neither swallowing the other.
- Kick tuned to the key; 808 or bass notes correct.
- No phase cancellation between low layers; polarity checked.
- Low end mono below about 100–150 Hz and solid when summed to mono.
- Bass line audible on small speakers.
- Low end steady from note to note; nothing booming on particular notes.
- Low-end peaks leave headroom; reverbs and other parts high-passed.

## Worked example

"The kick and 808 turn into mush." A song at 140 BPM; the kick's fundamental is near 55 Hz and the 808 mostly plays F1 (about 44 Hz) and G1 (about 49 Hz), both full length under every kick. Fixes to try in this order, one at a time, measuring masking between kick and 808 after each and stopping when the low end is clear:
1. Duck the 808 under the kick: Compressor on the 808 keyed by the kick, attack 0.5 ms, release 80–120 ms, 4–6 dB.
2. Re-tune the kick up to about 65 Hz (C2, the fifth of F) so it punches above the 808's sub, and shorten its tail.
3. If the kick still fights, suggest a kick with very little sub, so the 808 owns everything below 80 Hz and the kick is mostly attack (a sound change, so the musician chooses the sample).
Note which fix the musician kept; it's a preference worth remembering for their next song.
