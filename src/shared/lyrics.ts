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

/**
 * The shared lyrics as stored, with their analysis. analysis.lines[i] belongs to line i of the text; blank lines
 * and [label] lines have no words.
 */
export interface LyricsState {
  /** The song the lyrics belong to. */
  songId: string;
  text: string;
  revision: number;
  analysis: LyricsAnalysis;
}

/**
 * A save of the lyrics from the window or from Ode: the whole new text, the revision it was edited from, and the song
 * it was edited in, so a save that arrives after the musician opened another song stays with its own.
 */
export interface LyricsWrite {
  songId?: string;
  text: string;
  baseRevision: number;
}

/**
 * A save as stored. When someone else saved since baseRevision, both sets of changes are merged line by line;
 * where both changed the same lines, the musician's lines are kept and listed in `conflicts` (line numbers from 1).
 */
export interface LyricsSaved extends LyricsState {
  conflicts: number[];
}
