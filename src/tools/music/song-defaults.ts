import type { KeySpec } from "../../music/harmony/musical-key";
import type { PitchRange } from "../../music/harmony/pitch-range";
import type { Accent } from "../../shared/personalisation";
import type { ToolContext } from "../define";

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/** What the music tools fall back on when an input is left out: the song and the artist's settings. */
export interface SongDefaults {
  accent: Accent;
  genre: string | null;
  vocalRange: PitchRange | null;
  tempo: number | null;
  key: KeySpec | null;
  timeSignature: TimeSignature;
}

/** Live's default time signature and tempo, used when the song has none. */
export const DEFAULT_TIME_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 };
export const DEFAULT_TEMPO = 120;
/** Live counts positions in quarter-note beats. */
const QUARTER_NOTES_PER_WHOLE = 4;

export async function songDefaults(ctx: ToolContext): Promise<SongDefaults> {
  const sheet = await ctx.song.read();
  const settings = await ctx.prefs.effective(sheet);
  return {
    accent: settings.pronunciation,
    genre: settings.genre,
    vocalRange: settings.vocalRange,
    tempo: sheet.tempo ?? null,
    key: sheet.key ?? null,
    timeSignature: sheet.timeSignature ?? DEFAULT_TIME_SIGNATURE,
  };
}

/** The accent given, or the pronunciation setting (Personalisation, song over artist). */
export async function resolveAccent(ctx: ToolContext, accent: Accent | undefined): Promise<Accent> {
  return accent ?? (await songDefaults(ctx)).accent;
}

/** Quarter-note beats in one bar of a time signature (4 in 4/4, 3 in 6/8). */
export function quarterBeatsPerBar(signature: TimeSignature): number {
  return (signature.numerator * QUARTER_NOTES_PER_WHOLE) / signature.denominator;
}
