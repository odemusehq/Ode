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
const MINOR_THIRD = 3;

/** Common ways of writing chord symbols, rewritten to the forms tonal reads. */
const SYMBOL_REWRITES: readonly [RegExp, string][] = [
  [/♭/g, "b"],
  [/♯/g, "#"],
  [/Δ(?=\d)/g, "maj"],
  [/Δ/g, "maj7"],
  [/−/g, "-"],
  // Half-diminished (ø, ø7) and diminished (°, °7) signs.
  [/ø7?/g, "m7b5"],
  [/°/g, "dim"],
];

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
    const parsed = ChordSymbol.fromTonal(symbol);
    ChordSymbol.cache.set(symbol, parsed);
    return parsed;
  }

  /** Only these explicit chart spellings denote no chord; unknown/repeat text is not silence. */
  static isNoChord(symbol: string): boolean {
    return /^(?:NC|N\.C\.)$/i.test(symbol.trim());
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

  /** The chord's spelling of a pitch class, or a sharp name when it is outside the chord. */
  nameOf(pitchClass: number): string {
    return this.tones.find((tone) => tone.pitchClass === modulo(pitchClass))?.name ?? nameOfPitchClass(modulo(pitchClass));
  }

  /** Semitones from the root to a pitch class (0–11). */
  intervalFromRoot(pitchClass: number): number {
    return modulo(pitchClass - this.root);
  }

  private static clean(symbol: string): string | null {
    let depth = 0;
    for (const character of symbol) {
      if (character === "(") depth++;
      if (character === ")" && --depth < 0) return null;
    }
    if (depth !== 0) return null;
    const formatted = symbol.trim().replace(/\(\s*/g, "").replace(/\s*\)/g, "");
    const text = SYMBOL_REWRITES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), formatted);
    const [root, suffix, bass] = Chord.tokenize(text);
    if (!root) return null;
    // Tonal takes only the first slash bass, ignoring later components. A quality such as 6/9 has no bass token.
    if (bass && text.indexOf("/") !== text.lastIndexOf("/")) return null;
    // Closed spelling compatibility; the complete resulting quality must still exist in Tonal's dictionary.
    let quality = suffix.trim().replace(/(\d)\s*,\s*(?=[#b]?\d)/g, "$1")
      .replace(/^(?:minor|min)(?=$|\d|maj)/i, "m")
      .replace(/^major(?=$|\d)/i, "maj")
      .replace(/^dom7(?=$|[#b])/i, "7");
    if (quality.startsWith("m") || quality.startsWith("-")) {
      const rest = quality.slice(1);
      if (/^(?:major|maj)(?=$|\d)/i.test(rest)) quality = `m${rest.replace(/^(?:major|maj)(?=$|\d)/i, "Maj")}`;
    }
    return `${root}${quality}${bass ? `/${bass}` : ""}`;
  }

  private static fromTonal(symbol: string): ChordSymbol | null {
    const cleaned = ChordSymbol.clean(symbol);
    if (cleaned === null) return null;
    const chord = Chord.get(cleaned);
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
}
