import { isVowel } from "./phoneme";

/** A run of vowel letters in a spelling, such as "ea" in "heart"; end is exclusive. */
export interface VowelGroup {
  letters: string;
  start: number;
  end: number;
}

const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Costs for aligning vowel sounds with vowel-letter groups (lower is more likely). */
const SILENT_FINAL_E_COST = 0.3;
const SILENT_GROUP_COST = 2;
const TWO_SOUNDS_ONE_GROUP_COST = 1;
const SOUND_WITHOUT_LETTERS_COST = 1.5;

enum AlignMove {
  None,
  Match,
  SilentGroup,
  TwoSoundsOneGroup,
  SoundWithoutLetters,
}

function isVowelLetter(word: string, index: number): boolean {
  const letter = word[index];
  if (letter === undefined || !VOWEL_LETTERS.has(letter)) return false;
  if (letter !== "y") return true;
  const next = word[index + 1];
  return !(index === 0 && next !== undefined && VOWEL_LETTERS.has(next));
}

/** "w" after a vowel and before a consonant or the end belongs to the vowel: "saw", "new", "owl". */
function isGlideLetter(word: string, index: number): boolean {
  if (word[index] !== "w") return false;
  const next = word[index + 1];
  return next === undefined || !VOWEL_LETTERS.has(next);
}

export function vowelGroups(word: string): VowelGroup[] {
  const groups: VowelGroup[] = [];
  let index = 0;
  while (index < word.length) {
    if (!isVowelLetter(word, index)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < word.length && (isVowelLetter(word, index) || (index > start && isGlideLetter(word, index)))) {
      index += 1;
    }
    groups.push({ letters: word.slice(start, index), start, end: index });
  }
  return groups;
}

/** A final "e" (or the "e" of a final "-es"/"-ed") after a consonant is usually silent. */
function isLikelySilent(word: string, group: VowelGroup): boolean {
  if (group.letters !== "e" || group.start === 0) return false;
  const rest = word.slice(group.end);
  return rest === "" || rest === "s" || rest === "d";
}

/**
 * Matches each vowel sound of a pronunciation with the vowel letters that spell it, so spelling-based
 * accent rules (LOT, THOUGHT, BATH…) can see which letters a vowel came from. Null where no letters match.
 */
export function alignVowels(word: string, phonemes: string[]): (VowelGroup | null)[] {
  const groups = vowelGroups(word);
  const sounds = phonemes.filter((phoneme) => isVowel(phoneme)).length;
  const columns = groups.length + 1;
  const size = (sounds + 1) * columns;
  const cost = new Array<number>(size).fill(Number.POSITIVE_INFINITY);
  const moves = new Array<AlignMove>(size).fill(AlignMove.None);
  const costAt = (sound: number, group: number): number => cost[sound * columns + group] ?? Number.POSITIVE_INFINITY;
  const relax = (sound: number, group: number, value: number, move: AlignMove): void => {
    const index = sound * columns + group;
    if (value < costAt(sound, group)) {
      cost[index] = value;
      moves[index] = move;
    }
  };
  cost[0] = 0;
  for (let sound = 0; sound <= sounds; sound++) {
    for (let group = 0; group <= groups.length; group++) {
      const here = costAt(sound, group);
      if (!Number.isFinite(here)) continue;
      const current = groups[group];
      if (current) {
        if (sound < sounds) relax(sound + 1, group + 1, here, AlignMove.Match);
        const silent = isLikelySilent(word, current) ? SILENT_FINAL_E_COST : SILENT_GROUP_COST;
        relax(sound, group + 1, here + silent, AlignMove.SilentGroup);
        if (sound + 1 < sounds && current.letters.length > 1) {
          relax(sound + 2, group + 1, here + TWO_SOUNDS_ONE_GROUP_COST, AlignMove.TwoSoundsOneGroup);
        }
      }
      if (sound < sounds) relax(sound + 1, group, here + SOUND_WITHOUT_LETTERS_COST, AlignMove.SoundWithoutLetters);
    }
  }
  const alignment = new Array<VowelGroup | null>(sounds).fill(null);
  let sound = sounds;
  let group = groups.length;
  while (sound > 0 || group > 0) {
    const move = moves[sound * columns + group] ?? AlignMove.None;
    if (move === AlignMove.Match) {
      alignment[sound - 1] = groups[group - 1] ?? null;
      sound -= 1;
      group -= 1;
    } else if (move === AlignMove.SilentGroup) {
      group -= 1;
    } else if (move === AlignMove.TwoSoundsOneGroup) {
      const shared = groups[group - 1] ?? null;
      alignment[sound - 1] = shared;
      alignment[sound - 2] = shared;
      sound -= 2;
      group -= 1;
    } else if (move === AlignMove.SoundWithoutLetters) {
      sound -= 1;
    } else {
      break;
    }
  }
  return alignment;
}
