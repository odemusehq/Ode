// Grooves for pop, rock, ballad and funk on a sixteenth grid ("X" accent, "x" hit, "o" ghost, "." rest).
import { DrumNote } from "../drum-kit";
import { FillStyle, type GrooveDefinition } from "./groove";

export const POP: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  main: {
    [DrumNote.Kick]: "x.....x.x.......",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x.....x.x.....x.",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x...",
    [DrumNote.OpenHat]: "..............x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  turnaround: { [DrumNote.Kick]: "..............x." },
  swing: 0,
  fill: FillStyle.Toms,
  tight: false,
};

export const ROCK: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x.......x.x.....",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x.x.....x.x.....",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.Ride]: "x.x.x.x.x.x.x.x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.Ride]: "x...x...x...x...",
  },
  turnaround: { [DrumNote.Kick]: ".......x........" },
  swing: 0,
  fill: FillStyle.Toms,
  tight: false,
};

export const BALLAD: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x...............",
    [DrumNote.Snare]: "........o.......",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  main: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x.....x...x.....",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.Ride]: "x.x.x.x.x.x.x.x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x...............",
    [DrumNote.Snare]: "........x.......",
    [DrumNote.ClosedHat]: "x...x...x...x...",
  },
  swing: 0.1,
  fill: FillStyle.Toms,
  tight: false,
};

export const FUNK: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "....x.......x...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x.x....x..x.....",
    [DrumNote.Snare]: "....X..o.o..X..o",
    [DrumNote.ClosedHat]: "XxxxXxxxXxxxXxxx",
  },
  full: {
    [DrumNote.Kick]: "x.x...xx..x...x.",
    [DrumNote.Snare]: "....X..o.o..X.oo",
    [DrumNote.ClosedHat]: "XxxxXxxxXxxxXx.x",
    [DrumNote.OpenHat]: "..............x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.x.......x.....",
    [DrumNote.Snare]: "........X......o",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  swing: 0.25,
  fill: FillStyle.Toms,
  tight: false,
};
