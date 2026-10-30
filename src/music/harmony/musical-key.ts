import { Interval, Mode, Note, ScaleType } from "tonal";

/** A key as Live holds it: root pitch class (0 = C) and scale name. */
export interface KeySpec {
  root: number;
  scale: string;
  /** The scale's steps above the tonic in semitones, as Live gives them; when present they set the scale's notes. */
  intervals?: number[];
}

const PITCH_CLASSES = 12;
/** Conventional spellings of each pitch class as a tonic. */
const MAJOR_SPELLINGS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_SPELLINGS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const MODE_INTERVALS = Mode.names().map((name) => ({ name, intervals: Mode.get(name).intervals.map(Interval.semitones) }));

function modulo(value: number): number {
  return ((value % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

function checkedIntervals(intervals: readonly number[]): number[] {
  if (!Array.isArray(intervals) || intervals.length === 0 || intervals.some((interval) => !Number.isInteger(interval) || interval < 0 || interval >= PITCH_CLASSES) || new Set(intervals).size !== intervals.length) {
    throw new Error("A scale needs a nonempty set of unique integer intervals from 0 to 11. Explicit intervals are not replaced with a guessed parent scale.");
  }
  return [...intervals];
}

/** A key: tonic and mode, with the scale's pitch classes and diatonic stepping. */
export class MusicalKey {
  readonly root: number;
  readonly tonicName: string;
  /** Pitch classes of the scale, from the tonic up. */
  readonly scale: number[];
  readonly minor: boolean;
  /** Only an actual matching church-mode pitch set has this functional-harmony vocabulary. */
  readonly mode: string | null;
  private readonly live?: { scale: string; intervals: readonly number[] };

  /**
   * Explicit interval sets set the pitches regardless of their declared name. Functional harmony is available
   * only when those pitches actually match one of the supported seven modes; no parent scale is guessed.
   */
  constructor(
    root: number,
    mode: string,
    live?: { scale: string; intervals: readonly number[] },
  ) {
    if (!Number.isInteger(root)) throw new Error("A key needs a finite integer tonic pitch class.");
    const intervals = checkedIntervals(live ? live.intervals : Mode.get(mode).intervals.map(Interval.semitones));
    if (live) this.live = { scale: live.scale, intervals: [...intervals] };
    const ordered = [...intervals].sort((a, b) => a - b);
    this.mode = MODE_INTERVALS.find((candidate) => candidate.intervals.length === ordered.length && candidate.intervals.every((interval, index) => interval === ordered[index]))?.name ?? null;
    this.root = modulo(root);
    this.minor = intervals.includes(3) && !intervals.includes(4);
    this.tonicName = (this.minor ? MINOR_SPELLINGS : MAJOR_SPELLINGS)[this.root] ?? "C";
    this.scale = ordered.map((interval) => modulo(this.root + interval));
  }

  static from(spec: KeySpec): MusicalKey {
    const declared = spec.scale.trim();
    if (!declared) throw new Error("Give a supported scale name or a named explicit interval set.");
    let intervals: number[];
    if (spec.intervals !== undefined) intervals = checkedIntervals(spec.intervals);
    else {
      const name = declared.toLowerCase();
      const scale = ScaleType.get(name === "natural minor" ? "minor" : name);
      if (scale.empty) throw new Error(`Unsupported scale name ${JSON.stringify(declared)}. Give a supported complete name or explicit scale intervals; no parent key was guessed.`);
      intervals = checkedIntervals(scale.intervals.map(Interval.semitones));
    }
    return new MusicalKey(spec.root, declared, { scale: declared, intervals });
  }

  static ofMajor(root: number): MusicalKey {
    return new MusicalKey(root, "ionian");
  }

  static ofMinor(root: number): MusicalKey {
    return new MusicalKey(root, "aeolian");
  }

  get label(): string {
    const name = this.mode === "ionian" ? "major" : this.mode === "aeolian" ? "minor" : this.mode;
    return `${this.tonicName} ${this.live ? this.live.scale.toLowerCase() : name}`;
  }

  /** The key in Live's form, with Live's scale names, and Live's own steps when the key came with them. */
  get spec(): KeySpec {
    if (this.live) return { root: this.root, scale: this.live.scale, intervals: [...this.live.intervals] };
    const mode = this.requireMode();
    const scale =
      mode === "ionian" ? "Major" : mode === "aeolian" ? "Minor" : mode.charAt(0).toUpperCase() + mode.slice(1);
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
    return Mode.triads(this.requireMode(), this.tonicName);
  }

  sevenths(): string[] {
    return Mode.seventhChords(this.requireMode(), this.tonicName).map((symbol) => symbol.replace("Maj7", "maj7"));
  }

  private requireMode(): string {
    if (this.mode === null) throw new Error(`Automatic functional harmony is unsupported for ${this.label}'s pitch set. Its pitches remain available for melody and explicit chord/MIDI work; no parent mode was guessed.`);
    return this.mode;
  }
}
