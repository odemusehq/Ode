---
name: vocals-demo-vocal
description: Make a demo vocal — the song's lyric and melody sung in the artist's own voice and placed on the "Demo vocal" track — so the musician can hear the song before recording it, only after their clear yes to using their voice, in every mode. Covers the consent question and what it must say, the short clean recording it needs, the musician's rights to the result, checking the lyric setting, range and pronunciation before singing, and placing the demo without touching their recordings. Read this whenever the musician wants to hear the song sung in their voice, asks for a demo or guide vocal, asks whether Ode can sing in their voice or in someone else's, or wants to change or withdraw the recording of their voice.
---

# Demo vocal

A demo vocal lets the artist hear their song sung in their own voice before they record it: to judge the key and range, the prosody, the phrasing and how clearly the lyric comes across, and to have a guide to sing along with in the session. It is a guide for writing and recording; the released vocal is normally the artist's real performance.

The loop is the vocals skill's (read, decide, change in place, verify, let them hear it, report in one line), with one step that every mode keeps: consent.

## Only the artist's own voice, only after their yes

- Use only the voice of the person who agrees to it. Every other voice — a bandmate's, a featured singer's, a well-known artist's — stays out, and so does any imitation of a known singer, even when asked. A bandmate who wants a demo in their own voice agrees for themselves, with their own recording.
- When Ode has yet to save a recording of the artist's voice with their consent, saving one is the first step, and it always asks them first — in Auto and in Manual alike. Consent is a rights matter, outside what the modes decide.
- The question is one line with Agree and Later, and says what is kept and why: "To sing it in your voice I'll keep about 20 seconds of your singing from 'Voice Ref' in your Ode folder, only for your own demos; you can withdraw it any time. · Agree · Later".
- Recording, saving, rendering and singing in their voice all wait for that yes. "Sing it in my voice" is a request; the yes comes only from the consent question.
- On Later, or without a clear answer, skip the demo; the result line says so, and that the guide melody can still be heard on its own track.
- A request for someone else's voice or sound gets one line: demos are sung only in the artist's own voice. Qualities of delivery — breathy, belted, close and quiet — belong to the performance and the mix alone; copying a person stays out of it.
- If they withdraw consent, remove the recording and the consent at once with `voice_reference_clear`; demo vocals then wait for a new recording and a new yes. The result line says the recording is gone.

## The musician keeps the rights

- Ode is used to make music for release, and the musician keeps all rights to publish their song. Demo vocals made from their voice belong to them like the rest of their material.
- The model that sings the demo must allow commercial use and leave the artist the rights to the results. If there is reason to think the configured model falls short of this, the result line says so and Ode skips the demo.
- The recording of their voice is personal: it is used only to sing their own demo vocals, on their own songs, with words they have approved, and it stays private.

## The voice recording

- Clean and dry: the bare voice, without reverb, delay, pitch correction or doubles, and without a backing track bleeding into the microphone; a quiet room; one singer.
- 10–30 seconds of continuous singing in a comfortable part of their range, with a mix of vowels and some movement in pitch. Sung throughout; any song works, this one or another.
- On its own audio track in the Arrangement, so it can be taken from a clear range of bars. If that recording is still missing, the result line says what to record.

## How Ode makes the demo

### 1. Read

- The section to sing (the selected one, or else the chorus — short demos are quicker to make and to judge), its lines from the lyrics (the stanza under its label), and the melody notes they are sung on.
- The singer's range, the accent setting, and whether a consented recording of their voice is already saved.

### 2. Decide and prepare

Prepare the setting as if a singer were about to read it: every syllable on its note or notes (several notes for a melisma), a rest for a breath between phrases.

### 3. Change the Set

- After consent, render the demo and place it on an audio track called "Demo vocal", lined up with the section it sings. If that track already holds a demo at those bars, the new one takes its place there; the history keeps the old one.
- Leave the artist's recorded vocals and every other clip exactly as they are.

### 4. Verify, before singing

| Check | Correct when |
|---|---|
| Consent | a recording of this artist's own voice is saved with their yes |
| Syllables | the lyrics-to-melody check gives each line a phrase with as many notes as one of its syllable counts, or melismas chosen on purpose, and the demo uses that same reading |
| Prosody | the prosody check finds every stressed syllable on a note at least as strong as its unstressed neighbours |
| Singability | the singability check passes: high held notes are free of closed vowels, very short notes free of consonant clusters |
| Range | every note sits inside the singer's range; a demo pushed outside it sounds strained and misleads everyone |
| Pronunciation | words whose pronunciation the checks left unconfirmed are named in the result line and always reported as uncertain |
| Rights | the singing model allows commercial use and leaves the artist the rights |

Fix the setting until the checks pass (the melody and prosody skills cover how), then sing.

### 5. Let them hear it

When your turn ends, the musician presses play in Live: name the section in the result line, so they know where to listen.

### 6. Report in one line

- "Demo vocal of the chorus on 'Demo vocal' · syllables fit every note, stresses on strong beats, inside your range."
- "Demo of verse 1 in your voice · 'Lisbon' pronunciation uncertain, everything else checked."
- "Demo skipped: your voice is used only with your yes · it stays unrecorded and unsaved."

## Be honest about its limits

A demo vocal is an approximation. Timing, pronunciation and expression will differ from a real performance, and a mispronounced word may come from the model, with the lyric itself correct. When something in the demo comes from the model alone, the result line says so briefly.
