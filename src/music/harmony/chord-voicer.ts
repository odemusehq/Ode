import type { Note } from "../../shared/live";
import type { ChordEvent } from "../../shared/song";
import { ChordSymbol, ChordTone } from "./chord-symbol";
import { fitByOctaves, pitchesOfClass, rangeCentre, type PitchRange } from "./pitch-range";

/** Keyboard comping range for the upper voices (E3 to G5), used when no register is given. */
export const DEFAULT_VOICING_REGISTER: PitchRange = { low: 52, high: 79 };

export interface VoicingOptions {
  /** Upper voices per chord: 3 or 4 (default: 3 for triads, 4 for richer chords). */
  voices?: number;
  /** Add a bass note below the register (default true). */
  bass?: boolean;
}

export interface Voicing {
  /** The chord symbol, with the bass note added when an inversion was chosen ("C/E"). */
  symbol: string;
  beat: number;
  lengthBeats: number;
  bass: number | null;
  pitches: number[];
}

const MIN_VOICES = 3;
const MAX_VOICES = 4;
const RICH_CHORD_TONES = 4;
/** Upper voices stay within an octave of each other and within two octaves overall. */
const MAX_ADJACENT_GAP = 12;
const MAX_SPREAD = 24;
/** The bass sits in the octave and a half below the register, never below E1 (MIDI 28). */
const BASS_SPAN = 17;
const LOWEST_BASS = 28;
/** Close intervals below C3 (MIDI 48) sound muddy. */
const MUDDY_BELOW = 48;
const MUDDY_INTERVAL = 3;
const MUDDY_COST = 2;
const CENTRE_COST_PER_OCTAVE = 1.5;
const PARALLEL_PERFECT_COST = 0.5;
const PERFECT_INTERVALS = new Set([0, 7]);
/** Bass notes other than the root, and what they cost: inversions smooth the bass line but weaken the chord. */
const INVERSION_COST: ReadonlyMap<ChordTone, number> = new Map([
  [ChordTone.Root, 0],
  [ChordTone.Third, 0.6],
  [ChordTone.Fifth, 0.9],
]);
const OUTER_INVERSION_FACTOR = 2;
const CHORD_VELOCITY = 80;
const BASS_VELOCITY = 90;
const OCTAVE = 12;
/** Order in which chord tones are kept when there are more tones than voices. */
const TONE_PRIORITY: readonly ChordTone[] = [
  ChordTone.Third,
  ChordTone.Suspension,
  ChordTone.Seventh,
  ChordTone.Extension,
  ChordTone.Sixth,
  ChordTone.Root,
  ChordTone.Fifth,
];

interface ParsedEvent {
  event: ChordEvent;
  chord: ChordSymbol;
}

/**
 * Voices chords for keys or pads: 3–4 upper voices inside a register with smooth voice leading
 * (least total movement, no muddy low clusters, few parallel fifths and octaves), and a bass line
 * that uses roots and inversions to move smoothly.
 */
export class ChordVoicer {
  constructor(
    private readonly register: PitchRange = DEFAULT_VOICING_REGISTER,
    private readonly options: VoicingOptions = {},
  ) {}

  voice(chords: ChordEvent[]): { notes: Note[]; voicings: Voicing[] } {
    const events = [...chords]
      .sort((a, b) => a.beat - b.beat)
      .map((event) => ({ event, chord: ChordSymbol.parse(event.symbol) }))
      .filter((item): item is ParsedEvent => item.chord !== null);
    if (events.length === 0) return { notes: [], voicings: [] };
    const upper = this.upperVoices(events);
    const bass = this.options.bass === false ? events.map(() => null) : this.bassLine(events);
    const notes: Note[] = [];
    const voicings: Voicing[] = events.map(({ event, chord }, index) => {
      const pitches = upper[index] ?? [];
      const bassPitch = bass[index] ?? null;
      if (bassPitch !== null) notes.push({ pitch: bassPitch, start: event.beat, duration: event.lengthBeats, velocity: BASS_VELOCITY });
      for (const pitch of pitches) notes.push({ pitch, start: event.beat, duration: event.lengthBeats, velocity: CHORD_VELOCITY });
      const inverted = bassPitch !== null && bassPitch % OCTAVE !== chord.root && !event.symbol.includes("/");
      return {
        symbol: inverted ? `${event.symbol}/${chord.nameOf(bassPitch % OCTAVE)}` : event.symbol,
        beat: event.beat,
        lengthBeats: event.lengthBeats,
        bass: bassPitch,
        pitches,
      };
    });
    return { notes, voicings };
  }

