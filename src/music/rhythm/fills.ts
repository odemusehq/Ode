import { DrumNote } from "./drum-kit";
import { FillStyle } from "./grooves";
import { STEP_BEATS } from "./step-pattern";

export interface TimedHit {
  drum: DrumNote;
  /** Beats from the start of the clip. */
  start: number;
  velocity: number;
}

export interface Fill {
  hits: TimedHit[];
  /** Drums whose groove hits are removed during the fill. */
  replaces: DrumNote[];
}

/** Fill velocities rise from soft to strong. */
const FILL_START_VELOCITY = 75;
const FILL_END_VELOCITY = 118;
const ROLL_START_VELOCITY = 55;
/** Above this energy a snare roll doubles to thirty-second notes in its last beat. */
const DOUBLE_ROLL_ENERGY = 0.7;
const THIRTY_SECOND = STEP_BEATS / 2;
const LAST_BEAT = 1;
const EPSILON = 1e-9;
const TOM_RUN_ONE_BEAT: readonly DrumNote[] = [DrumNote.Snare, DrumNote.HighTom, DrumNote.MidTom, DrumNote.LowTom];
const TOM_RUN_TWO_BEATS: readonly DrumNote[] = [
  DrumNote.Snare,
  DrumNote.Snare,
  DrumNote.HighTom,
  DrumNote.HighTom,
  DrumNote.MidTom,
  DrumNote.MidTom,
  DrumNote.LowTom,
  DrumNote.LowTom,
];
/** Percussion pickup on sixteenths: high, high, mid, low tom across each beat of the fill, with gaps. */
const PERCUSSION_FIGURE: readonly (DrumNote | null)[] = [DrumNote.HighTom, null, DrumNote.HighTom, DrumNote.MidTom];

function ramp(index: number, count: number, from: number, to: number): number {
  return count <= 1 ? to : from + ((to - from) * index) / (count - 1);
}

/** Fills that end a section: tom runs, snare rolls, hi-hat rolls, percussion pickups or a drop-out. */
export class FillWriter {
  write(style: FillStyle, start: number, beats: number, energy: number): Fill {
    switch (style) {
      case FillStyle.Toms:
        return this.toms(start, beats);
      case FillStyle.SnareRoll:
        return this.snareRoll(start, beats, energy);
      case FillStyle.HatRoll:
        return this.hatRoll(start, beats);
      case FillStyle.Percussion:
        return this.percussion(start, beats);
      case FillStyle.KickDrop:
        return this.kickDrop(start, beats);
    }
  }

  private toms(start: number, beats: number): Fill {
    const run = beats >= 2 ? TOM_RUN_TWO_BEATS : TOM_RUN_ONE_BEAT;
    const steps = Math.round(beats / STEP_BEATS);
    const hits: TimedHit[] = [{ drum: DrumNote.Kick, start, velocity: FILL_END_VELOCITY }];
    for (let step = 0; step < steps; step++) {
      const drum = run[Math.floor((step * run.length) / steps)] ?? DrumNote.Snare;
      hits.push({ drum, start: start + step * STEP_BEATS, velocity: ramp(step, steps, FILL_START_VELOCITY, FILL_END_VELOCITY) });
    }
    return {
      hits,
      replaces: [DrumNote.Snare, DrumNote.Clap, DrumNote.ClosedHat, DrumNote.OpenHat, DrumNote.Ride, DrumNote.LowTom, DrumNote.MidTom, DrumNote.HighTom],
    };
  }

  private snareRoll(start: number, beats: number, energy: number): Fill {
    const hits: TimedHit[] = [];
    const end = start + beats;
    const doubleFrom = energy > DOUBLE_ROLL_ENERGY ? end - LAST_BEAT : end;
    const times: number[] = [];
    for (let time = start; time < end - EPSILON; time += time >= doubleFrom - EPSILON ? THIRTY_SECOND : STEP_BEATS) times.push(time);
    times.forEach((time, index) => hits.push({ drum: DrumNote.Snare, start: time, velocity: ramp(index, times.length, ROLL_START_VELOCITY, FILL_END_VELOCITY) }));
    return { hits, replaces: [DrumNote.Snare, DrumNote.Clap, DrumNote.OpenHat] };
  }

  private hatRoll(start: number, beats: number): Fill {
    const count = Math.round(beats / THIRTY_SECOND);
    const hits: TimedHit[] = [];
    for (let index = 0; index < count; index++) {
      hits.push({ drum: DrumNote.ClosedHat, start: start + index * THIRTY_SECOND, velocity: ramp(index, count, ROLL_START_VELOCITY, FILL_END_VELOCITY) });
    }
    return { hits, replaces: [DrumNote.ClosedHat, DrumNote.OpenHat] };
  }

  private percussion(start: number, beats: number): Fill {
    const steps = Math.round(beats / STEP_BEATS);
    const hits: TimedHit[] = [];
    for (let step = 0; step < steps; step++) {
      const drum = PERCUSSION_FIGURE[step % PERCUSSION_FIGURE.length];
      if (drum === null || drum === undefined) continue;
      const lastTom = step === steps - 1 ? DrumNote.LowTom : drum;
      hits.push({ drum: lastTom, start: start + step * STEP_BEATS, velocity: ramp(step, steps, FILL_START_VELOCITY, FILL_END_VELOCITY) });
    }
    return { hits, replaces: [DrumNote.Snare, DrumNote.Clap, DrumNote.HighTom, DrumNote.MidTom, DrumNote.LowTom] };
  }

  /** The kick and backbeat drop out, leaving the hats and an open hat into the next section. */
  private kickDrop(start: number, beats: number): Fill {
    const lastOffBeat = start + beats - 2 * STEP_BEATS;
    return {
      hits: [{ drum: DrumNote.OpenHat, start: lastOffBeat, velocity: FILL_END_VELOCITY }],
      replaces: [DrumNote.Kick, DrumNote.Snare, DrumNote.Clap, DrumNote.OpenHat],
    };
  }
}
