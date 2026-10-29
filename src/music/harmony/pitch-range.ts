/** A range of MIDI note numbers, inclusive. */
export interface PitchRange {
  low: number;
  high: number;
}

const OCTAVE = 12;

export function requirePitchRange(range: PitchRange): PitchRange {
  if (!Number.isInteger(range.low) || !Number.isInteger(range.high) || range.low < 0 || range.high > 127 || range.low > range.high) {
    throw new RangeError("Pitch range needs integer MIDI bounds from 0 to 127, with low no higher than high.");
  }
  return { ...range };
}

export function rangeCentre(range: PitchRange): number {
  return (range.low + range.high) / 2;
}

export function inRange(pitch: number, range: PitchRange): boolean {
  return pitch >= range.low && pitch <= range.high;
}

/** Moves a pitch by octaves into the range, or reports an infeasible pitch class. */
export function fitByOctaves(pitch: number, range: PitchRange): number {
  requirePitchRange(range);
  let fitted = pitch;
  while (fitted < range.low) fitted += OCTAVE;
  while (fitted > range.high) fitted -= OCTAVE;
  if (!inRange(fitted, range)) throw new RangeError(`Pitch class ${pitch % OCTAVE} cannot fit range ${range.low}–${range.high}.`);
  return fitted;
}

/** Every pitch of a pitch class inside a range. */
export function pitchesOfClass(pitchClass: number, range: PitchRange): number[] {
  const pitches: number[] = [];
  const first = range.low + ((((pitchClass - range.low) % OCTAVE) + OCTAVE) % OCTAVE);
  for (let pitch = first; pitch <= range.high; pitch += OCTAVE) pitches.push(pitch);
  return pitches;
}
