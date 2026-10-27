import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Note } from "../../shared/live";
import { cx } from "./cx";
import { noteName } from "../../shared/notes";
import { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { STRESS_MARKS } from "./stress";
import type { Stress } from "./stress";
import type { CSSVariables } from "./types";
import "./PianoRoll.css";

export interface LyricMark {
  text: string;
  stress: Stress;
}

export interface PianoRollProps {
  label: string;
  notes: readonly Note[];
  /** Lyric syllable under each note, matched to `notes` by index. */
  lyrics?: readonly (LyricMark | null)[];
  beatsPerBar?: number;
  /** Clip length in beats; the roll is at least this long. */
  lengthBeats?: number;
}

interface PitchRange {
  low: number;
  high: number;
}

const ZOOM_STEPS = [0.25, 0.5, 1, 2, 4];
const DEFAULT_ZOOM_STEP = 2;
const EMPTY_RANGE: PitchRange = { low: 60, high: 72 };
const MIN_ROWS = 13;
const PADDING_ROWS = 2;
const HIGHEST_PITCH = 127;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const DEFAULT_VELOCITY = 100;
const MAX_VELOCITY = 127;

/** A read-only piano roll with optional lyric syllables under the notes. */
export function PianoRoll({ label, notes, lyrics, beatsPerBar = 4, lengthBeats = 0 }: PianoRollProps) {
  const [zoomStep, setZoomStep] = useState(DEFAULT_ZOOM_STEP);
  const descriptionId = useId();
  const range = pitchRange(notes);
  const rows = range.high - range.low + 1;
  const bars = barCount(notes, beatsPerBar, lengthBeats);
  const beats = bars * beatsPerBar;
  const pitches = Array.from({ length: rows }, (_, row) => range.high - row);
  const zoom = ZOOM_STEPS[zoomStep] ?? 1;
  const style: CSSVariables = { "--roll-beats": beats, "--roll-rows": rows, "--roll-zoom": zoom };

  const changeZoom = (step: number) => {
    setZoomStep((current) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, current + step)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") changeZoom(1);
    else if (event.key === "-") changeZoom(-1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="ode-roll">
      <div className="ode-roll__toolbar">
        <IconButton icon={IconName.ZoomOut} label="Zoom out" onClick={() => changeZoom(-1)} disabled={zoomStep === 0} />
        <span className="ode-roll__zoom">{Math.round(zoom * 100)}%</span>
        <IconButton
          icon={IconName.ZoomIn}
          label="Zoom in"
          onClick={() => changeZoom(1)}
          disabled={zoomStep === ZOOM_STEPS.length - 1}
        />
      </div>
      <div
        className="ode-roll__viewport"
        role="group"
        aria-label={label}
        aria-describedby={descriptionId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <p id={descriptionId} className="ode-visually-hidden">
          {describeNotes(notes, bars)}
        </p>
        <div className="ode-roll__canvas" style={style}>
          <div className="ode-roll__keys" aria-hidden="true">
            {pitches.map((pitch) => (
              <div key={pitch} className={cx("ode-roll__key", isBlackKey(pitch) && "ode-roll__key--black")}>
                {pitch % 12 === 0 ? noteName(pitch) : ""}
              </div>
            ))}
          </div>
          <svg className="ode-roll__grid" viewBox={`0 0 ${beats} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
            {pitches.map((pitch, row) => (
              <rect
                key={pitch}
                x={0}
                y={row}
                width={beats}
                height={1}
                className={isBlackKey(pitch) ? "ode-roll__row ode-roll__row--black" : "ode-roll__row"}
              />
            ))}
            {beatLines(beats, beatsPerBar).map((beat) => (
              <line key={`beat-${beat}`} x1={beat} x2={beat} y1={0} y2={rows} vectorEffect="non-scaling-stroke" className="ode-roll__beat-line" />
            ))}
            {Array.from({ length: bars + 1 }, (_, bar) => (
              <line
                key={`bar-${bar}`}
                x1={bar * beatsPerBar}
                x2={bar * beatsPerBar}
                y1={0}
                y2={rows}
                vectorEffect="non-scaling-stroke"
                className="ode-roll__bar-line"
              />
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
              >
                <title>{noteTitle(note)}</title>
              </rect>
            ))}
          </svg>
          <div className="ode-roll__corner" aria-hidden="true" />
          <div className="ode-roll__lyrics" aria-hidden="true">
            {notes.map((note, index) => {
              const mark = lyrics?.[index];
              if (!mark) return null;
              return (
                <span
                  key={index}
                  className={cx("ode-roll__syllable", mark.stress > 0 && "ode-roll__syllable--stressed")}
                  style={{ left: `${(note.start / beats) * 100}%` }}
                >
                  <span className="ode-roll__stress">{STRESS_MARKS[mark.stress]}</span>
                  {mark.text}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function pitchRange(notes: readonly Note[]): PitchRange {
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

function beatLines(beats: number, beatsPerBar: number): number[] {
  const lines: number[] = [];
  for (let beat = 1; beat < beats; beat += 1) {
    if (beat % beatsPerBar !== 0) lines.push(beat);
  }
  return lines;
}

function isBlackKey(pitch: number): boolean {
  return BLACK_KEYS.has(pitch % 12);
}

function velocityStyle(note: Note): CSSVariables {
  return { "--note-velocity": (note.velocity ?? DEFAULT_VELOCITY) / MAX_VELOCITY };
}

function noteTitle(note: Note): string {
  return `${noteName(note.pitch)}, beat ${trim(note.start + 1)}, ${trim(note.duration)} beats`;
}

function describeNotes(notes: readonly Note[], bars: number): string {
  if (notes.length === 0) return "No notes.";
  const pitches = notes.map((note) => note.pitch);
  const low = noteName(Math.min(...pitches));
  const high = noteName(Math.max(...pitches));
  return `${notes.length} notes from ${low} to ${high} over ${bars} bars.`;
}

function trim(value: number): string {
  return String(Number(value.toFixed(3)));
}
