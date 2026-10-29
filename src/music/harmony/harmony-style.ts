export enum ChordFamily {
  Diatonic = "diatonic",
  Seventh = "seventh",
  Borrowed = "borrowed",
  SecondaryDominant = "secondary dominant",
  Colour = "colour",
}

export enum HarmonyStyle {
  Pop = "pop",
  Rock = "rock",
  Jazz = "jazz",
  Soul = "soul",
  Folk = "folk",
  Ballad = "ballad",
  Dance = "dance",
  HipHop = "hip-hop",
  LoFi = "lo-fi",
  Funk = "funk",
  Latin = "latin",
}

export interface StyleProfile {
  /** Cost of using a chord of each family (lower is more typical of the style). */
  familyCost: Readonly<Record<ChordFamily, number>>;
  /** Cost of a 9th, 11th or 13th in the melody over a chord that does not contain it. */
  tensionCost: number;
  /** Cost of moving from a dominant back to a predominant chord. */
  retrogressionCost: number;
}

function profile(
  diatonic: number,
  seventh: number,
  borrowed: number,
  secondary: number,
  colour: number,
  tensionCost: number,
  retrogressionCost: number,
): StyleProfile {
  return {
    familyCost: {
      [ChordFamily.Diatonic]: diatonic,
      [ChordFamily.Seventh]: seventh,
      [ChordFamily.Borrowed]: borrowed,
      [ChordFamily.SecondaryDominant]: secondary,
      [ChordFamily.Colour]: colour,
    },
    tensionCost,
    retrogressionCost,
  };
}

/** How each style uses the chord families: triads, sevenths, borrowed chords, secondary dominants, sus and add9. */
const PROFILES: Readonly<Record<HarmonyStyle, StyleProfile>> = {
  [HarmonyStyle.Pop]: profile(0, 0.5, 0.45, 0.6, 0.3, 0.4, 0.25),
  [HarmonyStyle.Rock]: profile(0, 0.9, 0.2, 0.8, 0.35, 0.6, 0.15),
  [HarmonyStyle.Jazz]: profile(0.6, 0, 0.35, 0.1, 0.3, 0.1, 0.5),
  [HarmonyStyle.Soul]: profile(0.35, 0.05, 0.35, 0.3, 0.15, 0.2, 0.4),
  [HarmonyStyle.Folk]: profile(0, 0.8, 0.6, 0.4, 0.25, 0.5, 0.4),
  [HarmonyStyle.Ballad]: profile(0, 0.45, 0.3, 0.35, 0.2, 0.35, 0.4),
  [HarmonyStyle.Dance]: profile(0, 0.45, 0.4, 0.9, 0.25, 0.4, 0.2),
  [HarmonyStyle.HipHop]: profile(0.15, 0.2, 0.35, 0.7, 0.3, 0.3, 0.15),
  [HarmonyStyle.LoFi]: profile(0.4, 0, 0.35, 0.4, 0.15, 0.15, 0.3),
  [HarmonyStyle.Funk]: profile(0.3, 0.05, 0.4, 0.5, 0.3, 0.2, 0.2),
  [HarmonyStyle.Latin]: profile(0, 0.4, 0.4, 0.5, 0.35, 0.35, 0.2),
};

/** Genre and style names mapped to a harmony style. */
const STYLE_NAMES: readonly [RegExp, HarmonyStyle][] = [
  [/lo-?fi|chill/, HarmonyStyle.LoFi],
  [/jazz|swing|bossa|bebop/, HarmonyStyle.Jazz],
  [/r&b|rnb|r ?and ?b|soul|neo|gospel/, HarmonyStyle.Soul],
  [/trap|hip|rap|drill|boom/, HarmonyStyle.HipHop],
  [/rock|metal|punk|grunge/, HarmonyStyle.Rock],
  [/folk|country|bluegrass|americana|singer/, HarmonyStyle.Folk],
  [/ballad/, HarmonyStyle.Ballad],
  [/house|techno|edm|dance(?!hall)|trance|drum|dnb|garage|dubstep/, HarmonyStyle.Dance],
  [/funk|disco/, HarmonyStyle.Funk],
  [/reggaeton|latin|afro|dancehall|reggae|salsa/, HarmonyStyle.Latin],
  [/pop/, HarmonyStyle.Pop],
];

export function harmonyStyle(name: string | null | undefined): HarmonyStyle {
  const text = (name ?? "").toLowerCase();
  return STYLE_NAMES.find(([pattern]) => pattern.test(text))?.[1] ?? HarmonyStyle.Pop;
}

export function styleProfile(style: HarmonyStyle): StyleProfile {
  return PROFILES[style];
}
