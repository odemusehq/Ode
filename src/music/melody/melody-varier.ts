import type { Note } from "../../shared/live";
import { KeyFinder } from "../harmony/key-finder";
import type { MusicalKey } from "../harmony/musical-key";
import { melodyLine } from "../prosody/melody-line";
import { Meter, METRICAL_WEIGHT } from "../prosody/meter";
import { SeededRandom } from "../rhythm/random";
import { DEFAULT_SEED, MelodyVariation } from "./melody-plan";

/** Rhythm variation: notes on beats are anticipated by an eighth; even pairs become dotted. */
const ANTICIPATION_BEATS = 0.5;
const ANTICIPATION_CHANCE = 0.5;
const DOTTED_CHANCE = 0.5;
const DOTTED_LENGTHS = new Set([0.5, 1]);
const DOTTED_FIRST_SHARE = 1.5;
/** Ornaments: passing tones fill leaps of a third or more; long notes get a neighbour-note turn. */
const PASSING_MIN_INTERVAL = 3;
const PASSING_SHARE = 0.5;
const MIN_ORNAMENT_BEATS = 0.5;
const TURN_MIN_BEATS = 2;
const NEIGHBOUR_BEATS = 0.25;
const ORNAMENT_VELOCITY_DROP = 10;
const DEFAULT_VELOCITY = 96;
/** The new last note is held a beat longer. */
const ENDING_EXTENSION_BEATS = 1;
const OCTAVE = 12;
/** Inversion keeps the melody within this many semitones of its original range. */
const RANGE_ALLOWANCE = 5;
const TONIC_TRIAD_STEPS = [0, 2, 4];
const TIME_TOLERANCE = 1e-6;

function copy(note: Note): Note {
  return { ...note };
}

/** Varies a melody while keeping its identity: rhythm, contour (inversion), ending, or ornaments. */
export class MelodyVarier {
  constructor(
    private readonly random: SeededRandom,
    private readonly meter: Meter = new Meter(),
    /** The song's key when it is known; otherwise it is found from the melody. */
    private readonly key?: MusicalKey,
  ) {}

  vary(notes: Note[], how: MelodyVariation): Note[] {
    const line = melodyLine(notes);
    if (line.length === 0) return [];
    const key = this.key ?? new KeyFinder().find([], line);
    switch (how) {
      case MelodyVariation.Rhythm:
        return this.varyRhythm(line);
      case MelodyVariation.Contour:
        return this.invert(line, key);
      case MelodyVariation.Ending:
        return this.newEnding(line, key);
      case MelodyVariation.Ornament:
        return this.ornament(line, key);
    }
  }

  private varyRhythm(line: Note[]): Note[] {
    const notes = line.map(copy);
    let changed = false;
    for (let index = 1; index < notes.length - 1; index++) {
      const note = notes[index];
      const previous = notes[index - 1];
      if (!note || !previous) continue;
      const onBeat = this.meter.weightAt(note.start) >= METRICAL_WEIGHT.beat;
      const room = previous.duration > ANTICIPATION_BEATS + TIME_TOLERANCE;
      if (onBeat && room && this.random.chance(ANTICIPATION_CHANCE)) {
        note.start -= ANTICIPATION_BEATS;
        note.duration += ANTICIPATION_BEATS;
        previous.duration = Math.max(ANTICIPATION_BEATS, note.start - previous.start);
        changed = true;
      }
    }
    for (let index = 0; index + 1 < notes.length; index++) {
      const first = notes[index];
      const second = notes[index + 1];
      if (!first || !second || !this.dottable(first, second)) continue;
      if (changed && !this.random.chance(DOTTED_CHANCE)) continue;
      const length = first.duration;
      first.duration = length * DOTTED_FIRST_SHARE;
      second.start = first.start + first.duration;
      second.duration = length * (2 - DOTTED_FIRST_SHARE);
      changed = true;
      index += 1;
    }
    return notes;
  }

