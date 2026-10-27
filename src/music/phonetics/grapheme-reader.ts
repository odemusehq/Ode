// Splits an unknown word into letter groups and their likely General American sounds.

export enum VowelLength {
  Short = "short",
  Long = "long",
  Fixed = "fixed",
}

export interface Segment {
  letters: string;
  phonemes: string[];
  vowel: boolean;
  length: VowelLength;
}

const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u", "y"]);
const FRONT_VOWEL_LETTERS = new Set(["e", "i", "y"]);
const VOICED_ENDINGS = new Set(["b", "d", "g", "l", "m", "n", "r", "v", "w", "a", "e", "i", "o", "u", "y"]);
const SILENT_E_ENDINGS = ["", "s", "d", "ly", "ment", "ful", "ness", "less"];
/** Words this short end "-ie" with /aɪ/ ("pie") and "-ey" with /eɪ/ ("hey"). */
const SHORT_WORD_LETTERS = 4;

const SHORT_VOWELS = new Map([
  ["a", "æ"],
  ["e", "ɛ"],
  ["i", "ɪ"],
  ["o", "ɑ"],
  ["u", "ʌ"],
  ["y", "ɪ"],
]);
const LONG_VOWELS = new Map([
  ["a", "eɪ"],
  ["e", "i"],
  ["i", "aɪ"],
  ["o", "oʊ"],
  ["u", "u"],
  ["y", "aɪ"],
]);

/** Consonant letter groups, longest first, with the sounds they usually spell. */
const CONSONANT_GROUPS: readonly [string, string[]][] = [
  ["tch", ["tʃ"]],
  ["sch", ["s", "k"]],
  ["dge", ["dʒ"]],
  ["ch", ["tʃ"]],
  ["sh", ["ʃ"]],
  ["th", ["θ"]],
  ["ph", ["f"]],
  ["wh", ["w"]],
  ["ck", ["k"]],
  ["ng", ["ŋ"]],
  ["nk", ["ŋ", "k"]],
  ["qu", ["k", "w"]],
  ["rh", ["ɹ"]],
  ["ss", ["s"]],
  ["ll", ["l"]],
  ["ff", ["f"]],
  ["zz", ["z"]],
  ["tt", ["t"]],
  ["dd", ["d"]],
  ["pp", ["p"]],
  ["bb", ["b"]],
  ["mm", ["m"]],
  ["nn", ["n"]],
  ["rr", ["ɹ"]],
  ["gg", ["g"]],
];

/** Letter groups read differently at the start of a word: "knee", "write", "gnome", "psalm", "ghost". */
const WORD_START_GROUPS: readonly [string, string[]][] = [
  ["kn", ["n"]],
  ["wr", ["ɹ"]],
  ["gn", ["n"]],
  ["ps", ["s"]],
  ["gh", ["g"]],
];

/** Vowel letter groups, longest first, with fixed sounds (r-coloured groups need a following non-vowel). */
const VOWEL_GROUPS: readonly [string, string[]][] = [
  ["eigh", ["eɪ"]],
  ["ough", ["ɔ"]],
  ["augh", ["ɔ"]],
  ["igh", ["aɪ"]],
  ["eau", ["oʊ"]],
  ["ee", ["i"]],
  ["ea", ["i"]],
  ["ei", ["eɪ"]],
  ["ay", ["eɪ"]],
  ["ai", ["eɪ"]],
  ["ey", ["eɪ"]],
  ["ie", ["i"]],
  ["oa", ["oʊ"]],
  ["oe", ["oʊ"]],
  ["oo", ["u"]],
  ["ou", ["aʊ"]],
  ["ow", ["aʊ"]],
  ["oi", ["ɔɪ"]],
  ["oy", ["ɔɪ"]],
  ["au", ["ɔ"]],
  ["aw", ["ɔ"]],
  ["ew", ["u"]],
  ["ue", ["u"]],
  ["ui", ["u"]],
  ["eu", ["u"]],
];

interface SuffixPart {
  phonemes: string[];
  vowel: boolean;
}

/** Word endings with a fixed reading: "-tion" /ʃən/, "-ture" /tʃɚ/, "-ous" /əs/, "-le" /əl/. */
const SUFFIXES: readonly [string, SuffixPart[]][] = [
  ["tion", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["n"], vowel: false }]],
  ["sion", [{ phonemes: ["ʒ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["n"], vowel: false }]],
  ["cian", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["n"], vowel: false }]],
  ["tial", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["l"], vowel: false }]],
  ["cial", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["l"], vowel: false }]],
  ["cious", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["s"], vowel: false }]],
  ["tious", [{ phonemes: ["ʃ"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["s"], vowel: false }]],
  ["ture", [{ phonemes: ["tʃ"], vowel: false }, { phonemes: ["ɚ"], vowel: true }]],
  ["sure", [{ phonemes: ["ʒ"], vowel: false }, { phonemes: ["ɚ"], vowel: true }]],
  ["ism", [{ phonemes: ["ɪ"], vowel: true }, { phonemes: ["z"], vowel: false }, { phonemes: ["ə"], vowel: true }, { phonemes: ["m"], vowel: false }]],
  ["ous", [{ phonemes: ["ə"], vowel: true }, { phonemes: ["s"], vowel: false }]],
];

