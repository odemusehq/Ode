/** Concert pitch A4 (ISO 16) and its MIDI note number. */
const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;

/** Level in dB of a linear amplitude (dBFS for samples); −Infinity for silence. */
export function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(amplitude);
}

/** Level in dB of a power or mean-square value; −Infinity for silence. */
export function powerToDb(power: number): number {
  return 10 * Math.log10(power);
}

export function dbToPower(db: number): number {
  return 10 ** (db / 10);
}

/** Average of levels in dB, taken over their powers. */
export function meanDb(levels: readonly number[]): number {
  if (levels.length === 0) return -Infinity;
  let sum = 0;
  for (const level of levels) sum += dbToPower(level);
  return powerToDb(sum / levels.length);
}

/** Level of uncorrelated signals added together, from their levels in dB. */
export function sumDb(levels: readonly number[]): number {
  let sum = 0;
  for (const level of levels) sum += dbToPower(level);
  return powerToDb(sum);
}

/** Fractional MIDI note number of a frequency in hertz. */
export function frequencyToMidi(frequency: number): number {
  return A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY);
}
