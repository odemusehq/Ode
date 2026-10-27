/** Drum Rack pad notes of Live's default kits, which follow the General MIDI drum map. */
export enum DrumNote {
  Kick = 36,
  Snare = 38,
  Clap = 39,
  ClosedHat = 42,
  LowTom = 45,
  OpenHat = 46,
  MidTom = 47,
  HighTom = 48,
  Crash = 49,
  Ride = 51,
}

export const DRUM_NAMES: Readonly<Record<DrumNote, string>> = {
  [DrumNote.Kick]: "kick",
  [DrumNote.Snare]: "snare",
  [DrumNote.Clap]: "clap",
  [DrumNote.ClosedHat]: "closed hi-hat",
  [DrumNote.LowTom]: "low tom",
  [DrumNote.OpenHat]: "open hi-hat",
  [DrumNote.MidTom]: "mid tom",
  [DrumNote.HighTom]: "high tom",
  [DrumNote.Crash]: "crash",
  [DrumNote.Ride]: "ride",
};

/** Drum Rack notes as name → MIDI note, for showing the mapping. */
export function drumMap(): Record<string, number> {
  return Object.fromEntries(
    (Object.entries(DRUM_NAMES) as [string, string][]).map(([note, name]): [string, number] => [name, Number(note)]),
  );
}
