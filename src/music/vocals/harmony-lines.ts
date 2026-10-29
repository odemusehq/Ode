import type { Note } from "../../shared/live";
import type { ChordEvent } from "../../shared/song";
import { ChordTimeline } from "../harmony/chord-timeline";
import { KeyFinder } from "../harmony/key-finder";
import type { MusicalKey } from "../harmony/musical-key";
import { inRange, requirePitchRange, type PitchRange } from "../harmony/pitch-range";
import { melodyLine } from "../prosody/melody-line";
import { Meter, METRICAL_WEIGHT } from "../prosody/meter";

interface PartShape {
  /** Scale steps from the lead, most preferred first: 2 = a third, 5 = a sixth. */
  steps: number[];
  above: boolean;
}

/** First part a third above; second a third or sixth below; third a chord tone below that. */
const PART_SHAPES: readonly PartShape[] = [
  { steps: [2, 4], above: true },
  { steps: [-2, -5], above: false },
  { steps: [-4, -3, -5], above: false },
];
const MAX_PARTS = PART_SHAPES.length;
/** Without a given range, harmony parts stay within this many semitones of the lead's range. */
const RANGE_MARGIN = 7;
/** Other chord tones considered, up to this far from the lead. */
const CHORD_TONE_REACH = 9;
const PREFERENCE_STEP_COST = 0.3;
const OTHER_CHORD_TONE_COST = 0.8;
const STRONG_NON_CHORD_COST = 1.5;
const WEAK_NON_CHORD_COST = 0.3;
const LONG_NOTE_BEATS = 1;
const PARALLEL_PERFECT_COST = 3;
const PERFECT_INTERVALS = new Set([0, 7]);
const MOTION_COST_PER_SEMITONE = 0.08;
const LEAP = 7;
const LEAP_COST = 1;
const VELOCITY_DROP = 10;
const DEFAULT_VELOCITY = 96;
const OCTAVE = 12;

interface Candidate {
  pitch: number;
  cost: number;
}

/**
 * Writes harmony (backing-vocal) lines under or over a lead: thirds and sixths inside the chord,
 * without parallel octaves or fifths against the lead, each line on its own side of the lead, inside the singers' range.
 */
export class HarmonyVoiceWriter {
  private readonly key: MusicalKey;
  private readonly chords: ChordTimeline;
  private readonly meter: Meter;

  /** `key`: the song's key when it is known; otherwise it is found from the chords and the lead. */
  constructor(chords: ChordEvent[], lead: Note[], meter: Meter = new Meter(), key?: MusicalKey) {
    this.key = key ?? new KeyFinder().find(chords, lead);
    this.chords = new ChordTimeline(chords);
    this.meter = meter;
  }

  write(melody: Note[], parts: number, range?: PitchRange): Note[][] {
    const lead = melodyLine(melody);
    if (lead.length === 0) return [];
    const limits = requirePitchRange(range ?? this.leadRange(lead));
    const written: Note[][] = [];
    for (const shape of PART_SHAPES.slice(0, Math.min(MAX_PARTS, Math.max(1, Math.round(parts))))) {
      const pitches = this.part(lead, shape, limits, written);
      written.push(
        lead.map((note, index) => ({
          ...note,
          pitch: pitches[index] ?? note.pitch,
          velocity: Math.max(1, (note.velocity ?? DEFAULT_VELOCITY) - VELOCITY_DROP),
        })),
      );
    }
    return written;
  }

  private leadRange(lead: Note[]): PitchRange {
    const pitches = lead.map((note) => note.pitch);
    return { low: Math.min(...pitches) - RANGE_MARGIN, high: Math.max(...pitches) + RANGE_MARGIN };
  }

