import type { Note } from "../../shared/live";
import type { ChordEvent } from "../../shared/song";
import { ChordTone, type ChordSymbol } from "../harmony/chord-symbol";
import { ChordTimeline, type TimedChord } from "../harmony/chord-timeline";
import { pitchesOfClass, type PitchRange } from "../harmony/pitch-range";
import { DrumNote } from "./drum-kit";
import { SeededRandom } from "./random";

export enum BassStyle {
  Root = "root",
  RootFifth = "root-fifth",
  Octave = "octave",
  Walking = "walking",
  Syncopated = "syncopated",
  EightOhEight = "808",
  Arpeggio = "arpeggio",
}

/** Four-string bass (E1 to G3) and 808 sub-bass (C1 to D3) ranges, with where a line usually sits. */
const BASS_RANGE: PitchRange = { low: 28, high: 55 };
const SUB_BASS_RANGE: PitchRange = { low: 24, high: 50 };
const BASS_HOME = 38;
const SUB_BASS_HOME = 33;
const LEGATO = 0.9;
const STACCATO = 0.45;
const ON_KICK_VELOCITY = 104;
const OFF_KICK_VELOCITY = 88;
const GHOST_VELOCITY = 60;
/** Overlap that makes an 808 glide to the next note (legato glide). */
const SLIDE_OVERLAP_BEATS = 0.125;
const OCTAVE = 12;
const EIGHTH = 0.5;
const SIXTEENTH = 0.25;
const QUARTER = 1;
/** Quarter-note beats in a bar of 4/4, the bar length when the caller leaves it out. */
const COMMON_BAR_BEATS = 4;
/** Syncopated lines play the next chord's root a sixteenth early and add ghost notes after some kicks. */
const ANTICIPATION_BEATS = 0.25;
const GHOST_CHANCE = 0.3;
/** An 808 jumps up an octave on the last kick of a bar that has at least this many kicks. */
const KICKS_FOR_OCTAVE_JUMP = 3;
const ARPEGGIO_SHAPE: readonly ChordTone[] = [ChordTone.Root, ChordTone.Third, ChordTone.Fifth, ChordTone.Root, ChordTone.Fifth, ChordTone.Third];
const EPSILON = 1e-6;
const DEFAULT_SEED = 1;

interface BassEvent {
  start: number;
  end: number;
  chord: ChordSymbol;
}

/** Writes basslines that follow the chords and lock with the kick drum. */
export class BasslineWriter {
  private readonly range: PitchRange;
  private readonly home: number;
  private previousPitch: number;

  constructor(
    private readonly style: BassStyle,
    private readonly random: SeededRandom,
    /** Quarter-note beats per bar of the song's meter. */
    private readonly barBeats: number = COMMON_BAR_BEATS,
  ) {
    const sub = style === BassStyle.EightOhEight;
    this.range = sub ? SUB_BASS_RANGE : BASS_RANGE;
    this.home = sub ? SUB_BASS_HOME : BASS_HOME;
    this.previousPitch = this.home;
  }

  write(chords: ChordEvent[], kick: Note[]): Note[] {
    const events = new ChordTimeline(chords)
      .entries()
      .filter((entry): entry is TimedChord & { chord: ChordSymbol } => entry.chord !== null)
      .map((entry) => ({ start: entry.start, end: entry.end, chord: entry.chord }));
    const kicks = this.kickTimes(kick);
    const notes: Note[] = [];
    events.forEach((event, index) => notes.push(...this.forChord(event, events[index + 1], kicks)));
    return this.style === BassStyle.EightOhEight ? this.addSlides(notes) : notes;
  }

  private kickTimes(kick: Note[]): number[] {
    const kickNotes = kick.some((note) => note.pitch === DrumNote.Kick) ? kick.filter((note) => note.pitch === DrumNote.Kick) : kick;
    return [...new Set(kickNotes.map((note) => Math.round(note.start / SIXTEENTH) * SIXTEENTH))].sort((a, b) => a - b);
  }

  private forChord(event: BassEvent, next: BassEvent | undefined, kicks: number[]): Note[] {
    const style: BassStyle = this.style;
    switch (style) {
      case BassStyle.Root:
        return this.onKicks(event, kicks, false);
      case BassStyle.RootFifth:
        return this.rootFifth(event);
      case BassStyle.Octave:
        return this.octaves(event);
      case BassStyle.Walking:
        return this.walking(event, next);
      case BassStyle.Syncopated:
        return this.syncopated(event, next, kicks);
      case BassStyle.EightOhEight:
        return this.onKicks(event, kicks, true);
      case BassStyle.Arpeggio:
        return this.arpeggio(event);
    }
  }

