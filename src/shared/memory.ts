export interface Evidence {
  song?: string;
  note: string;
  time: string;
}

/** Something Ode knows about the artist. */
export interface ArtistFact {
  id: string;
  /** e.g. "vocal range", "rhyme taste", "chord vocabulary", "dislikes". */
  topic: string;
  value: string;
  /** "said": the artist told Ode. "noticed": Ode inferred it from their material. */
  source: "said" | "noticed";
  /** 0..1. Facts the artist said are always 1. */
  confidence: number;
  evidence: Evidence[];
  updated: string;
}

/** Simple counts of kept vs rejected suggestions for a habit, e.g. "near rhymes". */
export interface Habit {
  name: string;
  kept: number;
  rejected: number;
  updated: string;
}
