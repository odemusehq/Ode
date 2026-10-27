import type { Note } from "../../shared/live";

/** Grid steps the transcriber chooses between, in beats (one beat is a quarter note). */
export enum GridDivision {
  Eighth = 0.5,
  Sixteenth = 0.25,
}

/** A note with free timing, in beats. */
export interface TimedNote {
  pitch: number;
  start: number;
  end: number;
  velocity: number;
}

/**
 * Timing error, in beats, that the sixteenth grid must save for each note it places off the eighth grid
 * before it is preferred: the price of the busier rhythm.
 */
export const SIXTEENTH_COMPLEXITY_COST = 0.1;

interface SnappedNote extends TimedNote {
  sourceLength: number;
}

/** Fits note timing to the song's grid, choosing between eighths and sixteenths. */
export class GridQuantizer {
  constructor(private readonly complexityCost: number = SIXTEENTH_COMPLEXITY_COST) {}

  /** The grid whose mean timing error plus complexity cost is lower (eighths on a tie). */
  choose(notes: readonly TimedNote[]): GridDivision {
    if (notes.length === 0) return GridDivision.Eighth;
    return this.cost(notes, GridDivision.Sixteenth) < this.cost(notes, GridDivision.Eighth)
      ? GridDivision.Sixteenth
      : GridDivision.Eighth;
  }

  /**
   * Snaps starts and ends to the grid; every note lasts at least one step, notes snapped to the
   * same start keep the longer one, and each note ends where the next begins at the latest.
   */
  quantize(notes: readonly TimedNote[], grid: GridDivision): Note[] {
    const snapped: SnappedNote[] = [];
    for (const note of [...notes].sort((a, b) => a.start - b.start)) {
      const start = snap(note.start, grid);
      const candidate = {
        ...note,
        start,
        end: Math.max(start + grid, snap(note.end, grid)),
        sourceLength: note.end - note.start,
      };
      const previous = snapped[snapped.length - 1];
      if (previous && previous.start === start) {
        if (candidate.sourceLength > previous.sourceLength) snapped[snapped.length - 1] = candidate;
        continue;
      }
      snapped.push(candidate);
    }
    snapped.forEach((note, index) => {
      const next = snapped[index + 1];
      if (next) note.end = Math.min(note.end, next.start);
    });
    return snapped
      .filter((note) => note.end > note.start)
      .map((note) => ({ pitch: note.pitch, start: note.start, duration: note.end - note.start, velocity: note.velocity }));
  }

  private cost(notes: readonly TimedNote[], grid: GridDivision): number {
    let error = 0;
    let offEighth = 0;
    for (const note of notes) {
      const start = snap(note.start, grid);
      error += Math.abs(note.start - start);
      if (!Number.isInteger(start / GridDivision.Eighth)) offEighth++;
    }
    return (error + this.complexityCost * offEighth) / notes.length;
  }
}

function snap(beat: number, grid: GridDivision): number {
  return Math.max(0, Math.round(beat / grid) * grid);
}