  /** Bass note on the chord change and on each kick inside the chord; 808 notes last until the next hit. */
  private onKicks(event: BassEvent, kicks: number[], sustain: boolean): Note[] {
    const starts = this.startsWithKicks(event, kicks);
    const root = this.rootPitch(event.chord);
    return starts.map((start, index) => {
      const end = starts[index + 1] ?? event.end;
      const jump = sustain && index === starts.length - 1 && this.kicksInBar(kicks, start) >= KICKS_FOR_OCTAVE_JUMP && root + OCTAVE <= this.range.high;
      const pitch = jump ? root + OCTAVE : root;
      return {
        pitch,
        start,
        duration: (end - start) * (sustain ? 1 : LEGATO),
        velocity: kicks.includes(start) ? ON_KICK_VELOCITY : OFF_KICK_VELOCITY,
      };
    });
  }

  private rootFifth(event: BassEvent): Note[] {
    const root = this.rootPitch(event.chord);
    const fifthClass = event.chord.tones.find((tone) => tone.role === ChordTone.Fifth)?.pitchClass ?? event.chord.root;
    const fifth = this.nearest(fifthClass, root + 7);
    const notes: Note[] = [];
    let index = 0;
    const halfBar = this.barBeats / 2;
    for (let start = event.start; start < event.end - EPSILON; start += halfBar) {
      const length = Math.min(halfBar, event.end - start);
      notes.push({ pitch: index % 2 === 0 ? root : fifth, start, duration: length * LEGATO, velocity: index % 2 === 0 ? ON_KICK_VELOCITY : OFF_KICK_VELOCITY });
      index += 1;
    }
    return notes;
  }

  private octaves(event: BassEvent): Note[] {
    const root = this.rootPitch(event.chord);
    const high = root + OCTAVE <= this.range.high ? root + OCTAVE : root;
    const low = high === root ? root - OCTAVE : root;
    const notes: Note[] = [];
    let index = 0;
    for (let start = event.start; start < event.end - EPSILON; start += EIGHTH) {
      notes.push({ pitch: index % 2 === 0 ? low : high, start, duration: Math.min(EIGHTH, event.end - start) * STACCATO, velocity: index % 2 === 0 ? ON_KICK_VELOCITY : OFF_KICK_VELOCITY });
      index += 1;
    }
    return notes;
  }

  /** Quarter notes: root on the chord change, chord tones in between, an approach note into the next chord. */
  private walking(event: BassEvent, next: BassEvent | undefined): Note[] {
    const root = this.rootPitch(event.chord);
    const tones = [ChordTone.Third, ChordTone.Fifth, ChordTone.Seventh, ChordTone.Root]
      .map((role) => event.chord.tones.find((tone) => tone.role === role)?.pitchClass)
      .filter((pitchClass): pitchClass is number => pitchClass !== undefined);
    const beats = Math.max(1, Math.ceil((event.end - event.start) / QUARTER));
    const notes: Note[] = [];
    let previous = root;
    for (let beat = 0; beat < beats; beat++) {
      const start = event.start + beat * QUARTER;
      let pitch: number;
      if (beat === 0) pitch = root;
      else if (beat === beats - 1 && next) pitch = this.approach(this.nearest(next.chord.bass, previous), previous);
      else pitch = this.nearest(tones[(beat - 1) % Math.max(1, tones.length)] ?? event.chord.root, previous + 1);
      notes.push({ pitch, start, duration: Math.min(QUARTER, event.end - start) * LEGATO, velocity: beat === 0 ? ON_KICK_VELOCITY : OFF_KICK_VELOCITY });
      previous = pitch;
    }
    this.previousPitch = previous;
    return notes;
  }

  /** A half step below a target that is higher, above one that is lower. */
  private approach(target: number, from: number): number {
    const pitch = target > from ? target - 1 : target + 1;
    return Math.min(this.range.high, Math.max(this.range.low, pitch));
  }

