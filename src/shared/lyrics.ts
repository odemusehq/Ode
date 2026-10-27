// Shape of lyric analysis shared by the music code, the tools and the UI.

export interface SyllableInfo {
  /** The spelling of this syllable, for display. */
  text: string;
  /** IPA phonemes. */
  phonemes: string[];
  /** 1 primary, 2 secondary, 0 unstressed, after phrase stress is applied. */
  stress: 0 | 1 | 2;
}

export interface WordOption {
  syllables: SyllableInfo[];
}

export interface WordAnalysis {
  text: string;
  /** Every valid pronunciation; sung words can have more than one syllable count. */
  options: WordOption[];
  /** False when the pronunciation came from letter-to-sound rules or the model. */
  certain: boolean;
}

export interface LineAnalysis {
  text: string;
  words: WordAnalysis[];
  /** Every possible syllable count for the line, ascending. */
  counts: number[];
}

export interface LyricsNote {
  line: number;
  kind: "cliche" | "prosody" | "uncertain" | "rhyme";
  message: string;
}

export interface LyricsAnalysis {
  lines: LineAnalysis[];
  /** Rhyme-scheme letter per line ("A", "B"…); "-" for lines with no rhyme partner. */
  scheme: string[];
  notes: LyricsNote[];
}
