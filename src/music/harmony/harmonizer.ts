import type { Note } from "../../shared/live";
import type { ChordEvent } from "../../shared/song";
import { melodyLine } from "../prosody/melody-line";
import { Meter } from "../prosody/meter";
import { ChordVocabulary, type ChordCandidate } from "./chord-vocabulary";
import { harmonyStyle, styleProfile } from "./harmony-style";
import { MusicalKey, type KeySpec } from "./musical-key";
import { ProgressionScorer, type SlotNote } from "./progression-scorer";

export interface HarmonizeOptions {
  /** How many progressions to return (best first). */
  k?: number;
  /** Genre or style name ("pop", "jazz", "rock"…). */
  style?: string;
  /** Beats per chord; defaults to one chord per bar. */
  harmonicRhythmBeats?: number;
  beatsPerBar?: number;
  /** Bars per phrase, for cadences. */
  phraseBars?: number;
  /** Roman numerals or chord symbols the artist likes. */
  favour?: string[];
}

export interface Progression {
  chords: ChordEvent[];
  romans: string[];
}

const DEFAULT_K = 3;
const MAX_K = 8;
const DEFAULT_BEATS_PER_BAR = 4;
const DEFAULT_PHRASE_BARS = 4;
/** Every melody note counts at least this much, plus its metrical weight. */
const BASE_NOTE_WEIGHT = 0.5;
const PITCH_CLASSES = 12;
/** Live positions are in quarter-note beats. */
const QUARTER_NOTE = 4;
const EPSILON = 1e-9;

interface PathEntry {
  cost: number;
  candidate: number;
  previous: PathEntry | null;
}

/**
 * Harmonises a melody in a key with a k-best Viterbi search over chord slots: candidates are the key's
 * triads and sevenths, borrowed iv, bIII, bVI and bVII, secondary dominants of ii, IV, V and vi, and
 * sus2, sus4 and add9 colours, weighted by style; cadences close each phrase.
 */
export class Harmonizer {
  private readonly candidates: ChordCandidate[];
  private readonly scorer: ProgressionScorer;
  private readonly k: number;
  private readonly slotBeats: number;
  private readonly beatsPerBar: number;
  private readonly phraseBeats: number;

  constructor(key: MusicalKey, options: HarmonizeOptions = {}) {
    this.candidates = new ChordVocabulary(key).build();
    this.scorer = new ProgressionScorer(styleProfile(harmonyStyle(options.style)), new Set(options.favour ?? []));
    this.k = Math.min(MAX_K, Math.max(1, Math.round(options.k ?? DEFAULT_K)));
    this.beatsPerBar = options.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;
    this.slotBeats = options.harmonicRhythmBeats && options.harmonicRhythmBeats > 0 ? options.harmonicRhythmBeats : this.beatsPerBar;
    this.phraseBeats = (options.phraseBars ?? DEFAULT_PHRASE_BARS) * this.beatsPerBar;
  }

  progressions(melody: Note[]): Progression[] {
    const line = melodyLine(melody);
    const end = line.reduce((latest, note) => Math.max(latest, note.start + note.duration), 0);
    const slots = Math.max(1, Math.ceil(end / this.slotBeats - EPSILON));
    const notes = this.slotNotes(line, slots);
    let beam = this.firstSlot(notes[0] ?? [], slots === 1);
    for (let slot = 1; slot < slots; slot++) beam = this.nextSlot(beam, notes[slot] ?? [], slot, slots);
    return [...beam]
      .sort((a, b) => a.cost - b.cost)
      .slice(0, this.k)
      .map((entry) => this.toProgression(entry));
  }

  private firstSlot(notes: SlotNote[], final: boolean): PathEntry[] {
    return this.candidates.map((candidate, index) => ({
      cost:
        this.scorer.emission(candidate, notes) +
        this.scorer.start(candidate) +
        (final ? this.scorer.cadence(null, candidate, true) : 0),
      candidate: index,
      previous: null,
    }));
  }

  private nextSlot(beam: PathEntry[], notes: SlotNote[], slot: number, slots: number): PathEntry[] {
    const final = slot === slots - 1;
    const phraseEnd = final || ((slot + 1) * this.slotBeats) % this.phraseBeats === 0;
    const next: PathEntry[] = [];
    this.candidates.forEach((candidate, index) => {
      const emission = this.scorer.emission(candidate, notes);
      const options: PathEntry[] = [];
      for (const entry of beam) {
        const previous = this.candidates[entry.candidate];
        if (!previous) continue;
        const cadence = phraseEnd ? this.scorer.cadence(previous, candidate, final) : 0;
        options.push({ cost: entry.cost + this.scorer.transition(previous, candidate) + emission + cadence, candidate: index, previous: entry });
      }
      next.push(...options.sort((a, b) => a.cost - b.cost).slice(0, this.k));
    });
    return next;
  }

  private slotNotes(line: Note[], slots: number): SlotNote[][] {
    const meter = new Meter(this.beatsPerBar, QUARTER_NOTE);
    const perSlot: SlotNote[][] = Array.from({ length: slots }, () => []);
    for (const note of line) {
      const noteEnd = note.start + note.duration;
      const first = Math.floor(note.start / this.slotBeats);
      const last = Math.min(slots - 1, Math.floor((noteEnd - EPSILON) / this.slotBeats));
      for (let slot = Math.max(0, first); slot <= last; slot++) {
        const overlap = Math.min(noteEnd, (slot + 1) * this.slotBeats) - Math.max(note.start, slot * this.slotBeats);
        if (overlap <= 0) continue;
        const accent = note.start >= slot * this.slotBeats ? meter.weightAt(note.start) : 0;
        perSlot[slot]?.push({ pitchClass: note.pitch % PITCH_CLASSES, weight: overlap * (BASE_NOTE_WEIGHT + accent) });
      }
    }
    return perSlot;
  }

  private toProgression(last: PathEntry): Progression {
    const picked: ChordCandidate[] = [];
    for (let entry: PathEntry | null = last; entry; entry = entry.previous) {
      const candidate = this.candidates[entry.candidate];
      if (candidate) picked.unshift(candidate);
    }
    const chords: ChordEvent[] = [];
    const romans: string[] = [];
    picked.forEach((candidate, slot) => {
      const previous = chords.at(-1);
      if (previous && previous.symbol === candidate.symbol) {
        previous.lengthBeats += this.slotBeats;
        return;
      }
      chords.push({ beat: slot * this.slotBeats, lengthBeats: this.slotBeats, symbol: candidate.symbol });
      romans.push(candidate.roman);
    });
    return { chords, romans };
  }
}

/** The k best chord progressions for a melody in a key, best first. */
export function harmonize(melody: Note[], key: KeySpec, opts: HarmonizeOptions = {}): ChordEvent[][] {
  return new Harmonizer(MusicalKey.from(key), opts).progressions(melody).map((progression) => progression.chords);
}
