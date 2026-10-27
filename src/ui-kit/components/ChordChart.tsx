import type { ChordEvent } from "../../shared/song";
import { cx } from "./cx";
import "./ChordChart.css";

export interface ChordChartProps {
  label: string;
  chords: readonly ChordEvent[];
  /** Section length in beats. */
  lengthBeats: number;
  beatsPerBar: number;
}

interface Bar {
  number: number;
  /** First beat of the bar. */
  start: number;
  /** Chords that start in this bar. */
  chords: ChordEvent[];
  /** Chord still sounding from an earlier bar when this bar starts. */
  held: ChordEvent | null;
  /** True when the held chord filled the whole previous bar on its own. */
  repeat: boolean;
}

const NO_CHORD = "N.C.";
const REPEAT_BAR = "%";
const BEAT_TOLERANCE = 1e-6;

/** Bars of a section with the chord symbols that start in each. */
export function ChordChart({ label, chords, lengthBeats, beatsPerBar }: ChordChartProps) {
  const bars = buildBars(chords, lengthBeats, beatsPerBar);
  return (
    <ol className="ode-chords" aria-label={label}>
      {bars.map((bar) => (
        <li key={bar.number} className="ode-chords__bar">
          <span className="ode-chords__number" aria-hidden="true">
            {bar.number}
          </span>
          <span className="ode-visually-hidden">Bar {bar.number}: </span>
          <BarSymbols bar={bar} />
        </li>
      ))}
    </ol>
  );
}

interface BarSymbolsProps {
  bar: Bar;
}

function BarSymbols({ bar }: BarSymbolsProps) {
  if (bar.chords.length > 0) {
    return (
      <span className="ode-chords__symbols">
        {bar.chords.map((chord, index) => (
          <span key={index} className="ode-chords__symbol">
            {chord.symbol}
          </span>
        ))}
      </span>
    );
  }
  if (bar.held && bar.repeat) {
    return (
      <span className="ode-chords__symbols ode-chords__symbols--held" title={`Same as the previous bar: ${bar.held.symbol}`}>
        <span aria-hidden="true">{REPEAT_BAR}</span>
        <span className="ode-visually-hidden">{bar.held.symbol} continues</span>
      </span>
    );
  }
  return (
    <span className={cx("ode-chords__symbols", "ode-chords__symbols--held")}>
      {bar.held ? bar.held.symbol : NO_CHORD}
    </span>
  );
}

function buildBars(chords: readonly ChordEvent[], lengthBeats: number, beatsPerBar: number): Bar[] {
  const sorted = [...chords].sort((a, b) => a.beat - b.beat);
  const lastEnd = sorted.reduce((end, chord) => Math.max(end, chord.beat + chord.lengthBeats), 0);
  const count = Math.max(1, Math.ceil(Math.max(lengthBeats, lastEnd) / beatsPerBar));
  const bars: Bar[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * beatsPerBar;
    const end = start + beatsPerBar;
    const starting = sorted.filter((chord) => chord.beat >= start && chord.beat < end);
    const held = sorted.find((chord) => chord.beat < start && chord.beat + chord.lengthBeats > start) ?? null;
    const previous = bars[index - 1];
    const repeat = held !== null && previous !== undefined && fillsBar(previous, held);
    bars.push({ number: index + 1, start, chords: starting, held, repeat });
  }
  return bars;
}

function fillsBar(bar: Bar, chord: ChordEvent): boolean {
  if (bar.chords.length === 0) return bar.held === chord;
  return bar.chords.length === 1 && bar.chords[0] === chord && Math.abs(chord.beat - bar.start) < BEAT_TOLERANCE;
}
