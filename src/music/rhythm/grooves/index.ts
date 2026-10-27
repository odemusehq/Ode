import { Genre } from "../genre";
import { BALLAD, FUNK, POP, ROCK } from "./band-grooves";
import { HIP_HOP, LO_FI, RNB, TRAP } from "./beat-grooves";
import { DRUM_AND_BASS, HOUSE, TECHNO } from "./dance-grooves";
import type { GrooveDefinition } from "./groove";
import { AFROBEATS, REGGAETON } from "./world-grooves";

export const GROOVES: Readonly<Record<Genre, GrooveDefinition>> = {
  [Genre.Pop]: POP,
  [Genre.Rock]: ROCK,
  [Genre.Ballad]: BALLAD,
  [Genre.Funk]: FUNK,
  [Genre.HipHop]: HIP_HOP,
  [Genre.Trap]: TRAP,
  [Genre.RnB]: RNB,
  [Genre.LoFi]: LO_FI,
  [Genre.House]: HOUSE,
  [Genre.Techno]: TECHNO,
  [Genre.DrumAndBass]: DRUM_AND_BASS,
  [Genre.Reggaeton]: REGGAETON,
  [Genre.Afrobeats]: AFROBEATS,
};

export { FillStyle, type GrooveDefinition } from "./groove";
