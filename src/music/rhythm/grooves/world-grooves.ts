// Grooves for reggaeton and afrobeats on a sixteenth grid ("X" accent, "x" hit, "o" ghost, "." rest).
import { DrumNote } from "../drum-kit";
import { FillStyle, type GrooveDefinition } from "./groove";

/** The dembow rhythm: kick on every beat, snare on the "a" of 1, the "and" of 2, the "a" of 3 and the "and" of 4. */
export const REGGAETON: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Snare]: "...x..x....x..x.",
  },
  main: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Snare]: "...x..x....x..x.",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Snare]: "...X..x....X..x.",
    [DrumNote.Clap]: "...x..x....x..x.",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.Snare]: "...x..x.........",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  swing: 0,
  fill: FillStyle.Percussion,
  tight: false,
};

/** Afrobeats: a syncopated kick, soft backbeat, shaker-like hi-hat sixteenths and a tom figure for percussion. */
export const AFROBEATS: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.ClosedHat]: "XoooXoooXoooXooo",
  },
  main: {
    [DrumNote.Kick]: "x......x..x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "XoxoXoxoXoxoXoxo",
    [DrumNote.HighTom]: "...x..x....x....",
  },
  full: {
    [DrumNote.Kick]: "x......x..x...x.",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "XoxoXoxoXoxoXoxo",
    [DrumNote.HighTom]: "...x..x....x..x.",
    [DrumNote.LowTom]: ".......x.......x",
  },
  halfTime: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "........x.......",
    [DrumNote.ClosedHat]: "XoooXoooXoooXooo",
  },
  swing: 0.2,
  fill: FillStyle.Percussion,
  tight: false,
};
