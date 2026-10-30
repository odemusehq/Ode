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

/** Validate a computational chart without rewriting its saved symbols or timing. Null means explicit NC only. */
export function parseChordEvents(events: ChordEvent[]): { event: ChordEvent; chord: ChordSymbol | null }[] {
  const parsed = events.map((event) => {
    if (!Number.isFinite(event.beat) || event.beat < 0 || !Number.isFinite(event.lengthBeats) || event.lengthBeats <= 0 || !Number.isFinite(event.beat + event.lengthBeats)) {
      throw new RangeError(`Chord ${JSON.stringify(event.symbol)} at beat ${event.beat} needs a finite nonnegative start and positive finite length.`);
    }
    const noChord = ChordSymbol.isNoChord(event.symbol);
    const chord = noChord ? null : ChordSymbol.parse(event.symbol);
    if (!noChord && !chord) throw new Error(`Unsupported chord symbol ${JSON.stringify(event.symbol)} at beat ${event.beat}. Use a supported spelling or explicit MIDI notes for the intended harmony. NC/N.C. is only for an intentional no-chord passage.`);
    return { event, chord };
  }).sort((a, b) => a.event.beat - b.event.beat);
  for (let index = 1; index < parsed.length; index++) {
    const previous = parsed[index - 1]!.event;
    const current = parsed[index]!.event;
    if (current.beat < previous.beat + previous.lengthBeats - TIME_TOLERANCE) {
      throw new Error(`Chord ${JSON.stringify(current.symbol)} at beat ${current.beat} overlaps ${JSON.stringify(previous.symbol)}. Choose the intended nonoverlapping spans explicitly; no notes or chart text were trimmed.`);
    }
  }
  return parsed;
}

/** Chord events in time order, to ask which chord sounds at a beat. */
export class ChordTimeline {
  private readonly chords: TimedChord[];

  constructor(events: ChordEvent[]) {
    this.chords = parseChordEvents(events)
      .map(({ event, chord }) => ({
        start: event.beat,
        end: event.beat + event.lengthBeats,
        chord,
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
