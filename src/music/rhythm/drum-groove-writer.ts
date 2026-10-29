import type { Note } from "../../shared/live";
import type { SectionKind } from "../../shared/song";
import { DrumNote } from "./drum-kit";
import { FillWriter, type TimedHit } from "./fills";
import { parseGenre, type Genre } from "./genre";
import { FillStyle, GROOVES, type GrooveDefinition } from "./grooves";
import { Humanizer } from "./humanizer";
import { SeededRandom } from "./random";
import { HitStrength, layer, STEP_BEATS, type StepHit } from "./step-pattern";

export enum SectionFeel {
  Sparse = "sparse",
  Main = "main",
  Full = "full",
  HalfTime = "half time",
  Breakdown = "breakdown",
  Build = "build",
}

/** Grooves are written in 4/4. */
const BEATS_PER_BAR = 4;
const STRENGTH_VELOCITY: Readonly<Record<HitStrength, number>> = {
  [HitStrength.Accent]: 112,
  [HitStrength.Normal]: 92,
  [HitStrength.Ghost]: 52,
};
/** At zero energy hits play at this share of their velocity. */
const ENERGY_FLOOR = 0.75;
const GHOST_MIN_ENERGY = 0.4;
const CRASH_MIN_ENERGY = 0.5;
const CRASH_VELOCITY = 110;
const ENDING_VELOCITY = 115;
const LONG_FILL_ENERGY = 0.6;
const LONG_FILL_BEATS = 2;
const SHORT_FILL_BEATS = 1;
const DRUM_HIT_BEATS = 0.25;
const BUILD_START_VELOCITY = 60;
const BUILD_END_VELOCITY = 118;
/** A build's snare goes from quarter notes to eighths to sixteenths, and thirty-seconds in its last beat. */
const BUILD_DIVISIONS = [1, 0.5, 0.25];
const BUILD_LAST_DIVISION = 0.125;
/** Trap hi-hat rolls fill the last beat of every second bar with thirty-second notes. */
const HAT_ROLL_FROM_STEP = 12;
const THIRTY_SECOND = STEP_BEATS / 2;
const HAT_ROLL_VELOCITY = 80;
const BREAKDOWN_KICK_ENERGY = 0.6;
/** Energy levels (0–1) where a section's groove changes intensity. */
const QUIET_INTRO = 0.5;
const QUIET_VERSE = 0.35;
const DRIVING_VERSE = 0.85;
const DRIVING_PRE_CHORUS = 0.75;
const QUIET_CHORUS = 0.3;
const QUIET_OUTRO = 0.4;
const DEFAULT_SEED = 1;
const EPSILON = 1e-9;
const SECTIONS_WITH_CRASH: ReadonlySet<SectionKind> = new Set<SectionKind>(["chorus", "post-chorus", "drop"]);
const SECTIONS_WITHOUT_FILL: ReadonlySet<SectionKind> = new Set<SectionKind>(["breakdown", "build", "outro"]);

/**
 * Writes Drum Rack notes for a genre and song section: the genre's groove at the section's
 * intensity, crashes into big sections, fills at section ends, builds and breakdowns, swing and
 * humanised velocity and timing.
 */
export class DrumGrooveWriter {
  private readonly fills = new FillWriter();

  constructor(private readonly random: SeededRandom) {}

  write(genre: Genre, section: SectionKind, bars: number, energy: number): Note[] {
    const groove = GROOVES[genre];
    const level = Math.min(1, Math.max(0, energy));
    const feel = this.feel(section, level);
    const barCount = Math.max(1, Math.round(bars));
    let hits: TimedHit[] = [];
    for (let bar = 0; bar < barCount; bar++) hits.push(...this.bar(groove, feel, bar, barCount, level));
    if (!SECTIONS_WITHOUT_FILL.has(section)) hits = this.withFill(hits, groove, barCount, level);
    if (SECTIONS_WITH_CRASH.has(section) && level >= CRASH_MIN_ENERGY) hits.push({ drum: DrumNote.Crash, start: 0, velocity: CRASH_VELOCITY });
    if (section === "outro") hits = this.withEnding(hits, barCount);
    const humanizer = new Humanizer(this.random, groove.swing, groove.tight);
    return hits
      .sort((a, b) => a.start - b.start || a.drum - b.drum)
      .map((hit) => ({ pitch: hit.drum, start: humanizer.time(hit.start), duration: DRUM_HIT_BEATS, velocity: humanizer.velocity(hit.velocity) }));
  }

  feel(section: SectionKind, energy: number): SectionFeel {
    switch (section) {
      case "intro":
        return energy < QUIET_INTRO ? SectionFeel.Sparse : SectionFeel.Main;
      case "verse":
        return energy < QUIET_VERSE ? SectionFeel.Sparse : energy > DRIVING_VERSE ? SectionFeel.Full : SectionFeel.Main;
      case "pre-chorus":
        return energy > DRIVING_PRE_CHORUS ? SectionFeel.Full : SectionFeel.Main;
      case "chorus":
      case "post-chorus":
      case "drop":
        return energy < QUIET_CHORUS ? SectionFeel.Main : SectionFeel.Full;
      case "bridge":
        return SectionFeel.HalfTime;
      case "breakdown":
        return SectionFeel.Breakdown;
      case "build":
        return SectionFeel.Build;
      case "outro":
        return energy < QUIET_OUTRO ? SectionFeel.Sparse : SectionFeel.Main;
      case "other":
        return SectionFeel.Main;
    }
  }

