---
name: mixing-low-end
description: Mix the low end in place in Live — decide whether the kick, the bass or the 808 owns the sub, tune the kick to the key, complementary EQ, ducking the bass or 808 under the kick, phase and polarity, mono below about 100–150 Hz, even bass notes, and harmonics so the bass is heard on small speakers — with the checks the low end needs. Read this after the mixing skill whenever kick and bass fight, the low end is boomy, weak, muddy or uneven, disappears on phones, an 808 clashes with the kick, or the low end eats the headroom.
---

# Mixing the low end

The low end holds the song up and moves the body, and it is the hardest part of a mix to judge: most rooms and headphones misrepresent bass, low frequencies use most of the mix's energy and headroom, and small speakers can't reproduce the sub at all. That is why the low end is judged on measurements as much as on listening. The loop, the checks and the one-line result are in the parent mixing skill; this file holds what is specific to the low end.

## Decide who owns what

Two parts filling the same low range at the same moment either pile up (boomy, eating headroom) or cancel (thin, hollow). Decide the roles before reaching for EQ.

| Approach | Kick | Bass or 808 | Suits |
|---|---|---|---|
| Kick punches, bass carries the sub | Owns roughly 60–120 Hz punch and the attack | Owns the sub and the low mids | Most songs with a sustained bass |
| Bass gives way to the kick | Owns the low end at each hit | Ducks under each kick, fills the space between | A steady four-on-the-floor kick with a long bass |
| 808 is the sub | Short, little sub, mostly attack | Owns everything below about 80 Hz | Songs where the 808 is the bass line |

The arrangement often settles it for free: short bass notes that leave room for the kick, a bass line that plays between kicks, or the bass up an octave in a busy section (bass and arrangement skills).

## Tuning

- Find the kick's fundamental and the bass's most common notes (note frequencies are in the parent skill's frequency guide). A kick a few hertz off the bass's main notes beats and clashes against them.
- Tune the kick to the root or fifth of the key, or another chord tone it agrees with; an 808 is a bass part and follows the song's notes exactly.
- Kicks usually sit with their fundamental around 45–65 Hz, with room to tune a few semitones either way.

## EQ

- **Complementary EQ:** where the kick has its punch, cut the bass 1–3 dB, and the other way round where the bass has its definition. Don't boost both in the same area.
- **Remove what nobody uses:** a gentle high-pass below the lowest musical note (often 25–35 Hz) on bass and kick clears rumble that only eats headroom, as long as the weight stays.
- **Leave the low end to the low parts:** high-pass pads, keys, guitars, vocals and especially reverb and delay returns (often 200–500 Hz on returns). Each adds only a little low end, but together they cloud the kick and bass.
- **Boomy notes:** a single note that booms gets a narrow cut at its frequency, or compression on the low band so it drops only when that note plays.

## Ducking

- **Bass under the kick:** a Compressor on the bass keyed by the kick, attack 0.1–1 ms, release 50–150 ms timed so the bass is back before the next kick, ratio 4:1 or higher, 3–6 dB of gain reduction for space without obvious pumping.
- **Only the lows:** Multiband Dynamics on the bass keyed by the kick, compressing only the low band (crossover around 100–150 Hz); the upper harmonics that carry the line stay steady.
- **Shorter notes can replace ducking:** a bass with a gap at each kick needs none.
- **The 808 under the kick** the same way, when both carry sub at the same moment.
- Ducking needs the kick routed as the compressor's sidechain source. When it isn't routed and you can't route it, choose a fix you can make (shorter notes, complementary EQ, kick tuning), or set up the compressor and end the result line with the routing step left.

## Phase and polarity

- Low frequencies from two sources can cancel: kick and bass, layered kicks, a bass recorded through two sources, a sub layer and a mid layer.
- Flip the polarity of one with Utility and keep the setting where the low end measures stronger on the Master. If neither is clearly better, nudge one by a few milliseconds and measure again.
- Check after every change of sample or layer; a new kick sample can bring back a cancellation fixed earlier.

## Mono below about 100–150 Hz

- Low frequencies are hard to place in stereo and play in mono on club systems and many speakers: Utility's Bass Mono (typically 100–150 Hz) on wide basses and synths.
- Stereo effects on a bass (chorus, wide unison, stereo delay) belong above that range; the bass's foundation stays centred.

## Even, controlled bass

- **Every note at a similar level:** compression on the bass (3:1–6:1, attack 5–30 ms, release 50–150 ms, 3–6 dB) or velocity fixes in MIDI parts.
- **Long and short notes:** long 808 or sub notes carry much more energy than short ones; sustained notes mustn't swamp the mix.
- **Don't over-compress the kick:** its attack is what lets it be heard over the bass.

## Bass on small speakers

Phones, laptops and small speakers can't reproduce the sub, so a bass made only of sub disappears on them.
- Add harmonics: Saturator (Bass Shaper or Soft Sine, parallel at 20–40% wet) or Roar with Multiband routing, saturating only the upper band so the sub stays clean.
- Or a mid layer playing the same notes, high-passed around 100–150 Hz (sound-design synths sub-skill).

## How much low end

- Too much sub eats headroom, makes the master quieter at the same peak level and sounds woolly on big systems.
- On the Master's spectrum a healthy sub is steady from note to note rather than jumping on certain notes.
- With a reference track the musician supplied, compare the low end at matched loudness, for tonal balance only: heavier or lighter, steadier or more uneven.

## Low-end checks

These add to the parent skill's checks.

| Check | Correct when |
|---|---|
| One owner | Kick and bass (or 808) aren't both strong below about 100 Hz at the same moment: masking measured where both are audio; for MIDI parts, the bass notes compared against the kick hits |
| Tuning | The kick's fundamental and the bass notes agree with the key |
| Polarity | The low end measures stronger on the Master with the polarity setting you kept |
| Mono | Mono below 100–150 Hz; the low end doesn't drop or change character with the Master summed to mono |
| Headroom | Low-end peaks don't set the Master's peak level on their own; reverbs and the parts that don't need lows are high-passed |

## Example

The musician selects the 808 at 140 BPM and types "kick and 808 are mush". The kick's fundamental is near 55 Hz and the 808 mostly plays F1 (about 44 Hz) and G1 (about 49 Hz) at full length under every kick, with the kick already routed to a compressor's sidechain on the 808. In place: that compressor set to attack 0.5 ms, release 100 ms, 5 dB of gain reduction, and the kick re-tuned up to about 65 Hz (C2, the fifth of F) with a shorter tail. Result: "808 ducks 5 dB under the kick, kick tuned to C and shortened · one owner of the sub on each hit, mono below 120 Hz, Master peaks −5.1 dBFS." Again takes a different route: shorter 808 notes that leave a gap at each kick, so no ducking is needed.
