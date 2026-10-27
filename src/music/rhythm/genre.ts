export enum Genre {
  Pop = "pop",
  Rock = "rock",
  HipHop = "hip-hop",
  Trap = "trap",
  House = "house",
  Techno = "techno",
  DrumAndBass = "drum and bass",
  RnB = "r&b",
  Funk = "funk",
  Reggaeton = "reggaeton",
  Afrobeats = "afrobeats",
  LoFi = "lo-fi",
  Ballad = "ballad",
}

/** Names musicians use for each genre (and close relatives), checked in order. */
const GENRE_NAMES: readonly [RegExp, Genre][] = [
  [/lo-?fi|chillhop/, Genre.LoFi],
  [/trap|drill/, Genre.Trap],
  [/hip.?hop|rap|boom.?bap/, Genre.HipHop],
  [/drum.?(and|&|n).?bass|dnb|d&b|jungle/, Genre.DrumAndBass],
  [/techno/, Genre.Techno],
  [/house|disco|edm|dance|garage/, Genre.House],
  [/r&b|rnb|r ?and ?b|soul|neo/, Genre.RnB],
  [/funk/, Genre.Funk],
  [/reggaeton|dembow|latin/, Genre.Reggaeton],
  [/afro|amapiano|dancehall/, Genre.Afrobeats],
  [/ballad|acoustic|singer.?songwriter/, Genre.Ballad],
  [/rock|metal|punk|grunge|indie/, Genre.Rock],
  [/pop/, Genre.Pop],
];

export const ALL_GENRES: readonly Genre[] = Object.values(Genre);

/** The genre a name refers to; pop when it is not recognised. */
export function parseGenre(name: string | null | undefined): Genre {
  const text = (name ?? "").trim().toLowerCase();
  const exact = ALL_GENRES.find((genre) => genre === text);
  if (exact) return exact;
  return GENRE_NAMES.find(([pattern]) => pattern.test(text))?.[1] ?? Genre.Pop;
}

/** Whether a name was recognised as a genre (rather than falling back to pop). */
export function isKnownGenre(name: string | null | undefined): boolean {
  const text = (name ?? "").trim().toLowerCase();
  return ALL_GENRES.some((genre) => genre === text) || GENRE_NAMES.some(([pattern]) => pattern.test(text));
}
