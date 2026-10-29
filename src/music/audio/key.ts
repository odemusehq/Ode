import type { MusicalKey } from "./types";

const PITCH_CLASSES = 12;

function pitchClass(midi: number): number {
  return ((midi % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}

/** Moves pitches to the nearest note of a key. */
export class KeySnapper {
  private readonly allowed: Set<number>;

  constructor(key: MusicalKey) {
    this.allowed = new Set(key.intervals.map((interval) => pitchClass(key.root + interval)));
  }

  /** The in-key MIDI note nearest to a fractional pitch; plain rounding when the key's note set is empty. */
  snap(midi: number): number {
    const nearest = Math.round(midi);
    if (this.allowed.size === 0) return nearest;
    let best = nearest;
    let bestDistance = Infinity;
    for (let candidate = nearest - PITCH_CLASSES / 2; candidate <= nearest + PITCH_CLASSES / 2; candidate++) {
      if (!this.allowed.has(pitchClass(candidate))) continue;
      const distance = Math.abs(candidate - midi);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }
}