  private bar(groove: GrooveDefinition, feel: SectionFeel, bar: number, bars: number, energy: number): TimedHit[] {
    if (feel === SectionFeel.Build) return this.buildBar(bar, bars);
    const second = bar % 2 === 1;
    const extra = second && groove.turnaround ? [groove.turnaround] : [];
    let steps: StepHit[];
    switch (feel) {
      case SectionFeel.Sparse:
        steps = layer(groove.sparse);
        break;
      case SectionFeel.Full:
        steps = layer(groove.full, ...extra);
        break;
      case SectionFeel.HalfTime:
        steps = layer(groove.halfTime);
        break;
      case SectionFeel.Breakdown:
        steps = this.breakdown(groove, energy);
        break;
      default:
        steps = layer(groove.main, ...extra);
    }
    if (energy < GHOST_MIN_ENERGY) steps = steps.filter((hit) => hit.strength !== HitStrength.Ghost);
    const scale = ENERGY_FLOOR + (1 - ENERGY_FLOOR) * energy;
    const offset = bar * BEATS_PER_BAR;
    const hits = steps.map((hit) => ({ drum: hit.drum, start: offset + hit.step * STEP_BEATS, velocity: STRENGTH_VELOCITY[hit.strength] * scale }));
    const rolls = groove.fill === FillStyle.HatRoll && second && (feel === SectionFeel.Main || feel === SectionFeel.Full);
    return rolls ? this.withHatRoll(hits, offset) : hits;
  }

  /** Breakdowns keep hats and claps; the kick stays only on the downbeat when energy is still high. */
  private breakdown(groove: GrooveDefinition, energy: number): StepHit[] {
    return layer(groove.sparse).filter(
      (hit) => hit.drum !== DrumNote.Snare && (hit.drum !== DrumNote.Kick || (energy > BREAKDOWN_KICK_ENERGY && hit.step === 0)),
    );
  }

  /** Snare roll that speeds up across the build, kick on the beat, dropping out for the last beat. */
  private buildBar(bar: number, bars: number): TimedHit[] {
    const progress = (bar + 1) / bars;
    const division = BUILD_DIVISIONS[Math.min(BUILD_DIVISIONS.length - 1, Math.floor(progress * BUILD_DIVISIONS.length - EPSILON))] ?? STEP_BEATS;
    const totalBeats = bars * BEATS_PER_BAR;
    const start = bar * BEATS_PER_BAR;
    const lastBeat = totalBeats - 1;
    const hits: TimedHit[] = [];
    for (let beat = start; beat < start + BEATS_PER_BAR; beat++) {
      if (beat < lastBeat) hits.push({ drum: DrumNote.Kick, start: beat, velocity: BUILD_END_VELOCITY });
    }
    for (let time = start; time < start + BEATS_PER_BAR - EPSILON; ) {
      const velocity = BUILD_START_VELOCITY + ((BUILD_END_VELOCITY - BUILD_START_VELOCITY) * time) / totalBeats;
      hits.push({ drum: DrumNote.Snare, start: time, velocity });
      time += time >= lastBeat - EPSILON ? BUILD_LAST_DIVISION : division;
    }
    return hits;
  }

  private withHatRoll(hits: TimedHit[], barStart: number): TimedHit[] {
    const rollStart = barStart + HAT_ROLL_FROM_STEP * STEP_BEATS;
    const kept = hits.filter((hit) => !(hit.drum === DrumNote.ClosedHat && hit.start >= rollStart - EPSILON));
    for (let time = rollStart; time < barStart + BEATS_PER_BAR - EPSILON; time += THIRTY_SECOND) {
      kept.push({ drum: DrumNote.ClosedHat, start: time, velocity: HAT_ROLL_VELOCITY });
    }
    return kept;
  }

  private withFill(hits: TimedHit[], groove: GrooveDefinition, bars: number, energy: number): TimedHit[] {
    const length = energy >= LONG_FILL_ENERGY ? LONG_FILL_BEATS : SHORT_FILL_BEATS;
    const start = bars * BEATS_PER_BAR - length;
    const fill = this.fills.write(groove.fill, start, length, energy);
    const replaced = new Set(fill.replaces);
    // A groove hit on the same drum and beat as a fill hit gives way to it, so each drum sounds once there.
    const doubled = (hit: TimedHit) => fill.hits.some((added) => added.drum === hit.drum && Math.abs(added.start - hit.start) < EPSILON);
    return [...hits.filter((hit) => (hit.start < start - EPSILON || !replaced.has(hit.drum)) && !doubled(hit)), ...fill.hits];
  }

  /** The last bar of an outro is a single kick and crash on its downbeat. */
  private withEnding(hits: TimedHit[], bars: number): TimedHit[] {
    const lastBar = (bars - 1) * BEATS_PER_BAR;
    return [
      ...hits.filter((hit) => hit.start < lastBar - EPSILON),
      { drum: DrumNote.Kick, start: lastBar, velocity: ENDING_VELOCITY },
      { drum: DrumNote.Crash, start: lastBar, velocity: ENDING_VELOCITY },
    ];
  }
}

/** Drum Rack notes for a genre and section (36 kick, 38 snare, 39 clap, 42/46 hats, 49 crash, 51 ride, 45/47/48 toms). */
export function drumGroove(genre: string, section: SectionKind, bars: number, energy: number, seed: number = DEFAULT_SEED): Note[] {
  return new DrumGrooveWriter(new SeededRandom(seed)).write(parseGenre(genre), section, bars, energy);
}
