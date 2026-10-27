/** What a track carries, guessed from its name; decides which track gives way when two share a band. */
export enum TrackRole {
  Kick = "kick",
  Bass = "bass",
  Vocal = "vocal",
  Other = "other",
}

/** Common words in track names for each role, checked in this order (a "bass drum" is a kick). */
const ROLE_PATTERNS: readonly [TrackRole, RegExp][] = [
  [TrackRole.Kick, /\b(kick|kik|bd|bass ?drum)\b/i],
  [TrackRole.Bass, /\b(bass|sub|808)\b/i],
  [TrackRole.Vocal, /\b(vox|vocals?|voice|singer|bvs?|adlibs?|choir)\b/i],
];

export function roleFromName(name: string): TrackRole {
  for (const [role, pattern] of ROLE_PATTERNS) if (pattern.test(name)) return role;
  return TrackRole.Other;
}
