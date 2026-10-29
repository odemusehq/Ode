import { KeySnapper } from "./key";
import { OnsetDetector } from "./onsets";
import { PitchTracker } from "./pitch";
import { GridDivision, GridQuantizer } from "./quantize";
import { NoteSegmenter } from "./segmentation";
import { median, toMono } from "./signal";
import { tuningOffset } from "./tuning";
import { dbToPower, frequencyToMidi, powerToDb } from "./units";
import type { Note } from "../../shared/live";
import type { TimedNote } from "./quantize";
import type { NoteSegment, PitchedFrame } from "./segmentation";
import type { AudioData, MusicalKey } from "./types";

export interface HumTranscriberOptions {
  quantize: boolean;
  snapToKey: boolean;
  correctTuning: boolean;
  cleanFragments: boolean;
  /** Same-pitch fragments separated by less than this, without a new attack, are joined, seconds. */
  mergeGapSeconds: number;
  /**
   * Segments shorter than this share of a sixteenth note are dropped as fragments; every note kept
   * lasts at least one grid step (a sixteenth or more) after quantising.
   */
  shortestNoteFraction: number;
  /** Velocity of a note at the take's median note level. */
  referenceVelocity: number;
  /** Velocity change per dB of level above or below the median note. */
  velocityPerDb: number;
  /** Quietest velocity given to a note. */
  minVelocity: number;
}

export const DEFAULT_HUM_OPTIONS: Readonly<HumTranscriberOptions> = {
  quantize: false,
  snapToKey: false,
  correctTuning: false,
  cleanFragments: false,
  mergeGapSeconds: 0.06,
  shortestNoteFraction: 0.6,
  referenceVelocity: 96,
  velocityPerDb: 3,
  minVelocity: 30,
};

const SECONDS_PER_MINUTE = 60;
const SIXTEENTHS_PER_BEAT = 4;
const CENTS_PER_SEMITONE = 100;
/** MIDI limits for note numbers and velocity. */
const HIGHEST_MIDI_NOTE = 127;
const HIGHEST_VELOCITY = 127;

export interface HumTranscription {
  /** Notes in beats from the start of the audio. */
  notes: Note[];
  /** Grid the timing was fitted to. */
  grid: GridDivision | null;
  /** How far the singer's tuning sat from equal temperament at A4 = 440 Hz, cents. */
  tuningOffsetCents: number;
  originalNotes: { startSeconds: number; endSeconds: number; midi: number; levelDbfs: number }[];
  transformations: string[];
}

interface PitchedNote {
  pitch: number;
  start: number;
  end: number;
  level: number;
  articulated: boolean;
}

/**
 * Estimates notes from a monophonic recording. Timing and chromatic notes are kept by default;
 * tuning/key/grid correction and fragment cleanup require explicit options.
 */
export class HumTranscriber {
  private readonly options: HumTranscriberOptions;
  private readonly keySnapper: KeySnapper | null;

  /**
   * @param tempo song tempo, BPM
   * @param key used only when snapToKey is explicitly enabled
   */
  constructor(
    private readonly tempo: number,
    key?: MusicalKey,
    options: Partial<HumTranscriberOptions> = {},
  ) {
    if (!(tempo > 0)) throw new RangeError(`tempo must be above 0 BPM, got ${tempo}`);
    this.options = { ...DEFAULT_HUM_OPTIONS, ...options };
    this.keySnapper = key && this.options.snapToKey ? new KeySnapper(key) : null;
  }

  /** Notes in beats from the start of the audio. */
  transcribe(audio: AudioData): Note[] {
    return this.analyze(audio).notes;
  }