  private syncopated(event: BassEvent, next: BassEvent | undefined, kicks: number[]): Note[] {
    const notes = this.onKicks(event, kicks, false);
    const anticipation = event.end - ANTICIPATION_BEATS;
    if (next && anticipation > event.start && !kicks.some((kick) => Math.abs(kick - anticipation) < EPSILON)) {
      const last = notes.at(-1);
      if (last && last.start + last.duration > anticipation) last.duration = Math.max(SIXTEENTH, anticipation - last.start);
      notes.push({ pitch: this.nearest(next.chord.bass, this.previousPitch), start: anticipation, duration: ANTICIPATION_BEATS, velocity: ON_KICK_VELOCITY });
    }
    for (const kick of kicks) {
      const ghost = kick + SIXTEENTH * 3;
      if (kick < event.start || ghost >= event.end - ANTICIPATION_BEATS || !this.random.chance(GHOST_CHANCE)) continue;
      if (notes.some((note) => Math.abs(note.start - ghost) < EPSILON)) continue;
      notes.push({ pitch: this.rootPitch(event.chord), start: ghost, duration: SIXTEENTH * STACCATO, velocity: GHOST_VELOCITY });
    }
    return notes.sort((a, b) => a.start - b.start);
  }

  private arpeggio(event: BassEvent): Note[] {
    const root = this.rootPitch(event.chord);
    const notes: Note[] = [];
    let index = 0;
    for (let start = event.start; start < event.end - EPSILON; start += EIGHTH) {
      const role = ARPEGGIO_SHAPE[index % ARPEGGIO_SHAPE.length] ?? ChordTone.Root;
      const pitchClass = event.chord.tones.find((tone) => tone.role === role)?.pitchClass ?? event.chord.root;
      const octaveUp = index % ARPEGGIO_SHAPE.length === ARPEGGIO_SHAPE.indexOf(ChordTone.Root, 1);
      let pitch = this.nearest(pitchClass, root + (octaveUp ? OCTAVE : 0));
      if (pitch < root && role !== ChordTone.Root) pitch += OCTAVE;
      if (pitch > this.range.high) pitch -= OCTAVE;
      notes.push({ pitch, start, duration: Math.min(EIGHTH, event.end - start) * LEGATO, velocity: index === 0 ? ON_KICK_VELOCITY : OFF_KICK_VELOCITY });
      index += 1;
    }
    return notes;
  }

  /** 808 slides: a note that changes pitch is reached by overlapping the previous note slightly. */
  private addSlides(notes: Note[]): Note[] {
    return notes.map((note, index) => {
      const next = notes[index + 1];
      if (!next || next.pitch === note.pitch || Math.abs(note.start + note.duration - next.start) > EPSILON) return note;
      return { ...note, duration: note.duration + SLIDE_OVERLAP_BEATS };
    });
  }

  private startsWithKicks(event: BassEvent, kicks: number[]): number[] {
    const inside = kicks.filter((kick) => kick >= event.start - EPSILON && kick < event.end - EPSILON);
    const starts = inside.some((kick) => Math.abs(kick - event.start) < EPSILON) ? inside : [event.start, ...inside];
    return starts.length > 0 ? starts : [event.start];
  }

  private kicksInBar(kicks: number[], time: number): number {
    const barStart = Math.floor(time / this.barBeats) * this.barBeats;
    return kicks.filter((kick) => kick >= barStart && kick < barStart + this.barBeats).length;
  }

  /** The chord's bass note (the root, or the slash bass) close to the previous bass note. */
  private rootPitch(chord: ChordSymbol): number {
    const pitch = this.nearest(chord.bass, (this.previousPitch + this.home) / 2);
    this.previousPitch = pitch;
    return pitch;
  }

  private nearest(pitchClass: number, reference: number): number {
    const options = pitchesOfClass(pitchClass, this.range);
    return options.reduce((best, pitch) => (Math.abs(pitch - reference) < Math.abs(best - reference) ? pitch : best), options[0] ?? this.home);
  }
}

const ALL_BASS_STYLES: readonly BassStyle[] = Object.values(BassStyle);

/** The bass style a name refers to; root notes for an unrecognised name. */
export function parseBassStyle(name: string): BassStyle {
  const text = name.trim().toLowerCase();
  return ALL_BASS_STYLES.find((style) => style === text) ?? BassStyle.Root;
}

/** A bassline for chords that locks with the kick drum notes, in one of the bass styles. */
export function bassline(chords: ChordEvent[], kick: Note[], style: BassStyle | string, seed: number = DEFAULT_SEED, barBeats: number = COMMON_BAR_BEATS): Note[] {
  return new BasslineWriter(parseBassStyle(style), new SeededRandom(seed), barBeats).write(chords, kick);
}
