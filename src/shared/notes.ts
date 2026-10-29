/** MIDI note numbers and velocities go up to 127. */
export const MIDI_MAX = 127;

/** Pitch-class names, index 0 = C. */
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Note name as Live shows it (MIDI 60 = C3). */
export function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 2}`;
}
