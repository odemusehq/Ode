import type { Note } from "../../shared/live";
import { clamp, median } from "./melody-line";
import type { Meter } from "./meter";

/** How much each factor adds to a note's weight: position in the bar, length, melodic high point. */
const METRICAL_SHARE = 0.6;
const DURATION_SHARE = 0.25;
const PEAK_SHARE = 0.15;
/** A note four times the typical length (two doublings) gets the full length weight. */
const DOUBLINGS_FOR_FULL_LENGTH = 2;
const HIGHEST_NOTE_PEAK = 1;
const LOCAL_PEAK = 0.6;

export interface WeightedNote {
  note: Note;
  metrical: number;
  length: number;
  peak: number;
  /** 0–1: how strongly the note is felt. */
  weight: number;
}

/** Weighs each note of a line by metrical position, length relative to the line and melodic peaks. */
export class NoteWeigher {
  constructor(private readonly meter: Meter) {}

  weigh(notes: Note[]): WeightedNote[] {
    const typical = median(notes.map((note) => note.duration)) || 1;
    const highest = Math.max(...notes.map((note) => note.pitch));
    const varied = notes.some((note) => note.pitch !== highest);
    return notes.map((note, index) => {
      const metrical = this.meter.weightAt(note.start);
      const length = clamp(Math.log2(note.duration / typical) / (2 * DOUBLINGS_FOR_FULL_LENGTH) + 0.5, 0, 1);
      const previous = notes[index - 1];
      const next = notes[index + 1];
      const localPeak = previous !== undefined && next !== undefined && note.pitch > previous.pitch && note.pitch > next.pitch;
      const peak = varied && note.pitch === highest ? HIGHEST_NOTE_PEAK : localPeak ? LOCAL_PEAK : 0;
      return { note, metrical, length, peak, weight: METRICAL_SHARE * metrical + DURATION_SHARE * length + PEAK_SHARE * peak };
    });
  }

  /** Weight of part of a note that starts off the note's own start (after splitting it). */
  partWeight(start: number): number {
    return METRICAL_SHARE * this.meter.weightAt(start);
  }
}
