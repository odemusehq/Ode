/** A range of MIDI note numbers, inclusive. */
export interface PitchRange {
  low: number;
  high: number;
}

const OCTAVE = 12;

export function rangeCentre(range: PitchRange): number {
  return (range.low + range.high) / 2;
}

export function inRange(pitch: number, range: PitchRange): boolean {
  return pitch >= range.low && pitch <= range.high;
}

/** Moves a pitch by octaves until it fits the range (or is as close as it can get). */
export function fitByOctaves(pitch: number, range: PitchRange): number {
  let fitted = pitch;
  while (fitted < range.low) fitted += OCTAVE;
  while (fitted > range.high) fitted -= OCTAVE;
  return fitted < range.low ? fitted + OCTAVE : fitted;
}

/** Every pitch of a pitch class inside a range. */
export function pitchesOfClass(pitchClass: number, range: PitchRange): number[] {
  const pitches: number[] = [];
  const first = range.low + ((((pitchClass - range.low) % OCTAVE) + OCTAVE) % OCTAVE);
  for (let pitch = first; pitch <= range.high; pitch += OCTAVE) pitches.push(pitch);
  return pitches;
}
