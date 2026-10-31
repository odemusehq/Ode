# Drum kits

How to choose a kit for a song and inspect the notes that actually trigger it.

## General MIDI drum map

This is a common convention, not a Drum Rack guarantee. Each chain has its own receiving note, and a loaded kit may use a different layout. Read `rack_get_chains` and the actual instruments/samples before writing notes; preserve an existing layout. Live labels MIDI note 60 as C3, so note 36 appears as C1.

| MIDI note | Live name | Sound |
|---|---|---|
| 35 | B0 | acoustic bass drum (second kick) |
| 36 | C1 | kick |
| 37 | C♯1 | side stick (cross-stick, rim click) |
| 38 | D1 | snare |
| 39 | D♯1 | clap |
| 40 | E1 | electric snare (second snare) |
| 41 | F1 | low floor tom |
| 42 | F♯1 | closed hi-hat |
| 43 | G1 | high floor tom |
| 44 | G♯1 | pedal hi-hat |
| 45 | A1 | low tom |
| 46 | A♯1 | open hi-hat |
| 47 | B1 | low-mid tom |
| 48 | C2 | high-mid tom |
| 49 | C♯2 | crash |
| 50 | D2 | high tom |
| 51 | D♯2 | ride |
| 52 | E2 | china cymbal |
| 53 | F2 | ride bell |
| 54 | F♯2 | tambourine |
| 55 | G2 | splash |
| 56 | G♯2 | cowbell |
| 57 | A2 | second crash |
| 60–64 | C3–E3 | bongos and congas (high bongo, low bongo, muted high conga, open high conga, low conga) |
| 69 | A3 | cabasa |
| 70 | A♯3 | maracas (shaker) |
| 75 | D♯4 | claves |

If the musician's kit uses a different layout, read its pads and follow that layout.

## Choosing sounds

- **Start from the song**: tempo, genre, the bass sound and the space in the arrangement. A ballad wants softer, roomier drums than a club track; a dense mix needs shorter, tighter sounds.
- **Kick**: match its length to the bass. A long, boomy kick needs a bass that leaves room; a short, clicky kick suits a long sub-bass or 808. If the kick has a clear pitch, tune it to the song's key or the bass root.
- **Snare and clap**: their tone sets the era and the mood; bright and short for energy, darker and longer for weight. Layer a snare with a clap for width, and nudge one by a few milliseconds if the two flam.
- **Hats**: closed and open from the same family. Shorter decays at fast tempos so the sixteenths stay clear.
- **Percussion**: one or two colours at most per section, panned apart.
- **Sources:** use suitable licensed Live/Packs kits, purchased sample libraries, the musician's recordings or a configured generation service. Original songwriting does not require inventing every drum sample. Preserve known source/licence information; a file being present does not establish its rights.
- **Acoustic or rock drums:** prefer a suitable sampled kit or recorded performance when that is the intended sound. Operator drums are an electronic choice, not a replacement for snare articulations, acoustic cymbals and room sound. Audition a short groove with accents, ghost notes and a fill through Max capture and the configured listener before arranging the whole song around the kit.

## Building the kit

- **Choke groups:** inspect and preserve the kit's existing hat behaviour. Configure chokes only through an exposed native control; if unavailable, name the manual step. Shortening MIDI notes does not choke a one-shot sample.
- **Layering**: combine a transient layer (click, attack) with a body layer (tone, low end), and keep their starts aligned. Two kicks that both carry low end will fight; high-pass the top layer.
- **Velocity:** audition whether accents and ghost notes change the actual sound. Prefer an existing instrument with velocity layers or alternating samples for acoustic repetition; Ode has no Sampler-zone writer. Decide explicit note velocities, timing and articulations as the model, from the intended performance; do not apply random offsets as a universal humaniser.
- **Tuning**: tune toms in steps (for example a fourth or a fifth apart) so fills sound melodic; tune the kick to the key when it has a clear pitch.
- **Panning**: choose the drummer's or the audience's perspective and keep it consistent: hats to one side, toms spread across, kick and snare centred.
- **Naming**: name pads plainly ("Kick", "Snare", "Clap", "Hat Closed", "Hat Open", "Shaker") so the musician and later edits can find them.

## One kit per song

Use one kit throughout, with per-section variations (a second snare for the chorus, extra percussion in the last chorus). A consistent kit makes the song sound like one piece; changing kits between sections sounds like different songs, unless that contrast is the point, such as a beat switch.