  private upperVoices(events: ParsedEvent[]): number[][] {
    const options = events.map(({ chord }) => this.candidates(chord));
    const costs: number[][] = [];
    const back: number[][] = [];
    options.forEach((candidates, index) => {
      const previousOptions = options[index - 1];
      const previousCosts = costs[index - 1];
      costs.push([]);
      back.push([]);
      for (const candidate of candidates) {
        let best = 0;
        let bestCost = previousOptions ? Number.POSITIVE_INFINITY : 0;
        previousOptions?.forEach((previous, previousIndex) => {
          const total = (previousCosts?.[previousIndex] ?? 0) + this.movement(previous, candidate);
          if (total < bestCost) {
            bestCost = total;
            best = previousIndex;
          }
        });
        costs[index]?.push(bestCost + this.shapeCost(candidate));
        back[index]?.push(best);
      }
    });
    const result: number[][] = Array.from({ length: events.length }, () => []);
    const lastCosts = costs.at(-1) ?? [];
    let choice = lastCosts.indexOf(Math.min(...lastCosts));
    for (let index = events.length - 1; index >= 0; index--) {
      result[index] = options[index]?.[choice] ?? [];
      choice = back[index]?.[choice] ?? 0;
    }
    return result;
  }

  /** Voicings of one chord: the chosen tones placed in the register, within spacing limits. */
  private candidates(chord: ChordSymbol): number[][] {
    const tones = this.chooseTones(chord);
    let voicings: number[][] = [[]];
    for (const pitchClass of tones) {
      const placements = pitchesOfClass(pitchClass, this.register);
      voicings = voicings.flatMap((partial) => placements.filter((pitch) => !partial.includes(pitch)).map((pitch) => [...partial, pitch]));
    }
    const valid = voicings.map((voicing) => [...voicing].sort((a, b) => a - b)).filter((voicing) => this.wellSpaced(voicing));
    const unique = [...new Map(valid.map((voicing): [string, number[]] => [voicing.join(","), voicing])).values()];
    return unique.length > 0 ? unique : [this.closePosition(tones)];
  }

  private chooseTones(chord: ChordSymbol): number[] {
    const requested = this.options.voices ?? (chord.tones.length >= RICH_CHORD_TONES ? MAX_VOICES : MIN_VOICES);
    const count = Math.min(MAX_VOICES, Math.max(MIN_VOICES, Math.round(requested)));
    const ordered = [...chord.tones].sort((a, b) => TONE_PRIORITY.indexOf(a.role) - TONE_PRIORITY.indexOf(b.role));
    const chosen: number[] = [];
    for (const tone of ordered) {
      if (chosen.length < count && !chosen.includes(tone.pitchClass)) chosen.push(tone.pitchClass);
    }
    const doubling = [chord.root, ...chord.tones.filter((tone) => tone.role === ChordTone.Fifth).map((tone) => tone.pitchClass)];
    for (const pitchClass of doubling) if (chosen.length < count) chosen.push(pitchClass);
    return chosen;
  }

  private wellSpaced(voicing: number[]): boolean {
    const lowest = voicing[0];
    const highest = voicing.at(-1);
    if (lowest === undefined || highest === undefined || highest - lowest > MAX_SPREAD) return false;
    return voicing.every((pitch, index) => index === 0 || pitch - (voicing[index - 1] ?? pitch) <= MAX_ADJACENT_GAP);
  }

  /** Tones stacked upwards from the bottom of the register, one after another. */
  private closePosition(tones: number[]): number[] {
    let pitch = this.register.low - 1;
    return tones.map((pitchClass) => {
      pitch += 1;
      while (pitch % OCTAVE !== pitchClass) pitch += 1;
      return pitch;
    });
  }