  private part(lead: Note[], shape: PartShape, range: PitchRange, others: Note[][]): number[] {
    const options = lead.map((note, index) => this.candidates(note, shape, range, others.map((part) => part[index]?.pitch)));
    const costs: number[][] = [];
    const back: number[][] = [];
    options.forEach((candidates, index) => {
      const previousOptions = options[index - 1];
      const previousLead = lead[index - 1];
      const currentLead = lead[index];
      costs.push([]);
      back.push([]);
      for (const candidate of candidates) {
        let best = 0;
        let bestCost = previousOptions && previousOptions.length > 0 ? Number.POSITIVE_INFINITY : 0;
        previousOptions?.forEach((previous, previousIndex) => {
          const motion = this.motionCost(previous.pitch, candidate.pitch, previousLead?.pitch, currentLead?.pitch);
          const total = (costs[index - 1]?.[previousIndex] ?? 0) + motion;
          if (total < bestCost) {
            bestCost = total;
            best = previousIndex;
          }
        });
        costs[index]?.push(bestCost + candidate.cost);
        back[index]?.push(best);
      }
    });
    const path = new Array<number>(lead.length).fill(0);
    const lastCosts = costs.at(-1) ?? [];
    let choice = lastCosts.indexOf(Math.min(...lastCosts));
    for (let index = lead.length - 1; index >= 0; index--) {
      path[index] = options[index]?.[choice]?.pitch ?? lead[index]?.pitch ?? 0;
      choice = back[index]?.[choice] ?? 0;
    }
    return path;
  }

  private candidates(note: Note, shape: PartShape, range: PitchRange, otherParts: (number | undefined)[]): Candidate[] {
    const chord = this.chords.at(note.start);
    const strong = this.meter.weightAt(note.start) >= METRICAL_WEIGHT.beat || note.duration >= LONG_NOTE_BEATS;
    const found = new Map<number, number>();
    shape.steps.forEach((steps, rank) => found.set(this.key.step(note.pitch, steps), rank * PREFERENCE_STEP_COST));
    if (chord) {
      for (let pitch = note.pitch - CHORD_TONE_REACH; pitch <= note.pitch + CHORD_TONE_REACH; pitch++) {
        if (chord.contains(pitch) && !found.has(pitch)) found.set(pitch, OTHER_CHORD_TONE_COST);
      }
    }
    const candidates: Candidate[] = [];
    for (const [pitch, preference] of found) {
      const sideOk = shape.above ? pitch > note.pitch : pitch < note.pitch;
      const clear = otherParts.every((other) => other === undefined || (shape.above ? pitch > other : pitch < other) || other === note.pitch);
      if (!sideOk || !clear || !inRange(pitch, range)) continue;
      const fits = !chord || chord.contains(pitch);
      candidates.push({ pitch, cost: preference + (fits ? 0 : strong ? STRONG_NON_CHORD_COST : WEAK_NON_CHORD_COST) });
    }
    if (candidates.length > 0) return candidates;
    throw new RangeError(`No ${shape.above ? "upper" : "lower"} harmony fits range ${range.low}–${range.high} beside lead pitch ${note.pitch} at beat ${note.start}.`);
  }

  private motionCost(previous: number, current: number, previousLead: number | undefined, currentLead: number | undefined): number {
    const moved = current - previous;
    let cost = Math.abs(moved) * MOTION_COST_PER_SEMITONE + (Math.abs(moved) > LEAP ? LEAP_COST : 0);
    if (previousLead === undefined || currentLead === undefined) return cost;
    const before = (((previous - previousLead) % OCTAVE) + OCTAVE) % OCTAVE;
    const after = (((current - currentLead) % OCTAVE) + OCTAVE) % OCTAVE;
    const leadMoved = currentLead - previousLead;
    if (PERFECT_INTERVALS.has(before) && before === after && moved !== 0 && Math.sign(moved) === Math.sign(leadMoved)) {
      cost += PARALLEL_PERFECT_COST;
    }
    return cost;
  }
}

/** Harmony lines for a lead melody over chords: one note list per part (1–3 parts). */
export function harmonyLines(melody: Note[], chords: ChordEvent[], parts: number, range?: PitchRange, meter: Meter = new Meter(), key?: MusicalKey): Note[][] {
  return new HarmonyVoiceWriter(chords, melody, meter, key).write(melody, parts, range);
}
