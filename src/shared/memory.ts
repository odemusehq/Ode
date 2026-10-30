export type MemoryScope = "artist" | "song";
export type MemoryKind = "preference" | "material";

export interface Evidence {
  song?: string;
  note: string;
  time: string;
  exchangeId?: string;
  toolCallId?: string;
  authorship?: "artist" | "ode" | "mixed" | "unknown";
}

/** Something Ode knows about the artist, a song, or material already used. */
export interface ArtistFact {
  id: string;
  scope: MemoryScope;
  kind: MemoryKind;
  songId?: string;
  /** Free text describing when this applies, such as a section or arrangement. */
  context?: string;
  /** Any dimension the artist or Ode finds useful. */
  topic: string;
  value: string;
  /** "said": the artist told Ode. "noticed": Ode inferred it from their material. */
  source: "said" | "noticed";
  /** 0..1. Facts the artist said are always 1. */
  confidence: number;
  evidence: Evidence[];
  updated: string;
}

/** Simple counts of kept vs rejected suggestions, scoped when a choice belongs to a song. */
export interface Habit {
  name: string;
  songId?: string;
  context?: string;
  note?: string;
  /** Exchanges already counted for this habit and scope. */
  exchangeIds?: string[];
  kept: number;
  rejected: number;
  updated: string;
}