  private shapeCost(voicing: number[]): number {
    const mean = voicing.reduce((sum, pitch) => sum + pitch, 0) / Math.max(1, voicing.length);
    let cost = (Math.abs(mean - rangeCentre(this.register)) / OCTAVE) * CENTRE_COST_PER_OCTAVE;
    const [lowest, next] = voicing;
    if (lowest !== undefined && next !== undefined && lowest < MUDDY_BELOW && next - lowest < MUDDY_INTERVAL) cost += MUDDY_COST;
    return cost;
  }

  /** Total movement between voicings, plus a cost for parallel fifths and octaves. */
  private movement(previous: number[], next: number[]): number {
    let cost = next.reduce((sum, pitch) => sum + Math.min(...previous.map((earlier) => Math.abs(earlier - pitch))), 0);
    if (previous.length !== next.length) return cost;
    for (let low = 0; low < next.length; low++) {
      for (let high = low + 1; high < next.length; high++) {
        const before = ((previous[high] ?? 0) - (previous[low] ?? 0)) % OCTAVE;
        const after = ((next[high] ?? 0) - (next[low] ?? 0)) % OCTAVE;
        const movedLow = (next[low] ?? 0) - (previous[low] ?? 0);
        const movedHigh = (next[high] ?? 0) - (previous[high] ?? 0);
        if (PERFECT_INTERVALS.has(before) && before === after && movedLow !== 0 && Math.sign(movedLow) === Math.sign(movedHigh)) {
          cost += PARALLEL_PERFECT_COST;
        }
      }
    }
    return cost;
  }

  /** Bass notes by dynamic programming: roots preferred, inversions when they make the line smoother. */
  private bassLine(events: ParsedEvent[]): (number | null)[] {
    const range: PitchRange = { low: Math.max(LOWEST_BASS, this.register.low - BASS_SPAN), high: this.register.low - 1 };
    const options = events.map(({ chord }, index) => this.bassOptions(chord, range, index === 0 || index === events.length - 1));
    const costs: number[][] = [];
    const back: number[][] = [];
    options.forEach((candidates, index) => {
      const previousOptions = options[index - 1];
      const previousCosts = costs[index - 1];
      costs.push([]);
      back.push([]);
      for (const candidate of candidates) {
        let best = 0;
        let bestCost = previousOptions ? Number.POSITIVE_INFINITY : 0;
        previousOptions?.forEach((previous, previousIndex) => {
          const total = (previousCosts?.[previousIndex] ?? 0) + Math.abs(candidate.pitch - previous.pitch) / OCTAVE;
          if (total < bestCost) {
            bestCost = total;
            best = previousIndex;
          }
        });
        costs[index]?.push(bestCost + candidate.cost);
        back[index]?.push(best);
      }
    });
    const result = new Array<number | null>(events.length).fill(null);
    const lastCosts = costs.at(-1) ?? [];
    let choice = lastCosts.indexOf(Math.min(...lastCosts));
    for (let index = events.length - 1; index >= 0; index--) {
      result[index] = options[index]?.[choice]?.pitch ?? null;
      choice = back[index]?.[choice] ?? 0;
    }
    return result;
  }

  private bassOptions(chord: ChordSymbol, range: PitchRange, outer: boolean): { pitch: number; cost: number }[] {
    const options: { pitch: number; cost: number }[] = [];
    if (chord.bass !== chord.root) {
      for (const pitch of pitchesOfClass(chord.bass, range)) options.push({ pitch, cost: 0 });
    } else {
      for (const tone of chord.tones) {
        const inversion = INVERSION_COST.get(tone.role);
        if (inversion === undefined) continue;
        const cost = outer ? inversion * OUTER_INVERSION_FACTOR : inversion;
        for (const pitch of pitchesOfClass(tone.pitchClass, range)) options.push({ pitch, cost });
      }
    }
    return options.length > 0 ? options : [{ pitch: fitByOctaves(chord.bass, range), cost: 0 }];
  }
}

/** Voices chords with smooth voice leading: notes for a MIDI clip (bass plus 3–4 upper voices per chord). */
export function voiceChords(chords: ChordEvent[], register: PitchRange = DEFAULT_VOICING_REGISTER, options: VoicingOptions = {}): Note[] {
  return new ChordVoicer(register, options).voice(chords).notes;
}
