import type { ChordEvent } from "../../shared/song";
import { ChordSymbol } from "./chord-symbol";

export interface TimedChord {
  start: number;
  end: number;
  chord: ChordSymbol | null;
  symbol: string;
}

/** Beats closer than this count as the same moment. */
const TIME_TOLERANCE = 1e-6;

/** Chord events in time order, to ask which chord sounds at a beat. */
export class ChordTimeline {
  private readonly chords: TimedChord[];

  constructor(events: ChordEvent[]) {
    this.chords = [...events]
      .sort((a, b) => a.beat - b.beat)
      .map((event) => ({
        start: event.beat,
        end: event.beat + event.lengthBeats,
        chord: ChordSymbol.parse(event.symbol),
        symbol: event.symbol,
      }));
  }

  get empty(): boolean {
    return this.chords.length === 0;
  }

  /** Beat where the last chord ends. */
  get end(): number {
    return this.chords.reduce((latest, chord) => Math.max(latest, chord.end), 0);
  }

  /** The chord sounding at a beat (the last one started at or before it), or null. */
  at(beat: number): ChordSymbol | null {
    let found: TimedChord | undefined;
    for (const chord of this.chords) {
      if (chord.start <= beat + TIME_TOLERANCE) found = chord;
      else break;
    }
    return found && beat < found.end ? found.chord : null;
  }

  /** Every chord with its timing, in order. */
  entries(): readonly TimedChord[] {
    return this.chords;
  }
}
