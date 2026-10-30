import type { Note } from "../../shared/live";
import type { ChordEvent } from "../../shared/song";
import { parseChordEvents } from "./chord-timeline";
import { MusicalKey } from "./musical-key";

const PITCH_CLASSES = 12;
/** Krumhansl–Kessler key profiles: how well each pitch class fits a major or minor key (probe-tone ratings). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
/** Chord roots weigh more than other chord tones when finding the key. */
const ROOT_WEIGHT = 1.5;
/** A first or last chord on the tonic makes that key more likely. */
const TONIC_CHORD_BONUS = 0.1;

function correlation(values: number[], profile: number[], rotation: number): number {
  const rotated = profile.map((_, index) => profile[(index - rotation + PITCH_CLASSES) % PITCH_CLASSES] ?? 0);
  const meanValues = values.reduce((sum, value) => sum + value, 0) / PITCH_CLASSES;
  const meanProfile = rotated.reduce((sum, value) => sum + value, 0) / PITCH_CLASSES;
  let numerator = 0;
  let valuesSpread = 0;
  let profileSpread = 0;
  values.forEach((value, index) => {
    const a = value - meanValues;
    const b = (rotated[index] ?? 0) - meanProfile;
    numerator += a * b;
    valuesSpread += a * a;
    profileSpread += b * b;
  });
  const denominator = Math.sqrt(valuesSpread * profileSpread);
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Finds the most likely major or minor key of chords and notes by correlating pitch-class weights with key profiles. */
export class KeyFinder {
  find(chords: ChordEvent[], notes: Note[] = []): MusicalKey {
    const weights = new Array<number>(PITCH_CLASSES).fill(0);
    const parsed = parseChordEvents(chords);
    for (const { event, chord } of parsed) {
      if (!chord) continue;
      for (const pitchClass of chord.pitchClasses) {
        weights[pitchClass] = (weights[pitchClass] ?? 0) + event.lengthBeats * (pitchClass === chord.root ? ROOT_WEIGHT : 1);
      }
    }
    for (const note of notes) {
      if (note.muted || note.probability === 0 || note.duration <= 0) continue;
      weights[note.pitch % PITCH_CLASSES] = (weights[note.pitch % PITCH_CLASSES] ?? 0) + note.duration;
    }
    if (weights.every((weight) => weight === 0)) throw new Error("There is no pitched chord or active note evidence from which to infer a key. Give an explicit key for the draft instead of treating C major as detected.");
    const first = parsed.find((item) => item.chord)?.chord ?? null;
    const last = [...parsed].reverse().find((item) => item.chord)?.chord ?? null;
    let best = MusicalKey.ofMajor(0);
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let tonic = 0; tonic < PITCH_CLASSES; tonic++) {
      for (const minor of [false, true]) {
        let score = correlation(weights, minor ? MINOR_PROFILE : MAJOR_PROFILE, tonic);
        for (const chord of [first, last]) {
          if (chord && chord.root === tonic && chord.minor === minor) score += TONIC_CHORD_BONUS;
        }
        if (score > bestScore) {
          bestScore = score;
          best = minor ? MusicalKey.ofMinor(tonic) : MusicalKey.ofMajor(tonic);
        }
      }
    }
    return best;
  }
}
