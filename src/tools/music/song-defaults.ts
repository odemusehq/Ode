import type { KeySpec } from "../../music/harmony/musical-key";
import type { PitchRange } from "../../music/harmony/pitch-range";
import type { Accent } from "../../shared/personalisation";
import type { ToolContext } from "../define";

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/** What the music tools fall back on when an input is left out: the Set in Live and the artist's settings. */
export interface SongDefaults {
  accent: Accent;
  genre: string | null;
  vocalRange: PitchRange | null;
  /** Live's tempo, or null before the Set has been read. */
  tempo: number | null;
  /** Live's key and scale when Scale Mode is on (otherwise the Set has no key to go by). */
  key: KeySpec | null;
  /** Live's time signature; 4/4, Live's default, before the Set has been read. */
  timeSignature: TimeSignature;
}

/** Live's default time signature and tempo, used before the Set has been read. */
export const DEFAULT_TIME_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 };
export const DEFAULT_TEMPO = 120;
/** Live counts positions in quarter-note beats. */
const QUARTER_NOTES_PER_WHOLE = 4;

/** Tempo, key and time signature come from the latest snapshot of the Set; the rest from the settings in force. */
export async function songDefaults(ctx: ToolContext): Promise<SongDefaults> {
  const settings = await ctx.prefs.effective(await ctx.song.read());
  const snapshot = ctx.snapshots.latest;
  return {
    accent: settings.pronunciation,
    genre: settings.genre,
    vocalRange: settings.vocalRange,
    tempo: snapshot ? snapshot.song.tempo : null,
    key: snapshot?.song.scaleMode ? { root: snapshot.song.rootNote, scale: snapshot.song.scaleName } : null,
    timeSignature: snapshot ? { ...snapshot.signature } : DEFAULT_TIME_SIGNATURE,
  };
}

/** The accent given, or the pronunciation setting (song over artist). */
export async function resolveAccent(ctx: ToolContext, accent: Accent | undefined): Promise<Accent> {
  return accent ?? (await songDefaults(ctx)).accent;
}

/** Quarter-note beats in one bar of a time signature (4 in 4/4, 3 in 6/8). */
export function quarterBeatsPerBar(signature: TimeSignature): number {
  return (signature.numerator * QUARTER_NOTES_PER_WHOLE) / signature.denominator;
}
