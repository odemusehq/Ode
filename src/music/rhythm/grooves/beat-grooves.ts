// Grooves for hip-hop, trap, R&B and lo-fi on a sixteenth grid ("X" accent, "x" hit, "o" ghost, "." rest).
import { DrumNote } from "../drum-kit";
import { FillStyle, type GrooveDefinition } from "./groove";

export const HIP_HOP: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  main: {
    [DrumNote.Kick]: "x......x..x.....",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x......x.xx...x.",
    [DrumNote.Snare]: "....X.......X..o",
    [DrumNote.ClosedHat]: "x.x.x...x.x.x.x.",
    [DrumNote.OpenHat]: "......x.........",
  },
  halfTime: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  swing: 0.55,
  fill: FillStyle.KickDrop,
  tight: false,
};

/** Trap is felt in half time: the snare and clap land on beat 3 of each bar. */
export const TRAP: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x...............",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x......x..x.....",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.Clap]: "........X.......",
    [DrumNote.ClosedHat]: "xxxxxxxxxxxxxxxx",
  },
  full: {
    [DrumNote.Kick]: "x......x..x..x..",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.Clap]: "........X.......",
    [DrumNote.ClosedHat]: "xxxxxxxxxxxxxx.x",
    [DrumNote.OpenHat]: "..............x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x...............",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  swing: 0,
  fill: FillStyle.HatRoll,
  tight: true,
};

export const RNB: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x......x.x......",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.xxx.x.x.xxx.x.",
  },
  full: {
    [DrumNote.Kick]: "x......x.x....x.",
    [DrumNote.Snare]: "....X..o....X...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.xxx.xxx.xxx.xx",
  },
  halfTime: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  swing: 0.35,
  fill: FillStyle.Toms,
  tight: false,
};

export const LO_FI: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x.......x.x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x......x..x.....",
    [DrumNote.Snare]: "....x.......x..o",
    [DrumNote.ClosedHat]: "x.xxx.x.x.xxx...",
    [DrumNote.OpenHat]: "..............x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "........x.......",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  swing: 0.6,
  fill: FillStyle.KickDrop,
  tight: false,
};
