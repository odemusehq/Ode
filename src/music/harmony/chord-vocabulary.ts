import { Chord, Note } from "tonal";
import { ChordSymbol, ChordTone } from "./chord-symbol";
import { ChordFamily } from "./harmony-style";
import type { MusicalKey } from "./musical-key";

export enum ChordFunction {
  Tonic = "tonic",
  Predominant = "predominant",
  Dominant = "dominant",
}

export interface ChordCandidate {
  symbol: string;
  roman: string;
  chord: ChordSymbol;
  family: ChordFamily;
  function: ChordFunction;
  /** Root of the chord a secondary dominant resolves to, or null. */
  resolvesTo: number | null;
  /** The key's own tonic chord (I or i). */
  tonic: boolean;
}

const PITCH_CLASSES = 12;
const MINOR_THIRD = 3;
const DIMINISHED_FIFTH = 6;
const AUGMENTED_FIFTH = 8;
const MINOR_SEVENTH = 10;
const MAJOR_SEVENTH = 11;
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
/** Semitones of each degree of the major scale, for flats and sharps in Roman numerals. */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const TONIC_DEGREE = 0;
const SUBDOMINANT_DEGREE = 3;
const DOMINANT_DEGREE = 4;
const MAJOR_FUNCTIONS: readonly ChordFunction[] = [
  ChordFunction.Tonic,
  ChordFunction.Predominant,
  ChordFunction.Tonic,
  ChordFunction.Predominant,
  ChordFunction.Dominant,
  ChordFunction.Tonic,
  ChordFunction.Dominant,
];
const MINOR_FUNCTIONS: readonly ChordFunction[] = [
  ChordFunction.Tonic,
  ChordFunction.Predominant,
  ChordFunction.Tonic,
  ChordFunction.Predominant,
  ChordFunction.Dominant,
  ChordFunction.Predominant,
  ChordFunction.Dominant,
];
/** Chords borrowed from the parallel minor into a major key: iv, bIII, bVI, bVII (interval above the tonic, degree, quality). */
const BORROWED_INTO_MAJOR: readonly [string, number, string][] = [
  ["4P", 3, "m"],
  ["3m", 2, ""],
  ["6m", 5, ""],
  ["7m", 6, ""],
];
/** Chords borrowed from the parallel major (Dorian IV) into a minor key. */
const BORROWED_INTO_MINOR: readonly [string, number, string][] = [["4P", 3, ""]];
/** Degrees that get a secondary dominant: ii, IV, V, vi in major; III, iv, v, VI in minor. */
const SECONDARY_TARGETS_MAJOR = [1, 3, 4, 5];
const SECONDARY_TARGETS_MINOR = [2, 3, 4, 5];

