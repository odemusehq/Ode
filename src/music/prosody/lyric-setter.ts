import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import { Stress, type StressLevel } from "../phonetics/pronunciation";
import { melodyLine } from "./melody-line";
import { COMMON_TIME, Meter } from "./meter";
import { NoteWeigher, type WeightedNote } from "./note-weigher";
import { OptionChooser, type PlannedSyllable } from "./option-chooser";

export interface SyllableNote {
  syllable: number;
  note: number;
}

export interface LyricSetting {
  /** The melody after splitting notes where needed. */
  notes: Note[];
  /** Which note each syllable is sung on; a syllable over several notes (melisma) appears once per note. */
  alignment: SyllableNote[];
  /** The syllables in the chosen pronunciation. */
  syllables: PlannedSyllable[];
  /** Syllables that share a note that was split for them. */
  splitSyllables: number[];
  /** Syllables sung over more than one note. */
  melismaSyllables: number[];
}

/** The note weight each stress level wants: primary on strong notes, unstressed on weak ones. */
const STRESS_TARGET: Readonly<Record<StressLevel, number>> = { 0: 0.2, 1: 1, 2: 0.6 };
/** A stressed syllable on a weak note sounds worse than an unstressed one on a strong note. */
const STRESSED_TOO_WEAK_FACTOR = 2;
const MELISMA_COST = 0.3;
const MELISMA_STRESSED_FACTOR = 0.6;
const MELISMA_LAST_SYLLABLE_FACTOR = 0.4;
const MELISMA_FUNCTION_WORD_FACTOR = 1.3;
const SPLIT_COST = 0.4;
/** Splitting a note shorter than an eighth note (in beats) is extra awkward. */
const SHORT_NOTE_BEATS = 0.5;
const SHORT_SPLIT_COST = 0.4;
const BASE_MAX_MELISMA = 4;
const BASE_MAX_SPLIT = 3;
/** Split notes snap to sixteenths (in beats) when they are long enough. */
const SPLIT_GRID = 0.25;

interface Step {
  syllables: number;
  notes: number;
}

export function stressMismatch(stress: StressLevel, weight: number): number {
  const target = STRESS_TARGET[stress];
  if (stress === Stress.None) return Math.max(0, weight - target) ** 2;
  return STRESSED_TOO_WEAK_FACTOR * Math.max(0, target - weight) ** 2;
}

/**
 * Sets a lyric line to a melody: picks the pronunciation whose syllable count fits the notes, then
 * aligns syllables to notes by dynamic programming so stressed syllables land on stronger notes,
 * splitting notes when there are more syllables and singing melismas when there are fewer.
 */
export class LyricSetter {
  private readonly chooser = new OptionChooser();
  private readonly weigher: NoteWeigher;

  constructor(private readonly meter: Meter = new Meter()) {
    this.weigher = new NoteWeigher(meter);
  }

  set(line: LineAnalysis, notes: Note[]): LyricSetting {
    const melody = melodyLine(notes);
    const syllables = this.chooser.plan(line, melody.length);
    if (syllables.length === 0 || melody.length === 0) {
      return { notes: melody, alignment: [], syllables, splitSyllables: [], melismaSyllables: [] };
    }
    const steps = this.align(syllables, this.weigher.weigh(melody));
    return this.realise(steps, syllables, melody);
  }

  private align(syllables: PlannedSyllable[], weights: WeightedNote[]): Step[] {
    const syllableCount = syllables.length;
    const noteCount = weights.length;
    const maxMelisma = Math.max(BASE_MAX_MELISMA, Math.ceil(noteCount / syllableCount) + 1);
    const maxSplit = Math.max(BASE_MAX_SPLIT, Math.ceil(syllableCount / noteCount) + 1);
    const columns = noteCount + 1;
    const cost = new Array<number>((syllableCount + 1) * columns).fill(Number.POSITIVE_INFINITY);
    const back = new Array<Step | null>((syllableCount + 1) * columns).fill(null);
    const costAt = (syllable: number, note: number): number => cost[syllable * columns + note] ?? Number.POSITIVE_INFINITY;
    const relax = (syllable: number, note: number, value: number, step: Step): void => {
      if (value < costAt(syllable, note)) {
        cost[syllable * columns + note] = value;
        back[syllable * columns + note] = step;
      }
    };
    cost[0] = 0;
    for (let syllable = 0; syllable < syllableCount; syllable++) {
      for (let note = 0; note < noteCount; note++) {
        const here = costAt(syllable, note);
        if (!Number.isFinite(here)) continue;
        const current = syllables[syllable];
        if (!current) continue;
        for (let span = 1; span <= maxMelisma && note + span <= noteCount; span++) {
          const sung = weights.slice(note, note + span);
          relax(syllable + 1, note + span, here + this.melismaCost(current, sung, syllable === syllableCount - 1), {
            syllables: 1,
            notes: span,
          });
        }
        const weighted = weights[note];
        for (let shared = 2; shared <= maxSplit && syllable + shared <= syllableCount && weighted; shared++) {
          const group = syllables.slice(syllable, syllable + shared);
          relax(syllable + shared, note + 1, here + this.splitCost(group, weighted), { syllables: shared, notes: 1 });
        }
      }
    }
    const steps: Step[] = [];
    let syllable = syllableCount;
    let note = noteCount;
    while (syllable > 0 && note > 0) {
      const step = back[syllable * columns + note];
      if (!step) break;
      steps.unshift(step);
      syllable -= step.syllables;
      note -= step.notes;
    }
    return steps;
  }