const R_COLOURED: readonly [string, string[]][] = [
  ["air", ["ɛ", "ɹ"]],
  ["ear", ["ɪ", "ɹ"]],
  ["eer", ["ɪ", "ɹ"]],
  ["our", ["aʊ", "ɚ"]],
  ["ar", ["ɑ", "ɹ"]],
  ["or", ["ɔ", "ɹ"]],
  ["er", ["ɝ"]],
  ["ir", ["ɝ"]],
  ["ur", ["ɝ"]],
  ["yr", ["ɝ"]],
];

export class GraphemeReader {
  private index = 0;
  private readonly segments: Segment[] = [];
  private readonly silent = new Set<number>();

  constructor(private readonly word: string) {}

  read(): Segment[] {
    this.readSilentStart();
    while (this.index < this.word.length) {
      if (this.silent.has(this.index)) {
        this.index += 1;
        continue;
      }
      if (this.readSuffix()) break;
      if (!this.readVowel() && !this.readConsonant()) this.index += 1;
    }
    return this.segments;
  }

  /** Reads a fixed ending once the rest of the word is exactly that ending and a vowel comes before it. */
  private readSuffix(): boolean {
    const before = this.word.slice(0, this.index);
    if (![...before].some((letter) => VOWEL_LETTERS.has(letter))) return false;
    const rest = this.word.slice(this.index);
    const previous = this.word[this.index - 1];
    if (rest === "le" && previous !== undefined && !VOWEL_LETTERS.has(previous)) {
      this.segments.push({ letters: "le", phonemes: ["ə"], vowel: true, length: VowelLength.Fixed });
      this.push("le", ["l"], false);
      return true;
    }
    if (rest === "ed" && previous !== undefined && !VOWEL_LETTERS.has(previous)) {
      if (previous === "t" || previous === "d") {
        this.segments.push({ letters: "e", phonemes: ["ɪ"], vowel: true, length: VowelLength.Fixed });
        this.push("ed", ["d"], false);
      } else {
        this.push("ed", [VOICED_ENDINGS.has(previous) ? "d" : "t"], false);
      }
      return true;
    }
    const suffix = SUFFIXES.find(([ending]) => ending === rest);
    if (!suffix) return false;
    for (const part of suffix[1]) {
      this.segments.push({ letters: "", phonemes: part.phonemes, vowel: part.vowel, length: VowelLength.Fixed });
    }
    this.index = this.word.length;
    return true;
  }

  private letter(offset = 0): string | undefined {
    return this.word[this.index + offset];
  }

  private isVowelAt(position: number): boolean {
    const letter = this.word[position];
    return letter !== undefined && VOWEL_LETTERS.has(letter);
  }

  private startsWith(group: string): boolean {
    return this.word.startsWith(group, this.index);
  }

  private push(letters: string, phonemes: string[], vowel: boolean, length = VowelLength.Fixed): void {
    this.segments.push({ letters, phonemes, vowel, length });
    this.index += letters.length;
  }

  private readSilentStart(): void {
    for (const [group, phonemes] of WORD_START_GROUPS) {
      if (this.startsWith(group)) {
        this.push(group, phonemes, false);
        return;
      }
    }
  }

  private readConsonant(): boolean {
    const letter = this.letter();
    if (letter === undefined || VOWEL_LETTERS.has(letter)) return false;
    if (this.index > 0 && this.startsWith("gh")) {
      this.push("gh", [], false);
      return true;
    }
    if (this.index + 2 === this.word.length && (this.startsWith("mb") || this.startsWith("gn"))) {
      this.push(this.word.slice(this.index), [letter === "m" ? "m" : "n"], false);
      return true;
    }
    for (const [group, phonemes] of CONSONANT_GROUPS) {
      if (this.startsWith(group)) {
        this.push(group, phonemes, false);
        return true;
      }
    }
    this.push(letter, this.singleConsonant(letter), false);
    return true;
  }

  private singleConsonant(letter: string): string[] {
    const next = this.letter(1);
    const nextIsFront = next !== undefined && FRONT_VOWEL_LETTERS.has(next);
    switch (letter) {
      case "c":
        return nextIsFront ? ["s"] : ["k"];
      case "g":
        return nextIsFront ? ["dʒ"] : ["g"];
      case "j":
        return ["dʒ"];
      case "q":
        return ["k"];
      case "r":
        return ["ɹ"];
      case "x":
        return this.index === 0 ? ["z"] : ["k", "s"];
      case "s":
        return this.sibilant();
      default:
        return [letter];
    }
  }

