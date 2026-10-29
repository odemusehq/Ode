import type { Note } from "../../shared/live";
import { noteName } from "../../shared/notes";
import { cx } from "./cx";
import type { CSSVariables } from "./types";
import "./PianoRoll.css";

export interface PianoRollProps {
  label: string;
  notes: readonly Note[];
  /** Quarter-note beats per bar, for the bar lines. */
  beatsPerBar: number | null;
  /** Length in beats; the roll is at least this long. Give two rolls the same length to compare them. */
  lengthBeats?: number;
  /** Rows to show; give two rolls the same range to compare them. Fits the notes when left out. */
  pitchRange?: PitchRange;
}

/** Lowest and highest MIDI note shown. */
export interface PitchRange {
  low: number;
  high: number;
}

const EMPTY_RANGE: PitchRange = { low: 60, high: 72 };
const MIN_ROWS = 13;
const PADDING_ROWS = 2;
const HIGHEST_PITCH = 127;
const PITCH_CLASSES = 12;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const DEFAULT_VELOCITY = 100;
const MAX_VELOCITY = 127;

/**
 * A read-only piano roll that fills its width at a fixed row height, so two rolls with the same range and length
 * line up bar for bar.
 */
export function PianoRoll({ label, notes, beatsPerBar, lengthBeats = 0, pitchRange }: PianoRollProps) {
  const range = pitchRange ?? pitchRangeOf(notes);
  const rows = range.high - range.low + 1;
  const meter = beatsPerBar !== null && beatsPerBar > 0 ? beatsPerBar : null;
  const grid = meter ?? 1;
  const bars = barCount(notes, grid, lengthBeats);
  const beats = bars * grid;
  const pitches = Array.from({ length: rows }, (_, row) => range.high - row);
  const style: CSSVariables = { "--roll-rows": rows };

  return (
    <div className="ode-roll" role="img" aria-label={`${label}: ${describeNotes(notes, bars, meter !== null)}`} style={style}>
      <div className="ode-roll__keys" aria-hidden="true">
        {pitches.map((pitch) => (
          <div key={pitch} className={cx("ode-roll__key", isBlackKey(pitch) && "ode-roll__key--black")}>
            {pitch % PITCH_CLASSES === 0 && <span className="ode-roll__key-name">{noteName(pitch)}</span>}
          </div>
        ))}
      </div>
      <svg className="ode-roll__grid" viewBox={`0 0 ${beats} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
        {pitches.map((pitch, row) => (
          <rect key={pitch} x={0} y={row} width={beats} height={1} className={cx("ode-roll__row", isBlackKey(pitch) && "ode-roll__row--black")} />
        ))}
        {beatLines(beats, meter).map((beat) => (
          <line key={`beat-${beat}`} x1={beat} x2={beat} y1={0} y2={rows} vectorEffect="non-scaling-stroke" className="ode-roll__beat-line" />
        ))}
        {meter !== null && Array.from({ length: bars - 1 }, (_, index) => (index + 1) * meter).map((beat) => (
          <line key={`bar-${beat}`} x1={beat} x2={beat} y1={0} y2={rows} vectorEffect="non-scaling-stroke" className="ode-roll__bar-line" />
        ))}
        {notes.map((note, index) => (
          <rect
            key={index}
            x={note.start}
            y={range.high - note.pitch}
            width={note.duration}
            height={1}
            vectorEffect="non-scaling-stroke"
            className={cx("ode-roll__note", note.muted && "ode-roll__note--muted")}
            style={velocityStyle(note)}
          />
        ))}
      </svg>
    </div>
  );
}

/** The rows a roll needs for these notes, with a little room above and below. */
export function pitchRangeOf(notes: readonly Note[]): PitchRange {
  if (notes.length === 0) return EMPTY_RANGE;
  const pitches = notes.map((note) => note.pitch);
  let low = Math.min(...pitches) - PADDING_ROWS;
  let high = Math.max(...pitches) + PADDING_ROWS;
  const missing = MIN_ROWS - (high - low + 1);
  if (missing > 0) {
    low -= Math.floor(missing / 2);
    high += Math.ceil(missing / 2);
  }
  return { low: Math.max(0, low), high: Math.min(HIGHEST_PITCH, high) };
}

function barCount(notes: readonly Note[], beatsPerBar: number, lengthBeats: number): number {
  const lastEnd = notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
  return Math.max(1, Math.ceil(Math.max(lengthBeats, lastEnd) / beatsPerBar));
}

function beatLines(beats: number, beatsPerBar: number | null): number[] {
  const lines: number[] = [];
  for (let beat = 1; beat < beats; beat += 1) {
    if (beatsPerBar === null || beat % beatsPerBar !== 0) lines.push(beat);
  }
  return lines;
}

function isBlackKey(pitch: number): boolean {
  return BLACK_KEYS.has(pitch % PITCH_CLASSES);
}

function velocityStyle(note: Note): CSSVariables {
  return { "--note-velocity": (note.velocity ?? DEFAULT_VELOCITY) / MAX_VELOCITY };
}

function describeNotes(notes: readonly Note[], bars: number, meterKnown: boolean): string {
  if (notes.length === 0) return "an empty clip";
  const pitches = notes.map((note) => note.pitch);
  const low = noteName(Math.min(...pitches));
  const high = noteName(Math.max(...pitches));
  const unit = meterKnown ? (bars === 1 ? "bar" : "bars") : (bars === 1 ? "quarter-note beat" : "quarter-note beats");
  return `${notes.length} notes from ${low} to ${high} over ${bars} ${unit}${meterKnown ? "" : "; time signature unavailable"}`;
}
