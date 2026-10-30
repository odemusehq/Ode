import { Stress, type StressLevel } from "../phonetics/pronunciation";
import { stressMismatch } from "../prosody/lyric-setter";
import type { Meter } from "../prosody/meter";
import type { PlannedSyllable } from "../prosody/option-chooser";
import type { SeededRandom } from "../rhythm/random";

export interface MelodyOnset {
  start: number;
  duration: number;
  /** Stress of the syllable sung here, or null without a lyric. */
  stress: StressLevel | null;
  /** Which repetition of the motif the note belongs to, and its position inside the motif. */
  instance: number;
  motifIndex: number;
}

/** Grid steps in beats: eighths, sixteenths, thirty-seconds. */
const EIGHTH = 0.5;
const SIXTEENTH = 0.25;
const SMALLEST_GRID = 0.125;
/** The last syllable of a line is held for at least a beat, and a breath of half a beat ends the phrase. */
const HOLD_BEATS = 1;
const BREATH_BEATS = 0.5;
const MAX_HOLD_BEATS = 4;
/** Gaps between syllables longer than this (in beats) break the line up. */
const MAX_GAP_BEATS = 2;
const GAP_WEIGHT = 0.4;
const LONG_GAP_COST = 3;
const LATE_START_COST_PER_BEAT = 0.15;
/** Motif rhythms: lower density keeps notes on strong beats (sharper weighting). */
const SPARSE_DENSITY = 1;
const MEDIUM_DENSITY = 2;
const SPARSE_SHARPNESS = 2;
const MEDIUM_SHARPNESS = 1.2;
const DENSE_SHARPNESS = 0.6;
const WEIGHT_FLOOR = 0.02;
const MIN_NOTES_TO_MERGE_ENDING = 3;

interface Placement {
  cost: number;
  previous: number;
}

/** Writes the rhythm of a melody: from a lyric's stresses, or from a motif repeated across the phrase. */
export class MelodyRhythm {
  constructor(
    private readonly meter: Meter,
    private readonly random: SeededRandom,
    private readonly beatOffset = 0,
  ) {}

  /** Places syllables on a grid so stressed ones land on strong positions, spread evenly, the last one held. */
  forSyllables(syllables: PlannedSyllable[], totalBeats: number): MelodyOnset[] {
    const count = syllables.length;
    if (count === 0) return [];
    let grid = count <= totalBeats / EIGHTH ? EIGHTH : SIXTEENTH;
    while (Math.floor(totalBeats / grid) < count && grid > SMALLEST_GRID) grid /= 2;
    const slots = Math.floor(totalBeats / grid);
    if (slots < count) return this.evenly(syllables, totalBeats);
    let lastSlot = Math.floor((totalBeats - HOLD_BEATS) / grid);
    if (lastSlot < count - 1) lastSlot = slots - 1;
    const idealGap = lastSlot / Math.max(1, count - 1);
    const table: Placement[][] = syllables.map(() => new Array<Placement>(lastSlot + 1).fill({ cost: Number.POSITIVE_INFINITY, previous: -1 }));
    syllables.forEach((syllable, index) => {
      const row = table[index];
      if (!row) return;
      const earliest = index;
      const latest = lastSlot - (count - 1 - index);
      for (let slot = earliest; slot <= latest; slot++) {
        const fit = stressMismatch(syllable.stress, this.meter.weightAt(slot * grid + this.beatOffset));
        if (index === 0) {
          row[slot] = { cost: fit + LATE_START_COST_PER_BEAT * slot * grid, previous: -1 };
          continue;
        }
        const before = table[index - 1] ?? [];
        let best: Placement = { cost: Number.POSITIVE_INFINITY, previous: -1 };
        for (let previous = index - 1; previous < slot; previous++) {
          const total = (before[previous]?.cost ?? Number.POSITIVE_INFINITY) + this.gapCost(slot - previous, idealGap, grid) + fit;
          if (total < best.cost) best = { cost: total, previous };
        }
        row[slot] = best;
      }
    });
    const positions = this.backtrack(table, count, lastSlot);
    return positions.map((slot, index) => {
      const start = slot * grid;
      const next = positions[index + 1];
      const duration = next !== undefined ? (next - slot) * grid : this.finalLength(start, totalBeats, grid);
      return { start, duration, stress: syllables[index]?.stress ?? Stress.None, instance: 0, motifIndex: index };
    });
  }