  private melismaCost(syllable: PlannedSyllable, notes: WeightedNote[], last: boolean): number {
    const first = notes[0];
    const base = first ? stressMismatch(syllable.stress, first.weight) : 0;
    if (notes.length <= 1) return base;
    let factor = syllable.stress === Stress.None ? 1 : MELISMA_STRESSED_FACTOR;
    if (last) factor = Math.min(factor, MELISMA_LAST_SYLLABLE_FACTOR);
    if (syllable.functionWord) factor *= MELISMA_FUNCTION_WORD_FACTOR;
    return base + (notes.length - 1) * MELISMA_COST * factor;
  }

  private splitCost(group: PlannedSyllable[], weighted: WeightedNote): number {
    const part = weighted.note.duration / group.length;
    let total = 0;
    group.forEach((syllable, index) => {
      const weight = index === 0 ? weighted.weight : this.weigher.partWeight(weighted.note.start + index * part);
      total += stressMismatch(syllable.stress, weight);
    });
    const extra = group.length - 1;
    return total + extra * SPLIT_COST + (weighted.note.duration < SHORT_NOTE_BEATS ? extra * SHORT_SPLIT_COST : 0);
  }

  private realise(steps: Step[], syllables: PlannedSyllable[], melody: Note[]): LyricSetting {
    const notes: Note[] = [];
    const alignment: SyllableNote[] = [];
    const splitSyllables: number[] = [];
    const melismaSyllables: number[] = [];
    let syllable = 0;
    let note = 0;
    for (const step of steps) {
      if (step.syllables === 1) {
        if (step.notes > 1) melismaSyllables.push(syllable);
        for (let offset = 0; offset < step.notes; offset++) {
          const source = melody[note + offset];
          if (!source) continue;
          notes.push({ ...source });
          alignment.push({ syllable, note: notes.length - 1 });
        }
      } else {
        const source = melody[note];
        if (source) {
          const group = syllables.slice(syllable, syllable + step.syllables);
          this.splitNote(source, group).forEach((part, offset) => {
            notes.push(part);
            alignment.push({ syllable: syllable + offset, note: notes.length - 1 });
            splitSyllables.push(syllable + offset);
          });
        }
      }
      syllable += step.syllables;
      note += step.notes;
    }
    return { notes, alignment, syllables, splitSyllables, melismaSyllables };
  }

  /** Divides a note among syllables; on a sixteenth grid when long enough, the spare time going to the most stressed. */
  private splitNote(note: Note, group: PlannedSyllable[]): Note[] {
    const count = group.length;
    let lengths = new Array<number>(count).fill(note.duration / count);
    if (note.duration >= count * SPLIT_GRID) {
      const unit = Math.floor(note.duration / count / SPLIT_GRID) * SPLIT_GRID;
      lengths = new Array<number>(count).fill(unit);
      const strongest = group.reduce((best, syllable, index) => (this.prominence(syllable) > this.prominence(group[best]) ? index : best), 0);
      lengths[strongest] = (lengths[strongest] ?? unit) + note.duration - unit * count;
    }
    let start = note.start;
    return lengths.map((duration) => {
      const part = { ...note, start, duration };
      start += duration;
      return part;
    });
  }

  private prominence(syllable: PlannedSyllable | undefined): number {
    if (!syllable) return 0;
    return syllable.stress === Stress.Primary ? 2 : syllable.stress === Stress.Secondary ? 1 : 0;
  }
}

/** Sets a lyric line to notes: adjusted notes and which note each syllable is sung on. */
export function setLyricsToMelody(
  line: LineAnalysis,
  notes: Note[],
  beatsPerBar: number = COMMON_TIME.numerator,
  beatUnit: number = COMMON_TIME.denominator,
): LyricSetting {
  return new LyricSetter(new Meter(beatsPerBar, beatUnit)).set(line, notes);
}
