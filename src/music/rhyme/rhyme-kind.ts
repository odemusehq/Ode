export enum RhymeKind {
  Perfect = "perfect",
  Near = "near",
  Assonance = "assonance",
  Consonance = "consonance",
  Multisyllabic = "multisyllabic",
  Identical = "identical",
  None = "none",
}

export interface RhymeResult {
  kind: RhymeKind;
  /** 0–1: how strongly the two sound alike at the end. */
  score: number;
}

export const NO_RHYME: RhymeResult = { kind: RhymeKind.None, score: 0 };

/** Full rhymes. */
export const STRONG_KINDS: ReadonlySet<RhymeKind> = new Set([RhymeKind.Perfect, RhymeKind.Multisyllabic]);

/** Kinds that join two line endings in a rhyme scheme; consonance alone is too loose. */
export const SCHEME_KINDS: ReadonlySet<RhymeKind> = new Set([
  RhymeKind.Perfect,
  RhymeKind.Multisyllabic,
  RhymeKind.Identical,
  RhymeKind.Near,
  RhymeKind.Assonance,
]);

/** Order for presenting rhymes, strongest first. */
export const KIND_ORDER: ReadonlyMap<RhymeKind, number> = new Map([
  [RhymeKind.Perfect, 0],
  [RhymeKind.Multisyllabic, 0],
  [RhymeKind.Near, 1],
  [RhymeKind.Assonance, 2],
  [RhymeKind.Consonance, 3],
  [RhymeKind.Identical, 4],
  [RhymeKind.None, 5],
]);

export function strongerRhyme(a: RhymeResult, b: RhymeResult): RhymeResult {
  return b.score > a.score ? b : a;
}

/** Plain-words name of a kind, for notes. */
export function describeKind(kind: RhymeKind): string {
  return kind === RhymeKind.None ? "no rhyme" : `${kind} rhyme`;
}