  private sibilant(): string[] {
    const between = this.isVowelAt(this.index - 1) && this.isVowelAt(this.index + 1);
    const finalVoiced =
      this.index === this.word.length - 1 && this.word.length > 3 && VOICED_ENDINGS.has(this.word[this.index - 1] ?? "");
    return between || finalVoiced ? ["z"] : ["s"];
  }

  private readVowel(): boolean {
    const letter = this.letter();
    if (letter === undefined || !VOWEL_LETTERS.has(letter)) return false;
    if (letter === "y" && this.index === 0 && this.isVowelAt(1)) {
      this.push(letter, ["j"], false);
      return true;
    }
    for (const [group, phonemes] of R_COLOURED) {
      if (this.startsWith(group) && !this.isVowelAt(this.index + group.length)) {
        this.pushRColoured(group, phonemes);
        return true;
      }
    }
    for (const [group, phonemes] of VOWEL_GROUPS) {
      if (this.startsWith(group)) {
        this.push(group, this.adjustGroup(group, phonemes), true);
        return true;
      }
    }
    this.readSingleVowel(letter);
    return true;
  }

  private pushRColoured(group: string, phonemes: string[]): void {
    const [first, second] = phonemes;
    if (first !== undefined && second === "ɚ") {
      this.segments.push({ letters: group, phonemes: [first], vowel: true, length: VowelLength.Fixed });
      this.segments.push({ letters: "", phonemes: ["ɚ"], vowel: true, length: VowelLength.Fixed });
      this.index += group.length;
      return;
    }
    this.push(group, phonemes, true);
  }

  private adjustGroup(group: string, phonemes: string[]): string[] {
    const atEnd = this.index + group.length === this.word.length;
    const shortWord = this.word.length <= SHORT_WORD_LETTERS;
    switch (group) {
      case "oo":
        return this.letter(2) === "k" ? ["ʊ"] : phonemes;
      case "ow":
        return atEnd ? ["oʊ"] : phonemes;
      case "ou":
        return atEnd ? ["u"] : phonemes;
      case "ie":
        return atEnd && shortWord ? ["aɪ"] : ["i"];
      case "ey":
        return atEnd && !shortWord ? ["i"] : ["eɪ"];
      case "ough":
        return atEnd ? ["oʊ"] : phonemes;
      default:
        return phonemes;
    }
  }

  private readSingleVowel(letter: string): void {
    const position = this.index;
    const atEnd = position === this.word.length - 1;
    const vowelsBefore = [...this.word.slice(0, position)].some((character) => VOWEL_LETTERS.has(character));
    if (atEnd) {
      this.push(letter, this.finalVowel(letter, vowelsBefore), true);
      if (letter === "e" && vowelsBefore) this.segments.pop();
      return;
    }
    const special = this.specialVowel(letter);
    if (special) {
      this.push(letter, special, true, VowelLength.Fixed);
      return;
    }
    const silentE = this.magicE(position);
    if (silentE !== null) {
      this.silent.add(silentE);
      this.push(letter, [LONG_VOWELS.get(letter) ?? letter], true, VowelLength.Long);
      return;
    }
    const beforeConsonantLe = !this.isVowelAt(position + 1) && this.word.slice(position + 2) === "le";
    const open = beforeConsonantLe || (!this.isVowelAt(position + 1) && this.isVowelAt(position + 2));
    const symbol = open ? LONG_VOWELS.get(letter) : SHORT_VOWELS.get(letter);
    this.push(letter, [symbol ?? "ə"], true, open ? VowelLength.Long : VowelLength.Short);
  }

  private finalVowel(letter: string, vowelsBefore: boolean): string[] {
    switch (letter) {
      case "a":
        return vowelsBefore ? ["ə"] : ["ɑ"];
      case "e":
        return ["i"];
      case "y":
        return vowelsBefore ? ["i"] : ["aɪ"];
      case "o":
        return ["oʊ"];
      case "u":
        return ["u"];
      default:
        return ["i"];
    }
  }

  /** "all", "talk", "want", "old", "kind": vowels whose sound depends on the next letters. */
  private specialVowel(letter: string): string[] | null {
    const next = this.word.slice(this.index + 1, this.index + 3);
    if (letter === "a" && /^l(l|k|t)/.test(next)) return ["ɔ"];
    if (letter === "a" && this.word[this.index - 1] === "w") return ["ɑ"];
    if (letter === "o" && /^(ld|lt)/.test(next)) return ["oʊ"];
    if (letter === "i" && /^(nd|ld|gn)/.test(next)) return ["aɪ"];
    return null;
  }

  /** Index of a silent final "e" that makes the vowel long ("make", "hoped", "lately"), or null. */
  private magicE(position: number): number | null {
    const consonant = this.word[position + 1];
    const e = position + 2;
    if (consonant === undefined || VOWEL_LETTERS.has(consonant) || this.word[e] !== "e") return null;
    const rest = this.word.slice(e + 1);
    return SILENT_E_ENDINGS.includes(rest) ? e : null;
  }
}
