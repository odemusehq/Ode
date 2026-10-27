// Grooves for house, techno and drum and bass on a sixteenth grid ("X" accent, "x" hit, "o" ghost, "." rest).
import { DrumNote } from "../drum-kit";
import { FillStyle, type GrooveDefinition } from "./groove";

export const HOUSE: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  main: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  full: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "xx.xxx.xxx.xxx.x",
    [DrumNote.OpenHat]: "..x...x...x...x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.Clap]: "........x.......",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  swing: 0,
  fill: FillStyle.SnareRoll,
  tight: true,
};

export const TECHNO: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  main: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  full: {
    [DrumNote.Kick]: "x...x...x...x...",
    [DrumNote.Clap]: "....x.......x...",
    [DrumNote.ClosedHat]: "xxXxxxXxxxXxxxXx",
    [DrumNote.Ride]: "..x...x...x...x.",
  },
  halfTime: {
    [DrumNote.Kick]: "x.......x.......",
    [DrumNote.ClosedHat]: "..x...x...x...x.",
  },
  swing: 0,
  fill: FillStyle.KickDrop,
  tight: true,
};

/** Drum and bass two-step: kick on 1 and the "and" of 3, snare on 2 and 4, at around 170–175 BPM. */
export const DRUM_AND_BASS: GrooveDefinition = {
  sparse: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  main: {
    [DrumNote.Kick]: "x.........x.....",
    [DrumNote.Snare]: "....X.......X...",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  full: {
    [DrumNote.Kick]: "x.........x..x..",
    [DrumNote.Snare]: "....X..o....X...",
    [DrumNote.ClosedHat]: "xxxxxxxxxxxxxxxx",
    [DrumNote.Ride]: "x...x...x...x...",
  },
  halfTime: {
    [DrumNote.Kick]: "x...............",
    [DrumNote.Snare]: "........X.......",
    [DrumNote.ClosedHat]: "x.x.x.x.x.x.x.x.",
  },
  swing: 0,
  fill: FillStyle.SnareRoll,
  tight: true,
};
