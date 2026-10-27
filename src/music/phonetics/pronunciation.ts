import type { SyllableInfo } from "../../shared/lyrics";

/** 1 primary, 2 secondary, 0 unstressed. */
export type StressLevel = SyllableInfo["stress"];

export const Stress = { None: 0, Primary: 1, Secondary: 2 } as const satisfies Record<string, StressLevel>;

export interface Pronunciation {
  /** IPA phonemes; diphthongs and affricates are single entries ("aɪ", "tʃ"). */
  phonemes: string[];
  /** One stress level per syllable (per vowel). */
  stresses: StressLevel[];
  /** False when the pronunciation is a best guess (letter-to-sound rules or an uncertain accent rule). */
  certain: boolean;
}

export function syllableCount(pronunciation: Pronunciation): number {
  return pronunciation.stresses.length;
}

export function pronunciationKey(pronunciation: Pronunciation): string {
  return `${pronunciation.phonemes.join(" ")}|${pronunciation.stresses.join("")}`;
}

/** Removes duplicates, keeping the first occurrence; a duplicate that is certain makes the kept one certain. */
export function uniquePronunciations(pronunciations: Pronunciation[]): Pronunciation[] {
  const byKey = new Map<string, Pronunciation>();
  for (const pronunciation of pronunciations) {
    const key = pronunciationKey(pronunciation);
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, pronunciation);
    else if (pronunciation.certain && !existing.certain) byKey.set(key, { ...existing, certain: true });
  }
  return [...byKey.values()];
}

export function withCertainty(pronunciation: Pronunciation, certain: boolean): Pronunciation {
  return pronunciation.certain === certain ? pronunciation : { ...pronunciation, certain };
}

/** Joins pronunciations of parts (compounds, number words) into one; later parts keep only secondary stress. */
export function joinPronunciations(parts: Pronunciation[], certain: boolean): Pronunciation {
  const phonemes: string[] = [];
  const stresses: StressLevel[] = [];
  parts.forEach((part, index) => {
    phonemes.push(...part.phonemes);
    for (const stress of part.stresses) {
      stresses.push(index === 0 || stress !== Stress.Primary ? stress : Stress.Secondary);
    }
  });
  return { phonemes, stresses, certain };
}
