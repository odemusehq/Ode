import { isVowel } from "./phoneme";

/** Consonant clusters English allows at the start of a syllable (/ŋ/ never starts one). */
const LEGAL_ONSETS: ReadonlySet<string> = new Set([
  "p", "b", "t", "d", "k", "g", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "h", "tʃ", "dʒ", "m", "n", "l", "ɹ", "w", "j",
  "p l", "p ɹ", "p j", "b l", "b ɹ", "b j", "t ɹ", "t w", "t j", "d ɹ", "d w", "d j",
  "k l", "k ɹ", "k w", "k j", "g l", "g ɹ", "g w", "g j",
  "f l", "f ɹ", "f j", "v j", "θ ɹ", "θ w", "θ j", "ʃ ɹ", "s l", "s w", "s j", "z j", "h j", "h w",
  "m j", "n j", "l j", "s p", "s t", "s k", "s m", "s n", "s f",
  "s p l", "s p ɹ", "s p j", "s t ɹ", "s t j", "s k l", "s k ɹ", "s k w", "s k j",
]);

export interface SyllableParts {
  onset: string[];
  nucleus: string;
  coda: string[];
}

function onsetLength(cluster: string[]): number {
  for (let length = cluster.length; length > 0; length--) {
    if (LEGAL_ONSETS.has(cluster.slice(cluster.length - length).join(" "))) return length;
  }
  return 0;
}

/**
 * Splits phonemes into syllables, one vowel each. Consonants between vowels go to the following
 * syllable as far as English allows that cluster to start a syllable (the maximal onset principle).
 */
export function syllabify(phonemes: string[]): string[][] {
  const nuclei: number[] = [];
  phonemes.forEach((phoneme, index) => {
    if (isVowel(phoneme)) nuclei.push(index);
  });
  if (nuclei.length === 0) return phonemes.length > 0 ? [[...phonemes]] : [];
  const syllables: string[][] = [];
  let start = 0;
  nuclei.forEach((nucleus, index) => {
    const next = nuclei[index + 1];
    if (next === undefined) {
      syllables.push(phonemes.slice(start));
      return;
    }
    const boundary = next - onsetLength(phonemes.slice(nucleus + 1, next));
    syllables.push(phonemes.slice(start, boundary));
    start = boundary;
  });
  return syllables;
}

/** Onset, vowel and coda of one syllable. */
export function syllableParts(syllable: string[]): SyllableParts {
  const vowelIndex = syllable.findIndex((phoneme) => isVowel(phoneme));
  if (vowelIndex < 0) return { onset: [...syllable], nucleus: "", coda: [] };
  return {
    onset: syllable.slice(0, vowelIndex),
    nucleus: syllable[vowelIndex] ?? "",
    coda: syllable.slice(vowelIndex + 1),
  };
}