  /** A motif rhythm chosen from weighted grid positions, repeated across the phrase with a held ending. */
  forMotif(totalBeats: number, motifBeats: number, density: number): MelodyOnset[] {
    const grid = density > MEDIUM_DENSITY ? SIXTEENTH : EIGHTH;
    const slots = Math.max(1, Math.round(motifBeats / grid));
    const wanted = Math.min(slots, Math.max(1, Math.round(motifBeats * density)));
    const sharpness = density <= SPARSE_DENSITY ? SPARSE_SHARPNESS : density <= MEDIUM_DENSITY ? MEDIUM_SHARPNESS : DENSE_SHARPNESS;
    const chosen = new Set<number>([0]);
    const weights = Array.from({ length: slots }, (_, slot) => this.meter.weightAt(slot * grid + this.beatOffset) ** sharpness + WEIGHT_FLOOR);
    while (chosen.size < wanted) {
      const open = weights.map((weight, slot) => (chosen.has(slot) ? 0 : weight));
      chosen.add(this.random.weightedIndex(open));
    }
    const motif = [...chosen].sort((a, b) => a - b).map((slot) => slot * grid);
    const instances = Math.ceil(totalBeats / motifBeats);
    const onsets: MelodyOnset[] = [];
    for (let instance = 0; instance < instances; instance++) {
      motif.forEach((offset, motifIndex) => {
        const start = instance * motifBeats + offset;
        if (start < totalBeats) onsets.push({ start, duration: 0, stress: null, instance, motifIndex });
      });
    }
    this.mergeEnding(onsets, instances - 1);
    onsets.forEach((onset, index) => {
      const next = onsets[index + 1];
      onset.duration = next ? next.start - onset.start : this.finalLength(onset.start, totalBeats, grid);
    });
    return onsets;
  }

  private gapCost(gap: number, idealGap: number, grid: number): number {
    const spread = GAP_WEIGHT * ((gap - idealGap) / Math.max(1, idealGap)) ** 2;
    return gap * grid > MAX_GAP_BEATS ? spread + LONG_GAP_COST : spread;
  }

  private backtrack(table: Placement[][], count: number, lastSlot: number): number[] {
    const lastRow = table[count - 1] ?? [];
    let slot = 0;
    let best = Number.POSITIVE_INFINITY;
    lastRow.forEach((placement, index) => {
      if (placement.cost < best) {
        best = placement.cost;
        slot = index;
      }
    });
    const positions = new Array<number>(count).fill(0);
    for (let index = count - 1; index >= 0; index--) {
      positions[index] = slot;
      slot = table[index]?.[slot]?.previous ?? 0;
    }
    return positions.map((position) => Math.min(position, lastSlot));
  }

  private finalLength(start: number, totalBeats: number, grid: number): number {
    const room = totalBeats - start - BREATH_BEATS;
    return Math.min(totalBeats - start, Math.max(grid, Math.min(MAX_HOLD_BEATS, room)));
  }

  /** The last motif instance ends on a held note: its final two notes become one. */
  private mergeEnding(onsets: MelodyOnset[], lastInstance: number): void {
    const inLast = onsets.filter((onset) => onset.instance === lastInstance);
    if (inLast.length < MIN_NOTES_TO_MERGE_ENDING) return;
    onsets.pop();
  }

  private evenly(syllables: PlannedSyllable[], totalBeats: number): MelodyOnset[] {
    const step = totalBeats / syllables.length;
    return syllables.map((syllable, index) => ({
      start: index * step,
      duration: step,
      stress: syllable.stress,
      instance: 0,
      motifIndex: index,
    }));
  }
}