  private dottable(first: Note, second: Note): boolean {
    return (
      DOTTED_LENGTHS.has(first.duration) &&
      Math.abs(first.duration - second.duration) < TIME_TOLERANCE &&
      Math.abs(first.start + first.duration - second.start) < TIME_TOLERANCE
    );
  }

  /** Melodic inversion around the first note, by scale steps. */
  private invert(line: Note[], key: MusicalKey): Note[] {
    const first = line[0]?.pitch ?? 0;
    const low = Math.min(...line.map((note) => note.pitch)) - RANGE_ALLOWANCE;
    const high = Math.max(...line.map((note) => note.pitch)) + RANGE_ALLOWANCE;
    return line.map((note) => {
      let pitch = key.step(first, -key.stepsBetween(first, note.pitch));
      while (pitch > high) pitch -= OCTAVE;
      while (pitch < low) pitch += OCTAVE;
      return { ...note, pitch };
    });
  }

  /** Resolves an open ending to the tonic, or moves an ending on the tonic to the third or fifth to leave it open, approached by step and held longer. */
  private newEnding(line: Note[], key: MusicalKey): Note[] {
    const notes = line.map(copy);
    const last = notes.at(-1);
    if (!last) return notes;
    const triad = TONIC_TRIAD_STEPS.map((steps) => key.step(key.root, steps) % OCTAVE);
    const endsOnTonic = last.pitch % OCTAVE === key.root;
    const targets = endsOnTonic ? triad.slice(1) : [key.root];
    last.pitch = this.nearestOfClasses(last.pitch, targets);
    last.duration += ENDING_EXTENSION_BEATS;
    const penultimate = notes.at(-2);
    if (penultimate) {
      const direction = penultimate.pitch >= last.pitch ? 1 : -1;
      penultimate.pitch = key.step(last.pitch, direction);
    }
    return notes;
  }

  private nearestOfClasses(pitch: number, classes: number[]): number {
    let best = pitch;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let candidate = pitch - OCTAVE; candidate <= pitch + OCTAVE; candidate++) {
      if (!classes.includes(((candidate % OCTAVE) + OCTAVE) % OCTAVE) || candidate === pitch) continue;
      const distance = Math.abs(candidate - pitch);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  }

  /** Passing tones across leaps and a neighbour-note turn on long notes. */
  private ornament(line: Note[], key: MusicalKey): Note[] {
    const result: Note[] = [];
    line.forEach((original, index) => {
      const note = copy(original);
      const next = line[index + 1];
      const velocity = Math.max(1, (note.velocity ?? DEFAULT_VELOCITY) - ORNAMENT_VELOCITY_DROP);
      if (next && Math.abs(next.pitch - note.pitch) >= PASSING_MIN_INTERVAL && note.duration >= MIN_ORNAMENT_BEATS) {
        const passingLength = note.duration * PASSING_SHARE;
        note.duration -= passingLength;
        result.push(note, {
          ...note,
          pitch: key.step(note.pitch, Math.sign(next.pitch - note.pitch)),
          start: note.start + note.duration,
          duration: passingLength,
          velocity,
        });
        return;
      }
      if (note.duration >= TURN_MIN_BEATS) {
        const mainLength = note.duration - 2 * NEIGHBOUR_BEATS;
        result.push(
          { ...note, duration: mainLength },
          { ...note, pitch: key.step(note.pitch, 1), start: note.start + mainLength, duration: NEIGHBOUR_BEATS, velocity },
          { ...note, start: note.start + mainLength + NEIGHBOUR_BEATS, duration: NEIGHBOUR_BEATS, velocity },
        );
        return;
      }
      result.push(note);
    });
    return result;
  }
}

/** A variation of a melody: "rhythm", "contour", "ending" or "ornament". */
export function varyMelody(notes: Note[], how: MelodyVariation, seed: number = DEFAULT_SEED, meter: Meter = new Meter(), key?: MusicalKey): Note[] {
  return new MelodyVarier(new SeededRandom(seed), meter, key).vary(notes, how);
}
