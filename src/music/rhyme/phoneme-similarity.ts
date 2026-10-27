import { consonantFeatures, isReducedVowel, isVowel, vowelFeatures, type VowelQuality } from "../phonetics/phoneme";
import { Stress, type StressLevel } from "../phonetics/pronunciation";

/** Added to the vowel distance (height + backness, each 0–1) for each other differing feature. */
const ROUNDING_DIFFERENCE = 0.3;
const LENGTH_DIFFERENCE = 0.15;
const RHOTIC_DIFFERENCE = 0.3;
const GLIDE_MISSING = 0.5;

/** Shares of consonant similarity: same manner of articulation, same place, same voicing. */
const SAME_MANNER = 0.5;
const SAME_PLACE = 0.3;
const SAME_VOICING = 0.2;

/** Edit costs for sound sequences: an extra consonant or vowel, and a vowel against a consonant. */
const CONSONANT_GAP = 0.6;
const VOWEL_GAP = 0.8;
const VOWEL_FOR_CONSONANT = 1;

/** Vowel similarity needed for two syllables to count as matching in a multisyllabic rhyme. */
const STRESSED_MATCH = 0.85;
const HALF_STRESSED_MATCH = 0.8;
const UNSTRESSED_MATCH = 0.4;

function qualityDistance(a: VowelQuality, b: VowelQuality): number {
  return Math.abs(a.height - b.height) + Math.abs(a.backness - b.backness) + (a.rounded === b.rounded ? 0 : ROUNDING_DIFFERENCE);
}

/** 1 for the same vowel, falling towards 0 as height, backness, rounding, length and glide differ. */
export function vowelSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const first = vowelFeatures(a);
  const second = vowelFeatures(b);
  if (!first || !second) return 0;
  let distance = qualityDistance(first, second);
  if (first.long !== second.long) distance += LENGTH_DIFFERENCE;
  if (first.rhotic !== second.rhotic) distance += RHOTIC_DIFFERENCE;
  if (first.glide && second.glide) distance += qualityDistance(first.glide, second.glide);
  else if (first.glide || second.glide) distance += GLIDE_MISSING;
  return Math.max(0, 1 - distance);
}

/** Shared manner, place and voicing: /m/–/n/ 0.7, /t/–/d/ 0.8, /m/–/f/ 0. */
export function consonantSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const first = consonantFeatures(a);
  const second = consonantFeatures(b);
  if (!first || !second) return 0;
  return (
    (first.manner === second.manner ? SAME_MANNER : 0) +
    (first.place === second.place ? SAME_PLACE : 0) +
    (first.voiced === second.voiced ? SAME_VOICING : 0)
  );
}

function substitutionCost(a: string, b: string): number {
  const aVowel = isVowel(a);
  const bVowel = isVowel(b);
  if (aVowel !== bVowel) return VOWEL_FOR_CONSONANT;
  return 1 - (aVowel ? vowelSimilarity(a, b) : consonantSimilarity(a, b));
}

function gapCost(phoneme: string): number {
  return isVowel(phoneme) ? VOWEL_GAP : CONSONANT_GAP;
}

/** 1 for identical sound sequences, lower with each weighted substitution, insertion or deletion. */
export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  let previous: number[] = [0];
  b.forEach((phoneme, index) => previous.push((previous[index] ?? 0) + gapCost(phoneme)));
  for (const first of a) {
    const current: number[] = [(previous[0] ?? 0) + gapCost(first)];
    b.forEach((second, index) => {
      const substitute = (previous[index] ?? 0) + substitutionCost(first, second);
      const remove = (previous[index + 1] ?? 0) + gapCost(first);
      const insert = (current[index] ?? 0) + gapCost(second);
      current.push(Math.min(substitute, remove, insert));
    });
    previous = current;
  }
  const distance = previous[b.length] ?? 0;
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

/** Whether two syllable vowels match for a multisyllabic rhyme, stricter where stress falls. */
export function nucleiMatch(a: string, stressA: StressLevel, b: string, stressB: StressLevel): boolean {
  const similarity = vowelSimilarity(a, b);
  const stressedA = stressA !== Stress.None;
  const stressedB = stressB !== Stress.None;
  if (stressedA && stressedB) return similarity >= STRESSED_MATCH;
  if (stressedA || stressedB) return similarity >= HALF_STRESSED_MATCH;
  return similarity >= UNSTRESSED_MATCH || (isReducedVowel(a) && isReducedVowel(b));
}
