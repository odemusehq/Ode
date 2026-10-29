import { Chord, Interval, Note } from "tonal";

export enum ChordTone {
  Root = "root",
  Third = "third",
  Fifth = "fifth",
  Sixth = "sixth",
  Seventh = "seventh",
  Suspension = "suspension",
  Extension = "extension",
}

export interface ChordToneInfo {
  pitchClass: number;
  role: ChordTone;
  /** Note name as spelled in the chord ("Bb", "F#"). */
  name: string;
}

/** A MIDI octave used only to name pitch classes. */
const NAMING_OCTAVE = 60;
const PITCH_CLASSES = 12;
const DIATONIC_STEPS = 7;
const MAJOR_SECOND = 2;
const MINOR_THIRD = 3;
const MAJOR_THIRD = 4;
const PERFECT_FOURTH = 5;
const PERFECT_FIFTH = 7;
const DIMINISHED_SEVENTH = 9;
const MINOR_SEVENTH = 10;
const MAJOR_SEVENTH = 11;

/** Common ways of writing chord symbols that tonal does not read, rewritten to ones it does. */
const SYMBOL_REWRITES: readonly [RegExp, string][] = [
  [/[()]/g, ""],
  [/♭/g, "b"],
  [/♯/g, "#"],
  [/Δ/g, "maj7"],
  [/−/g, "m"],
  [/min(?!or)/g, "m"],
  // Half-diminished (ø, ø7) and diminished (°, °7) signs, and a minus straight after the root ("C-7").
  [/ø7?/g, "m7b5"],
  [/°/g, "dim"],
  [/^([A-G][#b]?)-/, "$1m"],
];
const ROOT_AND_REST = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

function modulo(value: number): number {
  return ((value % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

function nameOfPitchClass(pitchClass: number): string {
  return Note.pitchClass(Note.fromMidiSharps(NAMING_OCTAVE + pitchClass));
}

/** Interval number within an octave (1–7); descending intervals are inverted ("-2M", a bass note below, is a 7th). */
function simpleNumber(intervalName: string): number {
  const number = Interval.num(intervalName);
  if (!Number.isFinite(number) || number === 0) return 0;
  const ascending = number > 0 ? number : DIATONIC_STEPS + 2 + number;
  return ((ascending - 1) % DIATONIC_STEPS) + 1;
}

function roleFor(intervalName: string, hasThird: boolean): ChordTone {
  switch (simpleNumber(intervalName)) {
    case 1:
      return ChordTone.Root;
    case 3:
      return ChordTone.Third;
    case 5:
      return ChordTone.Fifth;
    case 7:
      return ChordTone.Seventh;
    case 2:
    case 4:
      return hasThird ? ChordTone.Extension : ChordTone.Suspension;
    case 6:
      return ChordTone.Sixth;
    default:
      return ChordTone.Extension;
  }
}

/** A parsed chord symbol ("Am7", "F/C", "Bbsus2"): root, bass and chord tones as pitch classes. */
export class ChordSymbol {
  private static readonly cache = new Map<string, ChordSymbol | null>();

  private constructor(
    readonly symbol: string,
    readonly root: number,
    readonly bass: number,
    readonly tones: ChordToneInfo[],
  ) {}

  static parse(symbol: string): ChordSymbol | null {
    const cached = ChordSymbol.cache.get(symbol);
    if (cached !== undefined) return cached;
    const parsed = ChordSymbol.fromTonal(symbol) ?? ChordSymbol.fromPattern(symbol);
    ChordSymbol.cache.set(symbol, parsed);
    return parsed;
  }

  get pitchClasses(): number[] {
    return this.tones.map((tone) => tone.pitchClass);
  }

  get minor(): boolean {
    return this.tones.some((tone) => tone.role === ChordTone.Third && modulo(tone.pitchClass - this.root) === MINOR_THIRD);
  }

  contains(pitchClass: number): boolean {
    return this.tones.some((tone) => tone.pitchClass === modulo(pitchClass));
  }

  roleOf(pitchClass: number): ChordTone | undefined {
    return this.tones.find((tone) => tone.pitchClass === modulo(pitchClass))?.role;
  }

  /** The chord's spelling of a pitch class, or a sharp name when it is not in the chord. */
  nameOf(pitchClass: number): string {
    return this.tones.find((tone) => tone.pitchClass === modulo(pitchClass))?.name ?? nameOfPitchClass(modulo(pitchClass));
  }

  /** Semitones from the root to a pitch class (0–11). */
  intervalFromRoot(pitchClass: number): number {
    return modulo(pitchClass - this.root);
  }

  private static clean(symbol: string): string {
    return SYMBOL_REWRITES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), symbol.trim());
  }

  private static fromTonal(symbol: string): ChordSymbol | null {
    const chord = Chord.get(ChordSymbol.clean(symbol));
    if (chord.empty || !chord.tonic) return null;
    const root = Note.chroma(chord.tonic);
    const hasThird = chord.intervals.some((name) => simpleNumber(name) === 3);
    const tones = chord.notes.map((name, index) => ({
      pitchClass: Note.chroma(name),
      role: roleFor(chord.intervals[index] ?? "1P", hasThird),
      name,
    }));
    const bass = chord.bass ? Note.chroma(chord.bass) : root;
    return new ChordSymbol(symbol, root, bass, tones);
  }

  /** Fallback for unusual spellings: root, minor/diminished/augmented/suspended quality, a seventh, a bass note. */
  private static fromPattern(symbol: string): ChordSymbol | null {
    const match = ROOT_AND_REST.exec(ChordSymbol.clean(symbol));
    const rootName = match?.[1];
    if (!match || !rootName) return null;
    const root = Note.chroma(rootName);
    const rest = (match[2] ?? "").toLowerCase();
    const bassName = match[3];
    const tone = (interval: number, role: ChordTone): ChordToneInfo => ({
      pitchClass: modulo(root + interval),
      role,
      name: nameOfPitchClass(modulo(root + interval)),
    });
    const tones: ChordToneInfo[] = [{ pitchClass: root, role: ChordTone.Root, name: rootName }];
    const minor = rest.startsWith("m") && !rest.startsWith("maj");
    if (rest.includes("sus2")) tones.push(tone(MAJOR_SECOND, ChordTone.Suspension));
    else if (rest.includes("sus")) tones.push(tone(PERFECT_FOURTH, ChordTone.Suspension));
    else tones.push(tone(minor || rest.includes("dim") ? MINOR_THIRD : MAJOR_THIRD, ChordTone.Third));
    const flatFifth = rest.includes("dim") || rest.includes("b5");
    const fifth = flatFifth ? PERFECT_FIFTH - 1 : rest.includes("aug") || rest.includes("+") ? PERFECT_FIFTH + 1 : PERFECT_FIFTH;
    tones.push(tone(fifth, ChordTone.Fifth));
    if (rest.includes("maj7")) tones.push(tone(MAJOR_SEVENTH, ChordTone.Seventh));
    else if (rest.includes("dim7")) tones.push(tone(DIMINISHED_SEVENTH, ChordTone.Seventh));
    else if (rest.includes("7")) tones.push(tone(MINOR_SEVENTH, ChordTone.Seventh));
    const bass = bassName ? Note.chroma(bassName) : root;
    return new ChordSymbol(symbol, root, bass, tones);
  }
}
