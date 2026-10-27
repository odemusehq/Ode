import { Interval, Mode, Note } from "tonal";

/** A key as stored in the lead sheet and read from Live: root pitch class (0 = C) and scale name. */
export interface KeySpec {
  root: number;
  scale: string;
}

const PITCH_CLASSES = 12;
/** Conventional spellings of each pitch class as a tonic. */
const MAJOR_SPELLINGS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_SPELLINGS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const MODES_WITH_MINOR_THIRD = new Set(["dorian", "phrygian", "aeolian", "locrian"]);
const MODE_NAMES: ReadonlyMap<string, string> = new Map([
  ["major", "ionian"],
  ["ionian", "ionian"],
  ["minor", "aeolian"],
  ["natural minor", "aeolian"],
  ["aeolian", "aeolian"],
  ["dorian", "dorian"],
  ["phrygian", "phrygian"],
  ["lydian", "lydian"],
  ["mixolydian", "mixolydian"],
  ["locrian", "locrian"],
]);
/** Other scale names mapped to the mode their chords are drawn from. */
const PARENT_MODES: readonly [RegExp, string][] = [
  [/dorian/, "dorian"],
  [/phrygian/, "phrygian"],
  [/mixolydian/, "mixolydian"],
  [/lydian/, "lydian"],
  [/locrian/, "locrian"],
  [/minor|blues|hirajoshi|in-sen|kumoi|iwato/, "aeolian"],
];

function modulo(value: number): number {
  return ((value % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

/** A key: tonic and mode, with the scale's pitch classes and diatonic stepping. */
export class MusicalKey {
  readonly root: number;
  readonly tonicName: string;
  /** Pitch classes of the scale, from the tonic up. */
  readonly scale: number[];
  readonly minor: boolean;

  constructor(
    root: number,
    readonly mode: string,
  ) {
    this.root = modulo(root);
    this.minor = MODES_WITH_MINOR_THIRD.has(mode);
    this.tonicName = (this.minor ? MINOR_SPELLINGS : MAJOR_SPELLINGS)[this.root] ?? "C";
    this.scale = Mode.get(mode).intervals.map((interval) => modulo(this.root + Interval.semitones(interval)));
  }

  static from(spec: KeySpec): MusicalKey {
    const name = spec.scale.trim().toLowerCase();
    const mode = MODE_NAMES.get(name) ?? PARENT_MODES.find(([pattern]) => pattern.test(name))?.[1] ?? "ionian";
    return new MusicalKey(spec.root, mode);
  }

  static ofMajor(root: number): MusicalKey {
    return new MusicalKey(root, "ionian");
  }

  static ofMinor(root: number): MusicalKey {
    return new MusicalKey(root, "aeolian");
  }

  get label(): string {
    const name = this.mode === "ionian" ? "major" : this.mode === "aeolian" ? "minor" : this.mode;
    return `${this.tonicName} ${name}`;
  }

  /** The key in the lead sheet's form, with Live's scale names. */
  get spec(): KeySpec {
    const scale =
      this.mode === "ionian" ? "Major" : this.mode === "aeolian" ? "Minor" : this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
    return { root: this.root, scale };
  }

  contains(pitchClass: number): boolean {
    return this.scale.includes(modulo(pitchClass));
  }

  /** Scale degree (0 = tonic) of a pitch class, or -1 when it is outside the scale. */
  degreeOf(pitchClass: number): number {
    return this.scale.indexOf(modulo(pitchClass));
  }

  /** The nearest pitch in the scale (the lower one on a tie). */
  nearest(pitch: number): number {
    for (let distance = 0; distance < PITCH_CLASSES; distance++) {
      if (this.contains(pitch - distance)) return pitch - distance;
      if (this.contains(pitch + distance)) return pitch + distance;
    }
    return pitch;
  }

  /** Moves a pitch by scale steps, snapping it into the scale first. */
  step(pitch: number, steps: number): number {
    let current = this.nearest(pitch);
    const direction = Math.sign(steps);
    for (let count = 0; count < Math.abs(steps); count++) {
      current += direction;
      while (!this.contains(current)) current += direction;
    }
    return current;
  }

  /** Scale steps from one scale pitch to another (negative when going down). */
  stepsBetween(from: number, to: number): number {
    const start = this.nearest(from);
    const end = this.nearest(to);
    const direction = Math.sign(end - start);
    let steps = 0;
    for (let pitch = start; pitch !== end; pitch += direction) {
      if (this.contains(pitch + direction)) steps += direction;
    }
    return steps;
  }

  /** Scale pitches between two MIDI notes, inclusive. */
  pitchesBetween(low: number, high: number): number[] {
    const pitches: number[] = [];
    for (let pitch = Math.ceil(low); pitch <= high; pitch++) if (this.contains(pitch)) pitches.push(pitch);
    return pitches;
  }

  /** Name of the note an interval above the tonic ("7m" is the flat seventh). */
  noteAbove(interval: string): string {
    return Note.pitchClass(Note.transpose(this.tonicName, interval));
  }

  triads(): string[] {
    return Mode.triads(this.mode, this.tonicName);
  }

  sevenths(): string[] {
    return Mode.seventhChords(this.mode, this.tonicName).map((symbol) => symbol.replace("Maj7", "maj7"));
  }
}
