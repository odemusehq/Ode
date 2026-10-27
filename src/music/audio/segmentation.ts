import { median } from "./signal";
import { meanDb } from "./units";

export interface PitchedFrame {
  /** Frame centre, seconds. */
  time: number;
  /** Tuning-corrected fractional MIDI note number, or null when unvoiced. */
  midi: number | null;
  /** RMS level, dBFS. */
  level: number;
  /** True when a note onset was detected at this frame. */
  onset: boolean;
}

export interface NoteSegment {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  /** Median fractional MIDI note number over the segment. */
  midi: number;
  /** Average level, dBFS. */
  level: number;
  /** True when the segment begins on a level onset (a new syllable or attack). */
  articulated: boolean;
}

export interface SegmenterOptions {
  /** Distance from the current note's pitch that can start a new note, semitones. */
  splitSemitones: number;
  /** Frames the new pitch must hold before the note is split. */
  stableFrames: number;
  /** Frames either side of a segment's start in which an onset counts as its attack. */
  onsetToleranceFrames: number;
}

export const DEFAULT_SEGMENTER_OPTIONS: Readonly<SegmenterOptions> = {
  splitSemitones: 0.8,
  stableFrames: 6,
  onsetToleranceFrames: 3,
};

interface OpenSegment {
  startFrame: number;
  pitches: number[];
  levels: number[];
}

/**
 * Cuts a pitch track into notes: a note ends where voicing stops, where the level jumps up
 * (a new attack), or where the pitch moves away from the note's median pitch and settles there.
 */
export class NoteSegmenter {
  private readonly options: SegmenterOptions;

  constructor(
    private readonly hopSeconds: number,
    options: Partial<SegmenterOptions> = {},
  ) {
    this.options = { ...DEFAULT_SEGMENTER_OPTIONS, ...options };
  }

  segment(frames: readonly PitchedFrame[]): NoteSegment[] {
    const segments: NoteSegment[] = [];
    let current: OpenSegment | null = null;
    for (let k = 0; k < frames.length; k++) {
      const frame = frames[k]!;
      if (frame.midi === null) {
        if (current) segments.push(this.close(current, k, frames));
        current = null;
        continue;
      }
      if (current && this.startsNewNote(current, frames, k)) {
        segments.push(this.close(current, k, frames));
        current = null;
      }
      current ??= { startFrame: k, pitches: [], levels: [] };
      current.pitches.push(frame.midi);
      current.levels.push(frame.level);
    }
    if (current) segments.push(this.close(current, frames.length, frames));
    return segments;
  }

  private startsNewNote(current: OpenSegment, frames: readonly PitchedFrame[], k: number): boolean {
    const frame = frames[k]!;
    if (frame.onset && k - current.startFrame > this.options.onsetToleranceFrames) return true;
    const reference = median(current.pitches);
    return frame.midi !== null && Math.abs(frame.midi - reference) > this.options.splitSemitones && this.settles(frames, k, reference);
  }

  /** True when the pitch from frame k on stays away from the reference and close to its new value for stableFrames frames. */
  private settles(frames: readonly PitchedFrame[], k: number, reference: number): boolean {
    const target = frames[k]?.midi;
    if (target === null || target === undefined) return false;
    for (let j = k; j < k + this.options.stableFrames; j++) {
      const midi = frames[j]?.midi;
      if (midi === null || midi === undefined) return false;
      if (Math.abs(midi - reference) <= this.options.splitSemitones) return false;
      if (Math.abs(midi - target) > this.options.splitSemitones) return false;
    }
    return true;
  }

  private close(segment: OpenSegment, endFrame: number, frames: readonly PitchedFrame[]): NoteSegment {
    const first = frames[segment.startFrame]!;
    const last = frames[endFrame - 1]!;
    const tolerance = this.options.onsetToleranceFrames;
    let articulated = false;
    for (let j = Math.max(0, segment.startFrame - tolerance); j <= Math.min(frames.length - 1, segment.startFrame + tolerance); j++) {
      if (frames[j]!.onset) articulated = true;
    }
    return {
      start: Math.max(0, first.time - this.hopSeconds / 2),
      end: last.time + this.hopSeconds / 2,
      midi: median(segment.pitches),
      level: meanDb(segment.levels),
      articulated,
    };
  }
}