function modulo(value: number): number {
  return ((value % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

/** The chords Ode considers when harmonising in a key. */
export class ChordVocabulary {
  constructor(private readonly key: MusicalKey) {}

  build(): ChordCandidate[] {
    const candidates: ChordCandidate[] = [];
    const triads = this.key.triads();
    triads.forEach((symbol, degree) => this.add(candidates, symbol, degree, ChordFamily.Diatonic));
    this.key.sevenths().forEach((symbol, degree) => this.add(candidates, symbol, degree, ChordFamily.Seventh));
    if (this.key.mode === "aeolian") {
      const dominant = this.key.noteAbove("5P");
      this.add(candidates, dominant, DOMINANT_DEGREE, ChordFamily.Diatonic);
      this.add(candidates, `${dominant}7`, DOMINANT_DEGREE, ChordFamily.Seventh);
    }
    for (const [interval, degree, quality] of this.key.minor ? BORROWED_INTO_MINOR : BORROWED_INTO_MAJOR) {
      this.add(candidates, this.key.noteAbove(interval) + quality, degree, ChordFamily.Borrowed);
    }
    for (const degree of this.key.minor ? SECONDARY_TARGETS_MINOR : SECONDARY_TARGETS_MAJOR) {
      this.addSecondaryDominant(candidates, triads[degree], degree);
    }
    this.addColour(candidates, triads);
    return candidates;
  }

  private add(candidates: ChordCandidate[], symbol: string, degree: number, family: ChordFamily, roman?: string): void {
    if (candidates.some((candidate) => candidate.symbol === symbol)) return;
    const chord = ChordSymbol.parse(symbol);
    if (!chord) return;
    const functions = this.key.minor ? MINOR_FUNCTIONS : MAJOR_FUNCTIONS;
    candidates.push({
      symbol,
      roman: roman ?? this.roman(degree, chord, symbol),
      chord,
      family,
      function: functions[degree] ?? ChordFunction.Tonic,
      resolvesTo: null,
      tonic: degree === TONIC_DEGREE && family !== ChordFamily.Borrowed && chord.root === this.key.root,
    });
  }

  private addSecondaryDominant(candidates: ChordCandidate[], target: string | undefined, degree: number): void {
    const targetChord = target ? ChordSymbol.parse(target) : null;
    const targetTonic = target ? Chord.get(target).tonic : null;
    if (!targetChord || !targetTonic || this.isDiminished(targetChord)) return;
    const symbol = `${Note.pitchClass(Note.transpose(targetTonic, "5P"))}7`;
    const chord = ChordSymbol.parse(symbol);
    if (!chord || candidates.some((candidate) => candidate.symbol === symbol)) return;
    candidates.push({
      symbol,
      roman: `V7/${this.roman(degree, targetChord, target ?? "")}`,
      chord,
      family: ChordFamily.SecondaryDominant,
      function: ChordFunction.Dominant,
      resolvesTo: targetChord.root,
      tonic: false,
    });
  }

  /** sus2, sus4 and add9 colours of I, IV and V. */
  private addColour(candidates: ChordCandidate[], triads: string[]): void {
    const tonic = Chord.get(triads[TONIC_DEGREE] ?? "").tonic;
    const subdominant = Chord.get(triads[SUBDOMINANT_DEGREE] ?? "").tonic;
    const dominant = this.key.mode === "aeolian" ? this.key.noteAbove("5P") : Chord.get(triads[DOMINANT_DEGREE] ?? "").tonic;
    const added = this.key.minor ? "madd9" : "add9";
    const colours: [string | null, number, string[]][] = [
      [tonic, TONIC_DEGREE, ["sus2", "sus4", added]],
      [subdominant, SUBDOMINANT_DEGREE, ["sus2", this.key.minor ? "madd9" : "add9"]],
      [dominant, DOMINANT_DEGREE, ["sus4"]],
    ];
    for (const [root, degree, suffixes] of colours) {
      if (!root) continue;
      for (const suffix of suffixes) this.add(candidates, root + suffix, degree, ChordFamily.Colour);
    }
  }

  private interval(chord: ChordSymbol, role: ChordTone): number | undefined {
    const tone = chord.tones.find((candidate) => candidate.role === role);
    return tone ? chord.intervalFromRoot(tone.pitchClass) : undefined;
  }

  private isDiminished(chord: ChordSymbol): boolean {
    return this.interval(chord, ChordTone.Fifth) === DIMINISHED_FIFTH;
  }

  /** Roman numeral with flats or sharps against the major scale, case for quality, and the chord's extension. */
  private roman(degree: number, chord: ChordSymbol, symbol: string): string {
    const offset = modulo(chord.root - this.key.root) - (MAJOR_SCALE[degree] ?? 0);
    const accidental = offset === -1 || offset === PITCH_CLASSES - 1 ? "b" : offset === 1 ? "#" : "";
    const numeral = ROMAN_NUMERALS[degree] ?? "I";
    const minorThird = this.interval(chord, ChordTone.Third) === MINOR_THIRD;
    const diminished = this.isDiminished(chord);
    const augmented = this.interval(chord, ChordTone.Fifth) === AUGMENTED_FIFTH;
    const seventh = this.interval(chord, ChordTone.Seventh);
    const base = minorThird || diminished ? numeral.toLowerCase() : numeral;
    let suffix = "";
    if (diminished && seventh === MINOR_SEVENTH) suffix = "ø7";
    else if (diminished) suffix = "°";
    else if (augmented) suffix = "+";
    else if (seventh !== undefined) suffix = seventh === MAJOR_SEVENTH ? "maj7" : "7";
    const colour = /sus2|sus4|add9/.exec(symbol)?.[0] ?? "";
    return accidental + base + suffix + colour;
  }
}