  /** Notes plus the grid and tuning offset found on the way. */
  analyze(audio: AudioData): HumTranscription {
    const samples = toMono(audio);
    const tracker = new PitchTracker(audio.sampleRate);
    const frames = tracker.trackSamples(samples);
    const levels = tracker.frameLevels(samples);
    const onsets = new OnsetDetector().detect(levels, tracker.levelGate(levels));

    const offsetCents = tuningOffset(
      frames.flatMap((frame) => (frame.freq === null ? [] : [{ midi: frequencyToMidi(frame.freq), weight: frame.confidence }])),
    );
    const pitched: PitchedFrame[] = frames.map((frame, k) => ({
      time: frame.time,
      midi: frame.freq === null ? null : frequencyToMidi(frame.freq) - (this.options.correctTuning ? offsetCents / CENTS_PER_SEMITONE : 0),
      level: levels[k] ?? -Infinity,
      onset: onsets[k] ?? false,
    }));

    const segments = new NoteSegmenter(tracker.hop / audio.sampleRate).segment(pitched);
    const observed = segments.map((segment) => this.toPitchedNote(segment));
    const notes = this.options.cleanFragments ? this.withoutFragments(this.joinFragments(observed)) : observed;
    const timed = this.toBeats(notes);
    const quantizer = new GridQuantizer();
    const grid = this.options.quantize ? quantizer.choose(timed) : null;
    return {
      notes: grid === null ? timed.map(({ end, ...note }) => ({ ...note, duration: end - note.start })) : quantizer.quantize(timed, grid),
      grid,
      tuningOffsetCents: offsetCents,
      originalNotes: segments.map((segment) => ({ startSeconds: segment.start, endSeconds: segment.end, midi: segment.midi + (this.options.correctTuning ? offsetCents / CENTS_PER_SEMITONE : 0), levelDbfs: segment.level })),
      transformations: ["MIDI pitches rounded to semitones; pitch tracking and segmentation are estimates", ...(this.options.correctTuning ? ["global tuning corrected"] : []), ...(this.keySnapper ? ["pitches snapped to supplied key"] : []), ...(this.options.cleanFragments ? ["short fragments removed and nearby same-pitch fragments joined"] : []), ...(grid !== null ? ["timing quantized"] : [])],
    };
  }

  private toPitchedNote(segment: NoteSegment): PitchedNote {
    const pitch = this.keySnapper ? this.keySnapper.snap(segment.midi) : Math.round(segment.midi);
    return {
      pitch: Math.max(0, Math.min(HIGHEST_MIDI_NOTE, pitch)),
      start: segment.start,
      end: segment.end,
      level: segment.level,
      articulated: segment.articulated,
    };
  }

  /** Joins a note to the previous one when they share a pitch, the gap is tiny and it starts without an attack of its own. */
  private joinFragments(notes: readonly PitchedNote[]): PitchedNote[] {
    const joined: PitchedNote[] = [];
    for (const note of notes) {
      const previous = joined[joined.length - 1];
      const tinyGap = previous !== undefined && note.start - previous.end <= this.options.mergeGapSeconds;
      if (previous && tinyGap && previous.pitch === note.pitch && !note.articulated) {
        const previousLength = previous.end - previous.start;
        const noteLength = note.end - note.start;
        const power = dbToPower(previous.level) * previousLength + dbToPower(note.level) * noteLength;
        previous.level = powerToDb(power / Math.max(Number.EPSILON, previousLength + noteLength));
        previous.end = note.end;
        continue;
      }
      joined.push({ ...note });
    }
    return joined;
  }

  private withoutFragments(notes: readonly PitchedNote[]): PitchedNote[] {
    const sixteenth = SECONDS_PER_MINUTE / this.tempo / SIXTEENTHS_PER_BEAT;
    const shortest = sixteenth * this.options.shortestNoteFraction;
    return notes.filter((note) => note.end - note.start >= shortest);
  }

  private toBeats(notes: readonly PitchedNote[]): TimedNote[] {
    const beatsPerSecond = this.tempo / SECONDS_PER_MINUTE;
    const reference = median(notes.map((note) => note.level).filter(Number.isFinite));
    return notes.map((note) => ({
      pitch: note.pitch,
      start: note.start * beatsPerSecond,
      end: note.end * beatsPerSecond,
      velocity: this.velocity(note.level, reference),
    }));
  }

  private velocity(level: number, reference: number): number {
    if (!Number.isFinite(level) || !Number.isFinite(reference)) return this.options.referenceVelocity;
    const velocity = Math.round(this.options.referenceVelocity + (level - reference) * this.options.velocityPerDb);
    return Math.max(this.options.minVelocity, Math.min(HIGHEST_VELOCITY, velocity));
  }
}
